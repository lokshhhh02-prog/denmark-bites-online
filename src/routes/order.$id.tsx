import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ChefHat, Clock, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/order/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  head: () => ({
    meta: [
      { title: "Your Order — Denmark Restaurant" },
      { name: "description", content: "Track your Denmark Restaurant order status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your Order — Denmark Restaurant" },
      { property: "og:description", content: "Track your order status live." },
    ],
  }),
  component: OrderPage,
});

type PublicOrder = {
  id: string; order_number: number; branch_name: string; order_type: "dine_in" | "delivery";
  customer_name: string; table_number: string | null; items: { name: string; price: number; qty: number }[];
  subtotal: number; gst_percent: number; gst_amount: number; packing_charge: number; total: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled"; created_at: string;
};

const steps = [
  { k: "pending", t: "Received", icon: Clock },
  { k: "preparing", t: "Preparing", icon: ChefHat },
  { k: "ready", t: "Ready", icon: PackageCheck },
  { k: "completed", t: "Completed", icon: CheckCircle2 },
] as const;

function OrderPage() {
  const { id } = Route.useParams();
  const { token } = Route.useSearch();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: o, isLoading } = useQuery({
    queryKey: ["order", id, token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_public", { _id: id, _token: token });
      if (error) throw error;
      return data as unknown as PublicOrder | null;
    },
    enabled: !!token,
    refetchInterval: 5000,
  });

  async function cancel() {
    if (!confirm("Cancel this order?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_order_public", { _id: id, _token: token });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Your order was cancelled");
    qc.invalidateQueries({ queryKey: ["order", id, token] });
  }

  const idx = o ? steps.findIndex((s) => s.k === o.status) : -1;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-5 py-12">
        {isLoading ? (
          <p className="text-muted-foreground">Loading your order…</p>
        ) : !o ? (
          <div className="text-center">
            <h1 className="text-3xl font-semibold">Order not found</h1>
            <Button asChild variant="hero" className="mt-6"><Link to="/menu" search={{ branch: 1 }}>Back to menu</Link></Button>
          </div>
        ) : (
          <div className="rounded-3xl border bg-card p-8 shadow-elegant">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{o.branch_name}</p>
            <h1 className="mt-2 text-4xl font-semibold">Order #{o.order_number}</h1>
            <p className="mt-1 text-muted-foreground">
              {o.customer_name} · {o.order_type === "dine_in" ? `Dine in · Table ${o.table_number}` : "Delivery / Take away"}
            </p>

            {o.status === "cancelled" ? (
              <div className="mt-8 flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive"><XCircle /> This order was cancelled.</div>
            ) : (
              <div className="mt-8 grid grid-cols-4 gap-2">
                {steps.map((s, i) => (
                  <div key={s.k} className="flex flex-col items-center gap-2 text-center">
                    <span className={cn("grid h-12 w-12 place-items-center rounded-full border-2 transition", i <= idx ? "border-primary bg-ember text-primary-foreground" : "border-border text-muted-foreground")}>
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className={cn("text-xs font-medium", i <= idx ? "text-foreground" : "text-muted-foreground")}>{s.t}</span>
                  </div>
                ))}
              </div>
            )}

            <ul className="mt-8 space-y-2 border-t pt-6 text-sm">
              {o.items.map((l, i) => (
                <li key={i} className="flex justify-between"><span>{l.qty} × {l.name}</span><span>{inr(l.qty * l.price)}</span></li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST ({Number(o.gst_percent)}%)</span><span>{inr(o.gst_amount)}</span></div>
              {Number(o.packing_charge) > 0 && <div className="flex justify-between text-muted-foreground"><span>Packing</span><span>{inr(o.packing_charge)}</span></div>}
              <div className="flex justify-between pt-1 text-lg font-semibold"><span>Total</span><span>{inr(o.total)}</span></div>
            </div>

            {o.status === "pending" && (
              <div className="mt-8 rounded-2xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">You can cancel until the kitchen starts preparing your food.</p>
                <Button variant="destructive" className="mt-3 rounded-full" disabled={busy} onClick={cancel}>Cancel order</Button>
              </div>
            )}
            <p className="mt-6 text-xs text-muted-foreground">This page updates automatically. Keep it open or bookmark it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
