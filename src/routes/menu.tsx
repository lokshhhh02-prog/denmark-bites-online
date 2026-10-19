import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bike, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { cart, computeTotals, inr, useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  validateSearch: (s: Record<string, unknown>) => {
    const b = Number(s['branch']);
    return { branch: b === 2 || b === 3 ? b : 1 };
  },
  head: () => ({
    meta: [
      { title: "Menu & Online Order — Denmark Restaurant" },
      { name: "description", content: "Browse 100 Arabian, Chinese and Tamil Nadu non-veg dishes and order for dine-in or delivery." },
      { property: "og:title", content: "Denmark Restaurant Menu" },
      { property: "og:description", content: "Order Arabian & Chinese non-veg online for dine-in or delivery." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { branch } = Route.useSearch();
  const navigate = useNavigate({ from: "/menu" });
  const c = useCart();
  const [cat, setCat] = useState<string>("All");
  const [sheet, setSheet] = useState(false);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => cart.setBranch(branch), [branch]);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });
  const { data: items, isLoading } = useQuery({
    queryKey: ["menu", branch],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("branch_id", branch).order("sort");
      if (error) throw error;
      return data;
    },
  });
  const current = branches?.find((b) => b.id === branch);
  const categories = useMemo(() => ["All", ...Array.from(new Set((items ?? []).map((i) => i.category)))], [items]);
  const shown = (items ?? []).filter((i) => cat === "All" || i.category === cat);
  const lines = c.branch === branch ? c.lines : [];
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0);

  const cartPanel = (
    <CartPanel lines={lines} subtotal={subtotal} gst={Number(current?.gst_percent ?? 0)} onCheckout={() => { setSheet(false); setCheckout(true); }} />
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Denmark Restaurant</p>
            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Menu & Order</h1>
            <p className="mt-2 text-muted-foreground">{current ? `${current.address} · ${current.phone}` : "Choose a branch"}</p>
          </div>
          <div className="flex gap-2 rounded-full border bg-card p-1 shadow-soft">
            {(branches ?? []).map((b) => (
              <button
                key={b.id}
                onClick={() => navigate({ search: { branch: b.id } })}
                className={cn("rounded-full px-4 py-2 text-sm font-medium transition", b.id === branch ? "bg-ember text-primary-foreground" : "hover:bg-muted")}
              >
                Branch {b.id}
              </button>
            ))}
          </div>
        </div>
        {current && !current.is_open && (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This branch is not accepting orders right now.
          </p>
        )}

        <div className="sticky top-16 z-30 -mx-5 mt-8 overflow-x-auto bg-background/90 px-5 py-3 backdrop-blur">
          <div className="flex gap-2">
            {categories.map((k) => (
              <button
                key={k}
                onClick={() => setCat(k)}
                className={cn("whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition", k === cat ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50")}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {isLoading && <p className="text-muted-foreground">Loading menu…</p>}
            {shown.map((it) => {
              const inCart = lines.find((l) => l.id === it.id);
              return (
                <div key={it.id} className={cn("flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant", !it.in_stock && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm border-2 border-destructive" title="Non-veg" />
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{it.cuisine}</span>
                  </div>
                  <p className="mt-3 font-display text-lg leading-snug">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.category}</p>
                  {it.description && <p className="mt-2 text-sm text-muted-foreground">{it.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <p className="text-lg font-semibold">{inr(Number(it.price))}</p>
                    {!it.in_stock ? (
                      <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Out of stock</span>
                    ) : inCart ? (
                      <div className="flex items-center gap-2 rounded-full border border-primary px-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => cart.dec(it.id)} aria-label="Remove one"><Minus /></Button>
                        <span className="w-5 text-center text-sm font-semibold">{inCart.qty}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => cart.add({ id: it.id, name: it.name, price: Number(it.price) })} aria-label="Add one"><Plus /></Button>
                      </div>
                    ) : (
                      <Button variant="hero" size="sm" className="px-5" disabled={!current?.is_open} onClick={() => cart.add({ id: it.id, name: it.name, price: Number(it.price) })}>
                        <Plus /> Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-32">{cartPanel}</div>
          </aside>
        </div>
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <Button variant="hero" className="h-14 w-full justify-between px-6 text-base" onClick={() => setSheet(true)}>
            <span className="flex items-center gap-2"><ShoppingBag /> {count} items</span>
            <span>{inr(subtotal)} · View cart</span>
          </Button>
        </div>
      )}
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
          <SheetHeader><SheetTitle>Your order</SheetTitle></SheetHeader>
          <div className="p-4">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      {current && (
        <CheckoutDialog
          open={checkout}
          onOpenChange={setCheckout}
          branch={current}
          lines={lines}
          subtotal={subtotal}
          onPlaced={(id, token) => navigate({ to: "/order/$id", params: { id }, search: { token } })}
        />
      )}
    </div>
  );
}

function CartPanel({ lines, subtotal, gst, onCheckout }: { lines: { id: string; name: string; price: number; qty: number }[]; subtotal: number; gst: number; onCheckout: () => void }) {
  const t = computeTotals(subtotal, gst, 0, false);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <p className="font-display text-xl">Your order</p>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Your cart is empty. Tap “Add” on any dish.</p>
      ) : (
        <>
          <ul className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.qty} × {inr(l.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{inr(l.qty * l.price)}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cart.remove(l.id)} aria-label="Remove"><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t pt-4 text-sm">
            <Row k="Subtotal" v={inr(t.subtotal)} />
            <Row k={`GST (${gst}%)`} v={inr(t.gst)} />
            <Row k="Total" v={inr(t.total)} bold />
            <p className="pt-1 text-xs text-muted-foreground">Packing charge is added for delivery orders.</p>
          </div>
          <Button variant="hero" className="mt-5 h-12 w-full text-base" onClick={onCheckout}>Continue</Button>
        </>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "pt-1 text-base font-semibold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{k}</span><span>{v}</span>
    </div>
  );
}

type Branch = { id: number; name: string; gst_percent: number; packing_charge: number; is_open: boolean };

function CheckoutDialog({ open, onOpenChange, branch, lines, subtotal, onPlaced }: {
  open: boolean; onOpenChange: (o: boolean) => void; branch: Branch;
  lines: { id: string; qty: number }[]; subtotal: number; onPlaced: (id: string, token: string) => void;
}) {
  const [type, setType] = useState<"dine_in" | "delivery" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [table, setTable] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) setType(null); }, [open]);
  const t = computeTotals(subtotal, Number(branch.gst_percent), Number(branch.packing_charge), type === "delivery");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;
    if (name.trim().length < 2) { toast.error("Please enter your name"); return; }
    if (!/^[0-9+ ]{10,15}$/.test(phone.trim())) { toast.error("Please enter a valid phone number"); return; }
    if (type === "dine_in" && !table.trim()) { toast.error("Please enter your table number"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      _branch: branch.id, _type: type, _name: name, _phone: phone,
      _table: type === "dine_in" ? table : "",
      _items: lines.map((l) => ({ id: l.id, qty: l.qty })),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { id: string; token: string; order_number: number };
    cart.clear();
    onOpenChange(false);
    toast.success(`Order #${res.order_number} sent to the restaurant`);
    onPlaced(res.id, res.token);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{type ? (type === "dine_in" ? "Dine in details" : "Delivery details") : "How would you like it?"}</DialogTitle>
          <DialogDescription>{branch.name}</DialogDescription>
        </DialogHeader>
        {!type ? (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {[
              { k: "dine_in" as const, icon: UtensilsCrossed, t: "DINE IN", d: "Eat at the restaurant" },
              { k: "delivery" as const, icon: Bike, t: "DELIVERY", d: `Take away · +${inr(Number(branch.packing_charge))} packing` },
            ].map((o) => (
              <button key={o.k} onClick={() => setType(o.k)} className="flex flex-col items-center gap-3 rounded-2xl border-2 bg-card p-6 text-center transition hover:border-primary hover:shadow-elegant">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-ember text-primary-foreground"><o.icon className="h-6 w-6" /></span>
                <span className="font-display text-lg font-semibold tracking-wider">{o.t}</span>
                <span className="text-xs text-muted-foreground">{o.d}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label htmlFor="n">Name</Label><Input id="n" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
            <div className="space-y-1.5"><Label htmlFor="p">Phone number</Label><Input id="p" inputMode="tel" value={phone} maxLength={15} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" /></div>
            {type === "dine_in" && (
              <div className="space-y-1.5"><Label htmlFor="t">Table number</Label><Input id="t" value={table} maxLength={10} onChange={(e) => setTable(e.target.value)} placeholder="e.g. 12" /></div>
            )}
            <div className="space-y-1 rounded-xl bg-muted p-4 text-sm">
              <Row k="Subtotal" v={inr(t.subtotal)} />
              <Row k={`GST (${Number(branch.gst_percent)}%)`} v={inr(t.gst)} />
              {type === "delivery" && <Row k="Packing charge" v={inr(t.pack)} />}
              <Row k="Total" v={inr(t.total)} bold />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setType(null)}>Back</Button>
              <Button type="submit" variant="hero" className="h-11 flex-1" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Place order · {inr(t.total)}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
