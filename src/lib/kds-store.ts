import { useEffect, useState, useSyncExternalStore } from "react";

export type Station = 1 | 2;

export type Order = {
  id: string;
  number: string;
  station: Station;
  format: string;
  cream: string;
  toppings: string[];
} & (
  | { type: "instore"; createdAt: number }
  | { type: "pickup"; pickupAt: number; fridge: boolean }
);

export type ReadyEntry = { number: string; readyAt: number };

export type KdsState = {
  orders: Order[];
  ready: ReadyEntry[];
};

const STORAGE_KEY = "yllt-kds-state-v1";
const CHANNEL = "yllt-kds";

export const OPTIMAL_MS = 30_000;

function nextSlot(from: number, slotsAhead = 1) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(Math.ceil((m + 1) / 15) * 15 + (slotsAhead - 1) * 15);
  return d.getTime();
}

function seed(): KdsState {
  const now = Date.now();
  const slot1 = nextSlot(now, 1);
  const slot2 = nextSlot(now, 2);
  return {
    orders: [
      {
        id: "o7",
        number: "07",
        station: 1,
        type: "instore",
        createdAt: now - 18_000,
        format: "Tarta abierta pequeña",
        cream: "Crema vainilla",
        toppings: ["Ganache café"],
      },
      {
        id: "o8",
        number: "08",
        station: 1,
        type: "instore",
        createdAt: now - 45_000,
        format: "Cake shake",
        cream: "Crema coulant chocolate",
        toppings: ["Ganache matcha", "Crema de pistacho"],
      },
      {
        id: "o11",
        number: "11",
        station: 1,
        type: "instore",
        createdAt: now - 8_000,
        format: "Tarta abierta pequeña",
        cream: "Crema lemon curd",
        toppings: ["Mermelada de fresa"],
      },
      {
        id: "o9",
        number: "09",
        station: 1,
        type: "pickup",
        pickupAt: slot1,
        fridge: true,
        format: "Tarta en lata pequeña",
        cream: "Crema NY cheesecake",
        toppings: ["Mermelada de fresa"],
      },
      {
        id: "o13",
        number: "13",
        station: 1,
        type: "pickup",
        pickupAt: slot2,
        fridge: false,
        format: "Tarta abierta pequeña",
        cream: "Crema basque cheesecake",
        toppings: ["Crema de nuez"],
      },
      {
        id: "o14",
        number: "14",
        station: 1,
        type: "pickup",
        pickupAt: slot2,
        fridge: false,
        format: "Cake shake",
        cream: "Crema vainilla",
        toppings: ["Ganache frambuesa", "Crema avellana"],
      },
    ],
    ready: [],
  };
}

let state: KdsState | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function load(): KdsState {
  if (typeof window === "undefined") return { orders: [], ready: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as KdsState;
  } catch {
    /* ignore */
  }
  const s = seed();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}

function ensure(): KdsState {
  if (!state) {
    state = load();
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (e) => {
        state = e.data as KdsState;
        listeners.forEach((l) => l());
      };
    }
  }
  return state;
}

function commit(next: KdsState, broadcast = true) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (broadcast) channel?.postMessage(next);
  listeners.forEach((l) => l());
}

const EMPTY: KdsState = { orders: [], ready: [] };

export function useKds(): KdsState {
  return useSyncExternalStore(
    (cb) => {
      ensure();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ensure(),
    () => EMPTY,
  );
}

export function markReady(id: string) {
  const s = ensure();
  const order = s.orders.find((o) => o.id === id);
  if (!order) return;
  commit({
    orders: s.orders.filter((o) => o.id !== id),
    ready: [{ number: order.number, readyAt: Date.now() }, ...s.ready].slice(0, 8),
  });
}

export function markFridge(id: string) {
  const s = ensure();
  commit({
    ...s,
    orders: s.orders.map((o) =>
      o.id === id && o.type === "pickup" ? { ...o, fridge: true } : o,
    ),
  });
}

export function releasePickup(id: string) {
  markReady(id);
}

export function resetKds() {
  commit(seed());
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function slotOf(ts: number) {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
  return d.getTime();
}
