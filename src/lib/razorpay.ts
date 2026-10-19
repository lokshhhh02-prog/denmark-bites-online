import { createRazorpayCheckout, verifyRazorpayPayment } from "./payments.functions";

type RazorpayInstance = { open(): void; on(event: string, handler: (resp: unknown) => void): void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<RazorpayConstructor> | null = null;

function loadRazorpay(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("Payment is only available on the website"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else {
        scriptPromise = null;
        reject(new Error("Payment gateway failed to load"));
      }
    };
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not reach the payment gateway. Check your internet connection."));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type PaymentOutcome =
  | { outcome: "paid" }
  | { outcome: "cancelled" }
  | { outcome: "unconfigured" }
  | { outcome: "failed"; message: string };

// Opens the Razorpay checkout for an order and verifies the payment
// server-side before reporting success.
export async function startRazorpayPayment(input: {
  orderId: string;
  token: string;
  name: string;
  phone: string;
}): Promise<PaymentOutcome> {
  const Razorpay = await loadRazorpay();
  const checkout = await createRazorpayCheckout({ data: { orderId: input.orderId, token: input.token } });
  if (!checkout.configured) return { outcome: "unconfigured" };
  return new Promise<PaymentOutcome>((resolve) => {
    const rzp = new Razorpay({
      key: checkout.keyId,
      amount: checkout.amount,
      currency: "INR",
      name: "Denmark Restaurant",
      description: `Order #${checkout.orderNumber}`,
      order_id: checkout.razorpayOrderId,
      prefill: { name: input.name, contact: input.phone },
      theme: { color: "#b3401a" },
      handler: async (resp: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
        if (!resp.razorpay_order_id || !resp.razorpay_payment_id || !resp.razorpay_signature) {
          resolve({ outcome: "failed", message: "We could not confirm the payment. Please try again." });
          return;
        }
        const v = await verifyRazorpayPayment({
          data: {
            orderId: input.orderId,
            token: input.token,
            razorpayOrderId: resp.razorpay_order_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          },
        });
        resolve(
          v.paid
            ? { outcome: "paid" }
            : {
                outcome: "failed",
                message:
                  "We could not verify the payment. If money was deducted it will be refunded automatically — please try again or choose cash on delivery.",
              },
        );
      },
      modal: { ondismiss: () => resolve({ outcome: "cancelled" }) },
    });
    rzp.on("payment.failed", () => resolve({ outcome: "failed", message: "The payment failed. Please try again or choose cash on delivery." }));
    rzp.open();
  });
}

// Human-readable payment state for bills, badges and order pages.
export function paymentLabel(method: string | null | undefined, status: string | null | undefined, orderType?: string): string {
  if (method === "online") return status === "paid" ? "Paid online" : "Payment pending";
  return orderType === "dine_in" ? "Pay at restaurant" : "Cash on delivery";
}

export function isUnpaidOnlineOrder(order: { payment_method?: string | null; payment_status?: string | null }): boolean {
  return order.payment_method === "online" && order.payment_status === "pending_payment";
}
