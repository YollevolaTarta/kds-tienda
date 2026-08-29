import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OPTIMAL_MS,
  formatClock,
  markFridge,
  markReady,
  resetKds,
  slotOf,
  useKds,
  useNow,
  type Order,
} from "@/lib/kds-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KDS Cocina · Yo Llevo la Tarta" },
      {
        name: "description",
        content:
          "Pantalla de cocina para gestionar pedidos en tienda y para recoger de Yo Llevo la Tarta.",
      },
      { property: "og:title", content: "KDS Cocina · Yo Llevo la Tarta" },
      {
        property: "og:description",
        content: "Pedidos en tienda y para recoger, en una sola pantalla táctil.",
      },
    ],
  }),
  component: KdsScreen,
});

const STATION: 1 | 2 = 1;

function Detail({ order }: { order: Order }) {
  return (
    <div className="text-[1.35rem] leading-tight text-foreground/90">
      <div className="font-semibold">{order.format}</div>
      <div className="text-foreground/70">{order.cream}</div>
      <div className="text-foreground/70">{order.toppings.join(" + ")}</div>
    </div>
  );
}

function InStoreCard({ order, now }: { order: Order & { type: "instore" }; now: number }) {
  const elapsed = Math.max(0, Math.floor((now - order.createdAt) / 1000));
  const ratio = Math.min(1, (elapsed * 1000) / OPTIMAL_MS);
  const tone =
    elapsed > 30 ? "alert" : elapsed >= 22 ? "warn" : ("ok" as "alert" | "warn" | "ok");
  const toneText =
    tone === "alert" ? "text-alert" : tone === "warn" ? "text-warn" : "text-ok";
  const toneBg = tone === "alert" ? "bg-alert" : tone === "warn" ? "bg-warn" : "bg-ok";

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-6xl font-black tracking-tight">#{order.number}</div>
        <div className={`text-3xl font-bold tabular-nums ${toneText}`}>
          {elapsed}s / 30s
        </div>
      </div>
      <div className="mt-3">
        <Detail order={order} />
      </div>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${toneBg}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <button
        onClick={() => markReady(order.id)}
        className="mt-4 w-full rounded-xl bg-ok py-5 text-3xl font-black tracking-wide text-black active:scale-[0.99]"
      >
        LISTO
      </button>
    </div>
  );
}

function PickupCard({ order, now }: { order: Order & { type: "pickup" }; now: number }) {
  const minsLeft = Math.round((order.pickupAt - now) / 60000);
  const late = minsLeft < 0;
  return (
    <div
      className={`rounded-2xl border p-5 ${
        order.fridge
          ? "border-white/10 bg-surface opacity-60"
          : "border-brand/60 bg-surface-2"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="text-6xl font-black tracking-tight">#{order.number}</div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-brand">
            {formatClock(order.pickupAt)}
          </div>
          <div className={`text-xl tabular-nums ${late ? "text-alert" : "text-foreground/70"}`}>
            {late ? `hace ${Math.abs(minsLeft)} min` : `en ${minsLeft} min`}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Detail order={order} />
      </div>
      {order.fridge ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/15 px-4 py-4">
          <span className="text-2xl font-bold text-foreground/70">EN NEVERA</span>
          <button
            onClick={() => markReady(order.id)}
            className="rounded-lg bg-brand px-4 py-2 text-lg font-bold text-black"
          >
            ENTREGAR
          </button>
        </div>
      ) : (
        <button
          onClick={() => markFridge(order.id)}
          className="mt-4 w-full rounded-xl bg-brand py-5 text-3xl font-black tracking-wide text-black active:scale-[0.99]"
        >
          PREPARADO
        </button>
      )}
    </div>
  );
}

function KdsScreen() {
  const { orders } = useKds();
  const now = useNow();
  const [alertSlot, setAlertSlot] = useState<number | null>(null);
  const lastSlot = useRef<number | null>(null);

  const mine = orders.filter((o) => o.station === STATION);
  const inStore = useMemo(
    () =>
      mine
        .filter((o): o is Order & { type: "instore" } => o.type === "instore")
        .sort((a, b) => a.createdAt - b.createdAt),
    [mine],
  );
  const pickup = useMemo(
    () =>
      mine
        .filter((o): o is Order & { type: "pickup" } => o.type === "pickup")
        .sort((a, b) => a.pickupAt - b.pickupAt),
    [mine],
  );

  const currentSlot = slotOf(now);
  useEffect(() => {
    if (lastSlot.current === null) {
      lastSlot.current = currentSlot;
      return;
    }
    if (lastSlot.current !== currentSlot) {
      lastSlot.current = currentSlot;
      const hits = pickup.filter((o) => slotOf(o.pickupAt) === currentSlot);
      if (hits.length > 0) setAlertSlot(currentSlot);
    }
  }, [currentSlot, pickup]);

  const alertOrders = alertSlot
    ? pickup.filter((o) => slotOf(o.pickupAt) === alertSlot)
    : [];

  return (
    <main className="min-h-screen bg-background px-6 py-4 text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          Yo Llevo la Tarta
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/50">Estación {STATION}</span>
          <button
            onClick={resetKds}
            className="rounded-md border border-white/15 px-3 py-1 text-sm text-foreground/60"
          >
            Reiniciar demo
          </button>
          <Link
            to="/pantalla"
            className="rounded-md border border-brand/50 px-3 py-1 text-sm text-brand"
          >
            Pantalla de recogida
          </Link>
          <span className="text-2xl font-bold tabular-nums">{formatClock(now)}</span>
        </div>
      </header>

      <h1 className="sr-only">Kitchen Display System — Yo Llevo la Tarta</h1>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-3xl border border-white/10 bg-surface p-5">
          <h2 className="mb-4 text-3xl font-black tracking-tight">En tienda</h2>
          <div className="flex flex-col gap-4">
            {inStore.map((o) => (
              <InStoreCard key={o.id} order={o} now={now} />
            ))}
            {inStore.length === 0 && (
              <p className="text-xl text-foreground/40">Sin pedidos en tienda</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-brand/40 bg-surface p-5">
          <h2 className="mb-4 text-3xl font-black tracking-tight text-brand">
            Para recoger
          </h2>
          <div className="flex flex-col gap-4">
            {pickup.map((o) => (
              <PickupCard key={o.id} order={o} now={now} />
            ))}
            {pickup.length === 0 && (
              <p className="text-xl text-foreground/40">Sin pedidos de recogida</p>
            )}
          </div>
        </section>
      </div>

      {alertSlot && alertOrders.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8">
          <div className="w-full max-w-2xl rounded-3xl border-4 border-brand bg-surface-2 p-10 text-center">
            <div className="text-4xl font-black text-brand">
              Pedidos para las {formatClock(alertSlot)}
            </div>
            <div className="mt-6 text-7xl font-black tabular-nums">
              {alertOrders.map((o) => `#${o.number}`).join(" · ")}
            </div>
            <button
              onClick={() => setAlertSlot(null)}
              className="mt-8 w-full rounded-xl bg-brand py-5 text-3xl font-black text-black"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
