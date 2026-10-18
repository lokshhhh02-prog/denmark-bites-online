import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Plus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inr } from "@/lib/cart";
import { cn } from "@/lib/utils";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type Item = Database["public"]["Tables"]["menu_items"]["Row"];
type Branch = Database["public"]["Tables"]["branches"]["Row"];
type Line = { name: string; price: number; qty: number };

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner Console — Denmark Restaurant" },
      { name: "description", content: "Manage orders, menu, GST and branches." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Owner Console" },
      { property: "og:description", content: "Staff-only console." },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: roles, isLoading } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role, branch_id").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });
  const isOwner = !!roles?.some((r) => r.role === "owner");
  const allowed = isOwner ? [1, 2, 3] : (roles ?? []).map((r) => r.branch_id!).filter(Boolean).sort();
  const [tab, setTab] = useState<string>("");
  useEffect(() => { if (!tab && allowed.length) setTab(`b${allowed[0]}`); }, [allowed, tab]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!allowed.length)
    return (
      <Shell>
        <div className="rounded-3xl border bg-card p-8 shadow-soft">
          <h1 className="text-2xl font-semibold">No access</h1>
          <p className="mt-2 text-muted-foreground">Your account ({user.email}) has not been given access to any branch. Ask the owner to add your email.</p>
          <Button className="mt-6 rounded-full" variant="outline" onClick={signOut}><LogOut /> Sign out</Button>
        </div>
      </Shell>
    );

  const tabs = [
    ...allowed.map((b) => ({ k: `b${b}`, t: `Branch ${b}` })),
    ...(isOwner ? [{ k: "staff", t: "Branch access" }] : []),
    { k: "account", t: "Account" },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{isOwner ? "Main owner" : "Branch manager"}</p>
          <h1 className="mt-1 text-4xl font-semibold">Owner console</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={signOut}><LogOut /> Sign out</Button>
      </div>
      <div className="mt-8 flex flex-wrap gap-2 rounded-full border bg-card p-1 shadow-soft sm:inline-flex">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cn("rounded-full px-5 py-2 text-sm font-medium", tab === t.k ? "bg-ember text-primary-foreground" : "hover:bg-muted")}>{t.t}</button>
        ))}
      </div>
      <div className="mt-8">
        {tab.startsWith("b") && <BranchPanel key={tab} branchId={Number(tab.slice(1))} />}
        {tab === "staff" && isOwner && <StaffPanel />}
        {tab === "account" && <AccountPanel email={user.email ?? ""} />}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">{children}</div>
    </div>
  );
}

