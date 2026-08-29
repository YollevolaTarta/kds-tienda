import { createFileRoute } from "@tanstack/react-router";
import { formatClock, useKds, useNow } from "@/lib/kds-store";

export const Route = createFileRoute("/pantalla")({
  head: () => ({
    meta: [
      { title: "Pedidos listos · Yo Llevo la Tarta" },
      {
        name: "description",
        content: "Pantalla de recogida con los números de pedido listos para recoger.",
      },
      { property: "og:title", content: "Pedidos listos · Yo Llevo la Tarta" },
      {
        property: "og:description",
        content: "Números de pedido listos para recoger en Yo Llevo la Tarta.",
      },
    ],
  }),
  component: PickupScreen,
});

const VISIBLE_MS = 3 * 60 * 1000;

function PickupScreen() {
  const { ready } = useKds();
  const now = useNow();
  const visible = ready.filter((r) => now - r.readyAt < VISIBLE_MS).slice(0, 6);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-10 text-center">
      <div className="absolute top-6 left-8 text-sm font-semibold tracking-[0.2em] text-brand uppercase">
        Yo Llevo la Tarta
      </div>
      <div className="absolute top-6 right-8 text-xl font-bold tabular-nums text-white/40">
        {formatClock(now)}
      </div>

      {visible.length > 0 ? (
        <>
          <h1 className="text-4xl font-bold tracking-wide text-white/70">
            Tu pedido está listo
          </h1>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {visible.map((r) => (
              <span
                key={r.number + r.readyAt}
                className="text-[9rem] leading-none font-black text-brand tabular-nums"
              >
                #{r.number}
              </span>
            ))}
          </div>
        </>
      ) : (
        <h1 className="text-5xl font-bold text-white/25">Preparando pedidos…</h1>
      )}
    </main>
  );
}
