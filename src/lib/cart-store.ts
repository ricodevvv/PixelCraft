"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  maxQuantity: number;
};

export type Player = { name: string; uuid: string | null };

type State = { items: CartItem[]; player: Player | null; coupon: string };

const KEY = "pixelcraft:cart:v1";
const EMPTY: State = { items: [], player: null, coupon: "" };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    state = EMPTY;
  }
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  load();
  return state;
}

/**
 * Cart, player and coupon, kept in localStorage and shared across tabs.
 */
export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const cart = {
  add(item: Omit<CartItem, "quantity">, quantity = 1) {
    const existing = state.items.find((entry) => entry.productId === item.productId);
    const items = existing
      ? state.items.map((entry) =>
          entry.productId === item.productId
            ? { ...entry, ...item, quantity: Math.min(entry.quantity + quantity, item.maxQuantity) }
            : entry,
        )
      : [...state.items, { ...item, quantity: Math.min(quantity, item.maxQuantity) }];
    commit({ ...state, items });
  },
  setQuantity(productId: number, quantity: number) {
    const items = state.items
      .map((entry) =>
        entry.productId === productId ? { ...entry, quantity: Math.min(quantity, entry.maxQuantity) } : entry,
      )
      .filter((entry) => entry.quantity > 0);
    commit({ ...state, items });
  },
  remove(productId: number) {
    commit({ ...state, items: state.items.filter((entry) => entry.productId !== productId) });
  },
  clear() {
    commit({ ...state, items: [], coupon: "" });
  },
  setPlayer(player: Player | null) {
    commit({ ...state, player });
  },
  setCoupon(coupon: string) {
    commit({ ...state, coupon });
  },
};