function BranchPanel({ branchId }: { branchId: number }) {
  const [sub, setSub] = useState<"orders" | "menu" | "settings">("orders");
  const { data: branch } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("id", branchId).single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <div>
      <div className="flex gap-6 border-b">
        {(["orders", "menu", "settings"] as const).map((s) => (
          <button key={s} onClick={() => setSub(s)} className={cn("-mb-px border-b-2 px-1 pb-3 text-sm font-semibold capitalize", sub === s ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
            {s === "settings" ? "GST, packing & details" : s}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {branch && sub === "orders" && <OrdersPanel branch={branch} />}
        {sub === "menu" && <MenuEditor branchId={branchId} />}
        {branch && sub === "settings" && <SettingsPanel branch={branch} />}
      </div>
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
    });
  } catch { /* ignore */ }
}

const statusFlow: Record<string, { next?: Order["status"]; label?: string }> = {
  pending: { next: "preparing", label: "Start preparing" },
  preparing: { next: "ready", label: "Mark ready" },
  ready: { next: "completed", label: "Complete" },
};

function OrdersPanel({ branch }: { branch: Branch }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [printing, setPrinting] = useState<Order | null>(null);
  const key = ["orders", branch.id];
  const { data: orders } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("branch_id", branch.id).order("created_at", { ascending: false }).limit(150);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    const ch = supabase
      .channel(`orders-${branch.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `branch_id=eq.${branch.id}` }, (p) => {
        qc.invalidateQueries({ queryKey: key });
        if (p.eventType === "INSERT") {
          const o = p.new as Order;
          beep();
          toast.success(`New order #${o.order_number} — ${o.order_type === "dine_in" ? `Table ${o.table_number}` : "Delivery"}`, { description: `${o.customer_name} · ${inr(o.total)}` });
          if (typeof Notification !== "undefined" && Notification.permission === "granted")
            new Notification(`New order #${o.order_number}`, { body: `${o.customer_name} · ${inr(o.total)}` });
        } else if (p.eventType === "UPDATE" && (p.new as Order).status === "cancelled" && (p.old as Partial<Order>)?.status !== "cancelled") {
          toast.warning(`Order #${(p.new as Order).order_number} was cancelled`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch.id]);

  async function setStatus(o: Order, status: Order["status"]) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }
  function print(o: Order) {
    setPrinting(o);
    setTimeout(() => window.print(), 100);
  }

  const shown = (orders ?? []).filter((o) => filter === "all" || ["pending", "preparing", "ready"].includes(o.status));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bell className="h-4 w-4 text-primary" /> Live — new orders ring here automatically.</p>
        <div className="flex gap-1 rounded-full border bg-card p-1">
          {(["active", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", filter === f ? "bg-primary text-primary-foreground" : "")}>{f}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No orders yet.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((o) => {
          const lines = o.items as unknown as Line[];
          const f = statusFlow[o.status];
          return (
            <div key={o.id} className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl">#{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold",
                  o.status === "cancelled" ? "bg-destructive/10 text-destructive" : o.status === "completed" ? "bg-success/15 text-success" : "bg-accent text-accent-foreground")}>
                  {o.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{o.order_type === "dine_in" ? `DINE IN · Table ${o.table_number}` : "DELIVERY / TAKE AWAY"}</p>
              <p className="text-sm text-muted-foreground">{o.customer_name} · {o.phone}</p>
              <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
                {lines.map((l, i) => <li key={i} className="flex justify-between"><span>{l.qty} × {l.name}</span><span>{inr(l.qty * l.price)}</span></li>)}
              </ul>
              <p className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{inr(o.total)}</span></p>
              <div className="mt-4 flex flex-wrap gap-2">
                {f?.next && <Button size="sm" variant="hero" onClick={() => setStatus(o, f.next!)}>{f.label}</Button>}
                {["pending", "preparing"].includes(o.status) && <Button size="sm" variant="outline" className="rounded-full" onClick={() => confirm("Cancel this order?") && setStatus(o, "cancelled")}>Cancel</Button>}
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => print(o)}><Printer /> Print bill</Button>
              </div>
            </div>
          );
        })}
      </div>
      <div id="print-root">{printing && <Bill o={printing} branch={branch} />}</div>
    </div>
  );
}

function Bill({ o, branch }: { o: Order; branch: Branch }) {
  const lines = o.items as unknown as Line[];
  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 8 }}>
      <p style={{ textAlign: "center", fontWeight: 700, fontSize: 16 }}>DENMARK RESTAURANT</p>
      <p style={{ textAlign: "center" }}>{branch.name}<br />{branch.address}<br />{branch.phone}</p>
      <hr />
      <p>Bill #{o.order_number} · {new Date(o.created_at).toLocaleString("en-IN")}</p>
      <p>{o.order_type === "dine_in" ? `Dine in · Table ${o.table_number}` : "Delivery / Take away"}</p>
      <p>{o.customer_name} · {o.phone}</p>
      <hr />
      {lines.map((l, i) => <p key={i} style={{ display: "flex", justifyContent: "space-between" }}><span>{l.qty} x {l.name}</span><span>{inr(l.qty * l.price)}</span></p>)}
      <hr />
      <p style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{inr(o.subtotal)}</span></p>
      <p style={{ display: "flex", justifyContent: "space-between" }}><span>GST {Number(o.gst_percent)}%</span><span>{inr(o.gst_amount)}</span></p>
      {Number(o.packing_charge) > 0 && <p style={{ display: "flex", justifyContent: "space-between" }}><span>Packing</span><span>{inr(o.packing_charge)}</span></p>}
      <p style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}><span>TOTAL</span><span>{inr(o.total)}</span></p>
      <hr />
      <p style={{ textAlign: "center" }}>Thank you! Visit again.</p>
    </div>
  );
}

