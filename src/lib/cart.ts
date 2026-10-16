import { useSyncExternalStore } from "react";

export type CartLine = { id: string; name: string; price: number; qty: number };
type CartState = { branch: number; lines: CartLine[] };

const KEY = "denmark-cart";
let state: CartState = { branch: 1, lines: [] };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
function emit(next: CartState) {
  state = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

const EMPTY: CartState = { branch: 1, lines: [] };

export function useCart() {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      cb();
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}

export const cart = {
  setBranch(branch: number) {
    load();
    if (state.branch !== branch) emit({ branch, lines: [] });
  },
  add(item: Omit<CartLine, "qty">) {
    load();
    const existing = state.lines.find((l) => l.id === item.id);
    emit({
      ...state,
      lines: existing
        ? state.lines.map((l) => (l.id === item.id ? { ...l, qty: Math.min(50, l.qty + 1) } : l))
        : [...state.lines, { ...item, qty: 1 }],
    });
  },
  dec(id: string) {
    emit({
      ...state,
      lines: state.lines.map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0),
    });
  },
  remove(id: string) {
    emit({ ...state, lines: state.lines.filter((l) => l.id !== id) });
  },
  clear() {
    emit({ ...state, lines: [] });
  },
};

export const inr = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function computeTotals(subtotal: number, gstPercent: number, packing: number, delivery: boolean) {
  const gst = Math.round(subtotal * gstPercent) / 100;
  const pack = delivery ? packing : 0;
  return { subtotal, gst, pack, total: subtotal + gst + pack };
}
