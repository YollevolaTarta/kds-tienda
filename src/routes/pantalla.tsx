import { createFileRoute } from "@tanstack/react-router";
import {
  PEDIDO_COLS,
  STORE,
  formatClock,
  pedidoLabel,
  supabaseAnon as supabase,
  todayRange,
  useNow,
  useRealtime,
  type Pedido,
} from "@/lib/kds";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PickupScreen,
});

async function load() {
  const { start, end } = todayRange();
  const [prep, listos] = await Promise.all([
    supabase
      .from("pedidos")
      .select(PEDIDO_COLS)
      .eq("store_id", STORE)
      .eq("tipo_pedido", "en_tienda")
      .eq("estado", "preparando")
      .order("cogido_at"),
    supabase
      .from("pedidos")
      .select(PEDIDO_COLS)
      .eq("store_id", STORE)
      .or(
        `and(tipo_pedido.eq.en_tienda,estado.eq.listo),and(tipo_pedido.eq.recoger,estado.eq.en_nevera,franja_recogida.gte.${start},franja_recogida.lt.${end})`,
      ),
  ]);
  if (prep.error) throw prep.error;
  if (listos.error) throw listos.error;
  return {
    prep: (prep.data ?? []) as Pedido[],
    listos: (listos.data ?? []) as Pedido[],
  };
}

function PickupScreen() {
  const { data } = useRealtime(load, { prep: [], listos: [] }, supabase);
  const now = useNow();

  const ready = data.listos
    .filter((p) => {
      if (p.tipo_pedido === "en_tienda")
        return p.listo_at && now - new Date(p.listo_at).getTime() < 5 * 60_000;
      return p.franja_recogida && new Date(p.franja_recogida).getTime() - now <= 5 * 60_000;
    })
    .sort((a, b) => (b.listo_at ?? "").localeCompare(a.listo_at ?? ""));

  return (
    <main className="grid min-h-screen grid-cols-2 bg-black text-center">
      <div className="absolute top-6 left-8 text-sm font-semibold tracking-[0.2em] text-brand uppercase">
        Yo Llevo la Tarta
      </div>
      <div className="absolute top-6 right-8 text-xl font-bold tabular-nums text-white/40">
        {formatClock(now)}
      </div>
      <h1 className="sr-only">Estado de los pedidos</h1>

      <section className="flex flex-col items-center border-r border-white/10 px-8 pt-24">
        <h2 className="text-5xl font-black tracking-wide text-white/60">PREPARANDO</h2>
        <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-6">
          {data.prep.map((p) => (
            <span key={p.id} className="text-[7rem] leading-none font-black text-white/70 tabular-nums">
              {pedidoLabel(p)}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center px-8 pt-24">
        <h2 className="text-5xl font-black tracking-wide text-brand">LISTO</h2>
        <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-6">
          {ready.map((p) => (
            <span key={p.id} className="text-[9rem] leading-none font-black text-brand tabular-nums">
              {pedidoLabel(p)}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
