import { createServerFn } from "@tanstack/react-start";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const isPaymentConfigured = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: !!(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]) };
});

// Creates a Razorpay order for an existing unpaid order. The caller must hold
// the order's private token; the amount is re-read from the database, never
// trusted from the client.
export const createRazorpayCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const d = input as { orderId?: string; token?: string };
    if (!d || typeof d.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.orderId)) throw new Error("Invalid payment request");
    if (typeof d.token !== "string" || d.token.length < 10 || d.token.length > 80) throw new Error("Invalid payment request");
    return { orderId: d.orderId, token: d.token };
  })
  .handler(async ({ data }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) return { configured: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, status, payment_method, payment_status, customer_name, phone, cancel_token")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order || order.cancel_token !== data.token) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("This order was cancelled");
    if (order.payment_method !== "online" || order.payment_status !== "pending_payment") {
      throw new Error("This order does not need online payment");
    }
    const amount = Math.round(Number(order.total) * 100);
    if (!(amount >= 100)) throw new Error("Order total must be at least ₹1 to pay online");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `order_${order.order_number}`,
        notes: { order_id: order.id },
      }),
    });
    if (!res.ok) throw new Error("Payment gateway error — please try again");
    const rzp = (await res.json()) as { id?: string };
    if (!rzp.id) throw new Error("Payment gateway error — please try again");
    const { error: upErr } = await supabaseAdmin.from("orders").update({ razorpay_order_id: rzp.id }).eq("id", order.id);
    if (upErr) throw new Error("Could not start payment — please try again");
    return { configured: true as const, keyId, razorpayOrderId: rzp.id, amount, orderNumber: order.order_number };
  });

// Confirms a Razorpay payment by checking the HMAC signature against the
// stored Razorpay order id, then marks the order as paid.
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const d = input as Record<string, unknown>;
    const str = (k: string, re: RegExp) => {
      const v = d?.[k];
      if (typeof v !== "string" || !re.test(v)) throw new Error("Invalid payment confirmation");
      return v;
    };
    return {
      orderId: str("orderId", /^[0-9a-f-]{36}$/i),
      token: str("token", /^.{10,80}$/),
      razorpayOrderId: str("razorpayOrderId", /^order_[A-Za-z0-9]+$/),
      razorpayPaymentId: str("razorpayPaymentId", /^pay_[A-Za-z0-9]+$/),
      signature: str("signature", /^[A-Za-z0-9+/=]{20,256}$/),
    };
  })
  .handler(async ({ data }) => {
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keySecret) return { paid: false as const };
    const expected = await hmacSha256Hex(keySecret, `${data.razorpayOrderId}|${data.razorpayPaymentId}`);
    if (!timingSafeEqualHex(expected, data.signature)) return { paid: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, razorpay_order_id, payment_status")
      .eq("id", data.orderId)
      .eq("cancel_token", data.token)
      .maybeSingle();
    if (!order || order.razorpay_order_id !== data.razorpayOrderId || order.payment_status !== "pending_payment") {
      return { paid: false as const };
    }
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", razorpay_payment_id: data.razorpayPaymentId })
      .eq("id", order.id)
      .eq("payment_status", "pending_payment");
    if (error) return { paid: false as const };
    return { paid: true as const };
  });
