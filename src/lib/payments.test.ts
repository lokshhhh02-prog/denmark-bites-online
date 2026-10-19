import { describe, expect, it } from "vitest";
import { isUnpaidOnlineOrder, paymentLabel } from "./razorpay";

describe("paymentLabel", () => {
  it("shows paid online orders as paid", () => {
    expect(paymentLabel("online", "paid")).toBe("Paid online");
  });

  it("shows unfinished online payments as pending", () => {
    expect(paymentLabel("online", "pending_payment")).toBe("Payment pending");
  });

  it("labels delivery cash orders as cash on delivery", () => {
    expect(paymentLabel("cash_on_delivery", "cod_pending", "delivery")).toBe("Cash on delivery");
  });

  it("labels dine-in cash orders as pay at restaurant", () => {
    expect(paymentLabel("cash_on_delivery", "cod_pending", "dine_in")).toBe("Pay at restaurant");
  });
});

describe("isUnpaidOnlineOrder", () => {
  it("is true only for online orders still awaiting payment", () => {
    expect(isUnpaidOnlineOrder({ payment_method: "online", payment_status: "pending_payment" })).toBe(true);
    expect(isUnpaidOnlineOrder({ payment_method: "online", payment_status: "paid" })).toBe(false);
    expect(isUnpaidOnlineOrder({ payment_method: "cash_on_delivery", payment_status: "cod_pending" })).toBe(false);
  });
});