function MenuEditor({ branchId }: { branchId: number }) {
  const qc = useQueryClient();
  const key = ["menu", branchId];
  const [q, setQ] = useState("");
  const { data: items } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("branch_id", branchId).order("sort");
      if (error) throw error;
      return data;
    },
  });
  const [draft, setDraft] = useState({ name: "", category: "", cuisine: "Arabian", price: "" });
  const categories = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.category))), [items]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(draft.price);
    if (!draft.name.trim() || !draft.category.trim() || !(price >= 0) || draft.price === "") return toast.error("Fill in name, category and price");
    const { error } = await supabase.from("menu_items").insert({
      branch_id: branchId, name: draft.name.trim(), category: draft.category.trim(), cuisine: draft.cuisine, price,
      sort: (items?.length ?? 0) + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Dish added");
    setDraft({ name: "", category: draft.category, cuisine: draft.cuisine, price: "" });
    qc.invalidateQueries({ queryKey: key });
  }

  const shown = (items ?? []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid gap-3 rounded-2xl border bg-card p-5 shadow-soft md:grid-cols-[2fr_1.5fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1"><Label>New dish</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Dish name" maxLength={80} /></div>
        <div className="space-y-1"><Label>Category</Label><Input list="cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Category" /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div className="space-y-1"><Label>Cuisine</Label>
          <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.cuisine} onChange={(e) => setDraft({ ...draft, cuisine: e.target.value })}>
            <option>Arabian</option><option>Chinese</option><option>Tamil Nadu</option>
          </select>
        </div>
        <div className="space-y-1"><Label>Price (₹)</Label><Input type="number" min={0} step="1" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
        <Button type="submit" variant="hero"><Plus /> Add dish</Button>
      </form>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{items?.length ?? 0} dishes</p>
        <Input className="max-w-xs bg-card" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {shown.map((it) => <MenuRow key={it.id} item={it} onChanged={() => qc.invalidateQueries({ queryKey: key })} />)}
      </div>
    </div>
  );
}

function MenuRow({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [category, setCategory] = useState(item.category);
  const dirty = name !== item.name || Number(price) !== Number(item.price) || category !== item.category;

  async function save() {
    const p = Number(price);
    if (!name.trim() || !(p >= 0)) return toast.error("Invalid name or price");
    const { error } = await supabase.from("menu_items").update({ name: name.trim(), price: p, category: category.trim() }).eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChanged();
  }
  async function toggleStock(v: boolean) {
    const { error } = await supabase.from("menu_items").update({ in_stock: v }).eq("id", item.id);
    if (error) return toast.error(error.message);
    onChanged();
  }
  async function del() {
    if (!confirm(`Delete ${item.name}?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    onChanged();
  }
  return (
    <div className="grid items-center gap-3 border-b p-3 last:border-0 md:grid-cols-[2fr_1.5fr_110px_150px_auto]">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={item.in_stock} onCheckedChange={toggleStock} />
        <span className={item.in_stock ? "text-success" : "text-destructive"}>{item.in_stock ? "In stock" : "Out of stock"}</span>
      </label>
      <div className="flex gap-1">
        <Button size="sm" variant={dirty ? "hero" : "ghost"} disabled={!dirty} onClick={save}><Save /></Button>
        <Button size="sm" variant="ghost" onClick={del} aria-label="Delete"><Trash2 /></Button>
      </div>
    </div>
  );
}

function SettingsPanel({ branch }: { branch: Branch }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: branch.name, address: branch.address, phone: branch.phone,
    gst: String(branch.gst_percent), pack: String(branch.packing_charge), open: branch.is_open,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const gst = Number(f.gst), pack = Number(f.pack);
    if (!(gst >= 0 && gst <= 28)) return toast.error("GST must be between 0 and 28%");
    if (!(pack >= 0)) return toast.error("Packing charge must be 0 or more");
    const { error } = await supabase.from("branches").update({ name: f.name, address: f.address, phone: f.phone, gst_percent: gst, packing_charge: pack, is_open: f.open }).eq("id", branch.id);
    if (error) return toast.error(error.message);
    toast.success("Branch settings saved");
    qc.invalidateQueries({ queryKey: ["branch", branch.id] });
    qc.invalidateQueries({ queryKey: ["branches"] });
  }
  return (
    <form onSubmit={save} className="grid max-w-2xl gap-4 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2"><Label>Branch name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <div className="space-y-1"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="space-y-1"><Label>GST (%)</Label><Input type="number" step="0.01" min={0} max={28} value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} /></div>
      <div className="space-y-1"><Label>Packing charge for delivery (₹)</Label><Input type="number" min={0} value={f.pack} onChange={(e) => setF({ ...f, pack: e.target.value })} /></div>
      <label className="flex items-center gap-3 pt-6 text-sm"><Switch checked={f.open} onCheckedChange={(v) => setF({ ...f, open: v })} /> Accepting orders</label>
      <Button type="submit" variant="hero" className="sm:col-span-2"><Save /> Save settings</Button>
    </form>
  );
}

function StaffPanel() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState(1);
  const { data: staff } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_staff");
      if (error) throw error;
      return data;
    },
  });
  const { data: invites } = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_invites").select("*").order("branch_id");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["staff"] }); qc.invalidateQueries({ queryKey: ["invites"] }); };

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("assign_manager", { _email: email, _branch: branch });
    if (error) return toast.error(error.message);
    toast.success(data === "assigned" ? "Access granted" : "Invited — they can now create an account with this email");
    setEmail("");
    refresh();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={assign} className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Give a branch server access</h2>
        <p className="text-sm text-muted-foreground">Each branch manager can only see and change their own branch.</p>
        <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Branch</Label>
          <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={branch} onChange={(e) => setBranch(Number(e.target.value))}>
            <option value={1}>Branch 1</option><option value={2}>Branch 2</option><option value={3}>Branch 3</option>
          </select>
        </div>
        <Button type="submit" variant="hero" className="w-full">Grant access</Button>
      </form>
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Who has access</h2>
        <ul className="mt-4 divide-y text-sm">
          {(staff ?? []).map((s) => (
            <li key={s.user_id + s.role + s.branch_id} className="flex items-center justify-between py-3">
              <span>{s.email}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">{s.role === "owner" ? "Main owner · all branches" : `Branch ${s.branch_id}`}</span>
                {s.role === "manager" && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const { error } = await supabase.rpc("remove_manager", { _user_id: s.user_id, _branch: s.branch_id! });
                    if (error) toast.error(error.message); else refresh();
                  }}><Trash2 /></Button>
                )}
              </span>
            </li>
          ))}
          {(invites ?? []).map((i) => (
            <li key={i.email} className="flex items-center justify-between py-3 text-muted-foreground">
              <span>{i.email} (waiting for sign up)</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs">Branch {i.branch_id}</span>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("staff_invites").delete().eq("email", i.email); refresh(); }}><Trash2 /></Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AccountPanel({ email }: { email: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pw, setPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    setPw("");
    if (error) return toast.error("Incorrect password");
    setStep(2);
  }
  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo: window.location.origin + "/owner" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(3);
  }
  return (
    <div className="max-w-lg rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="text-xl font-semibold">Change login email</h2>
      <p className="mt-1 text-sm text-muted-foreground">Two-step verification: confirm your password, then approve the change from your email.</p>
      <div className="mt-4 flex gap-2 text-xs font-semibold">
        {["Verify password", "New email", "Confirm by email"].map((t, i) => (
          <span key={t} className={cn("rounded-full px-3 py-1", step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}. {t}</span>
        ))}
      </div>
      {step === 1 && (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <div className="space-y-1"><Label>Current password</Label><Input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button type="submit" variant="hero" disabled={busy}>Verify</Button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={change} className="mt-5 space-y-3">
          <div className="space-y-1"><Label>New email</Label><Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
          <Button type="submit" variant="hero" disabled={busy}>Send confirmation</Button>
        </form>
      )}
      {step === 3 && (
        <p className="mt-5 rounded-xl bg-accent p-4 text-sm">
          Confirmation links were sent to <b>{email}</b> and <b>{newEmail}</b>. The email changes only after the links are confirmed.
        </p>
      )}
    </div>
  );
}
