import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LINEA_COLS,
  OPTIMAL_MS,
  PEDIDO_COLS,
  STORE,
  formatClock,
  formatoLabel,
  pedidoLabel,
  supabase,
  todayRange,
  useNow,
  useRealtime,
  type Linea,
  type Pedido,
} from "@/lib/kds";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KDS Cocina · Yo Llevo la Tarta" },
      {
        name: "description",
        content:
          "Pantalla de cocina para gestionar pedidos en tienda y online de Yo Llevo la Tarta.",
      },
      { property: "og:title", content: "KDS Cocina · Yo Llevo la Tarta" },
      {
        property: "og:description",
        content: "Pedidos en tienda y online, en una sola pantalla táctil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KdsPage,
});

const STATION_KEY = "yllt-kds-estacion";
type Cola = "tienda" | "online";

function KdsPage() {
  const [station, setStation] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = Number(window.localStorage.getItem(STATION_KEY));
    if (v === 1 || v === 2) setStation(v);
    setReady(true);
  }, []);
  const choose = (n: number | null) => {
    if (n) window.localStorage.setItem(STATION_KEY, String(n));
    else window.localStorage.removeItem(STATION_KEY);
    setStation(n);
  };
  if (!ready) return <main className="min-h-screen bg-background" />;
  if (!station) return <StationPicker onPick={choose} />;
  return <KdsScreen station={station} onChangeStation={() => choose(null)} />;
}

function StationPicker({ onPick }: { onPick: (n: number) => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background text-foreground">
      <div className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
        Yo Llevo la Tarta
      </div>
      <h1 className="text-5xl font-black">¿Qué estación es esta?</h1>
      <div className="flex gap-8">
        {[1, 2].map((n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className="rounded-3xl bg-brand px-20 py-12 text-6xl font-black text-black active:scale-[0.99]"
          >
            {n}
          </button>
        ))}
      </div>
    </main>
  );
}

type Data = {
  mine: Pedido | null;
  countTienda: number;
  countOnline: number;
  alert: Pedido[];
  entregar: Pedido[];
};

const EMPTY: Data = { mine: null, countTienda: 0, countOnline: 0, alert: [], entregar: [] };

function colaOf(p: Pedido): Cola {
  return p.tipo_pedido === "en_tienda" ? "tienda" : "online";
}

function KdsScreen({ station, onChangeStation }: { station: number; onChangeStation: () => void }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, error, refresh } = useRealtime<Data>(async () => {
    const { start, end, date } = todayRange();
    const soon = new Date(Date.now() + 15 * 60_000).toISOString();
    const base = () =>
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("store_id", STORE)
        .eq("pago", "pagado")
        .eq("estado", "pendiente")
        .is("estacion", null);

    const [mine, ct, co, al, en] = await Promise.all([
      supabase
        .from("pedidos")
        .select(`${PEDIDO_COLS},lineas_pedido(${LINEA_COLS})`)
        .eq("store_id", STORE)
        .eq("estado", "preparando")
        .eq("estacion", station)
        .order("cogido_at")
        .limit(1),
      base().eq("tipo_pedido", "en_tienda"),
      base()
        .neq("tipo_pedido", "en_tienda")
        .or(
          `fecha_envio.eq.${date},and(franja_recogida.gte.${start},franja_recogida.lt.${end})`,
        ),
      supabase
        .from("pedidos")
        .select(PEDIDO_COLS)
        .eq("store_id", STORE)
        .eq("tipo_pedido", "recogida")
        .in("estado", ["pendiente"])
        .gte("franja_recogida", start)
        .lte("franja_recogida", soon)
        .order("franja_recogida"),
      supabase
        .from("pedidos")
        .select(PEDIDO_COLS)
        .eq("store_id", STORE)
        .eq("tipo_pedido", "recogida")
        .eq("estado", "listo")
        .order("franja_recogida"),
    ]);
    for (const r of [mine, ct, co, al, en]) if (r.error) throw r.error;
    return {
      mine: ((mine.data ?? [])[0] as unknown as Pedido) ?? null,
      countTienda: ct.count ?? 0,
      countOnline: co.count ?? 0,
      alert: (al.data ?? []) as Pedido[],
      entregar: (en.data ?? []) as Pedido[],
    };
  }, EMPTY);

  async function run(fn: () => PromiseLike<{ error: unknown; data?: unknown }>, empty?: string) {
    setBusy(true);
    setMsg(null);
    const { error, data } = await fn();
    if (error) setMsg(`Error: ${(error as { message?: string }).message ?? "desconocido"}`);
    else if (empty && data == null) setMsg(empty);
    await refresh();
    setBusy(false);
  }

  const coger = (cola: Cola) =>
    run(
      () =>
        supabase.rpc("coger_siguiente_pedido", {
          p_store: STORE,
          p_estacion: station,
          p_cola: cola,
        }),
      "No hay pedidos en esa cola",
    );
  const listo = (id: Pedido["id"]) =>
    run(() => supabase.from("pedidos").update({ estado: "listo" }).eq("id", id));
  const soltar = (id: Pedido["id"]) =>
    run(() => supabase.rpc("soltar_pedido", { p_pedido_id: id }));
  const entregado = (id: Pedido["id"]) =>
    run(() => supabase.from("pedidos").update({ estado: "entregado" }).eq("id", id));

  const mineCola = data.mine ? colaOf(data.mine) : null;

  const column = (cola: Cola) => {
    const title = cola === "tienda" ? "TIENDA" : "ONLINE";
    const count = cola === "tienda" ? data.countTienda : data.countOnline;
    return (
      <section
        className={`rounded-3xl border bg-surface p-5 ${
          cola === "online" ? "border-brand/40" : "border-white/10"
        }`}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2
            className={`text-3xl font-black tracking-tight ${cola === "online" ? "text-brand" : ""}`}
          >
            {title}
          </h2>
          <span className="text-xl text-foreground/60 tabular-nums">{count} en cola</span>
        </div>

        {cola === "online" && data.alert.length > 0 && (
          <div className="mb-4 animate-pulse rounded-2xl border-4 border-alert bg-alert/20 p-4 text-center">
            <div className="text-3xl font-black text-alert">¡RECOGIDA EN MENOS DE 15 MIN!</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {data.alert
                .map((p) => `${pedidoLabel(p)} · ${formatClock(p.franja_recogida!)}`)
                .join("   ")}
            </div>
          </div>
        )}

        {data.mine && mineCola === cola ? (
          <OrderCard
            order={data.mine}
            now={now}
            busy={busy}
            onListo={() => listo(data.mine!.id)}
            onSoltar={() => soltar(data.mine!.id)}
          />
        ) : (
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-surface-2 p-8">
            <div className="text-center">
              <div className="text-7xl font-black tabular-nums">{count}</div>
              <div className="text-xl text-foreground/60">pedidos esperando</div>
            </div>
            <button
              disabled={busy || !!data.mine}
              onClick={() => coger(cola)}
              className={`w-full rounded-xl py-8 text-4xl font-black tracking-wide text-black active:scale-[0.99] disabled:opacity-30 ${
                cola === "online" ? "bg-brand" : "bg-ok"
              }`}
            >
              COGER SIGUIENTE
            </button>
          </div>
        )}

        {cola === "online" && data.entregar.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-xl font-bold text-foreground/70">En nevera · para entregar</h3>
            <div className="flex flex-col gap-3">
              {data.entregar.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/15 px-4 py-3"
                >
                  <span className="text-3xl font-black tabular-nums">{pedidoLabel(p)}</span>
                  <span className="text-xl text-brand tabular-nums">
                    {p.franja_recogida ? formatClock(p.franja_recogida) : ""}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => entregado(p.id)}
                    className="rounded-lg bg-brand px-5 py-3 text-lg font-bold text-black disabled:opacity-40"
                  >
                    ENTREGADO
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="min-h-screen bg-background px-6 py-4 text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          Yo Llevo la Tarta
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onChangeStation} className="text-sm text-foreground/40 underline-offset-4 hover:underline">
            Estación {station} · cambiar
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

      {(msg || error) && (
        <div className="mb-4 rounded-xl border border-white/15 bg-surface-2 px-4 py-3 text-lg text-foreground/80">
          {msg ?? `Sin conexión con la base: ${error}`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {column("tienda")}
        {column("online")}
      </div>
    </main>
  );
}

function groupLines(lines: Linea[]) {
  const groups: { pack: string | null; lines: Linea[] }[] = [];
  const byPack = new Map<string, { pack: string | null; lines: Linea[] }>();
  for (const l of lines) {
    if (l.pack_grupo == null) {
      groups.push({ pack: null, lines: [l] });
      continue;
    }
    const k = String(l.pack_grupo);
    let g = byPack.get(k);
    if (!g) {
      g = { pack: l.packs?.nombre ?? "Pack", lines: [] };
      byPack.set(k, g);
      groups.push(g);
    }
    g.lines.push(l);
  }
  return groups;
}

function LineaView({ l }: { l: Linea }) {
  const receta = l.recetas?.nombre ?? (typeof l.receta === "string" ? l.receta : null);
  const toppings = [l.topping_1, l.topping_2].filter(Boolean).join(" + ");
  return (
    <div className="text-[1.35rem] leading-tight text-foreground/90">
      <div className="font-semibold">{formatoLabel(l.formato)}</div>
      <div className="text-foreground/70">{receta ?? l.crema}</div>
      {toppings && <div className="text-foreground/70">{toppings}</div>}
      {l.foto && (
        <div className="mt-2 animate-pulse rounded-xl border-4 border-warn bg-warn/20 px-3 py-2 text-center text-2xl font-black text-warn">
          ★ DECORACIÓN SORPRESA · la eliges tú ★
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  now,
  busy,
  onListo,
  onSoltar,
}: {
  order: Pedido;
  now: number;
  busy: boolean;
  onListo: () => void;
  onSoltar: () => void;
}) {
  const isTienda = order.tipo_pedido === "en_tienda";
  const lines = order.lineas_pedido ?? [];
  const groups = groupLines(lines);

  let right: React.ReactNode = null;
  let bar: React.ReactNode = null;
  if (isTienda) {
    const from = order.cogido_at ? new Date(order.cogido_at).getTime() : now;
    const elapsed = Math.max(0, Math.floor((now - from) / 1000));
    const ratio = Math.min(1, (elapsed * 1000) / OPTIMAL_MS);
    const tone = elapsed > 30 ? "alert" : elapsed >= 22 ? "warn" : "ok";
    const toneText = tone === "alert" ? "text-alert" : tone === "warn" ? "text-warn" : "text-ok";
    const toneBg = tone === "alert" ? "bg-alert" : tone === "warn" ? "bg-warn" : "bg-ok";
    right = (
      <div className={`text-3xl font-bold tabular-nums ${toneText}`}>{elapsed}s / 30s</div>
    );
    bar = (
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${toneBg}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    );
  } else if (order.franja_recogida) {
    const mins = Math.round((new Date(order.franja_recogida).getTime() - now) / 60000);
    right = (
      <div className="text-right">
        <div className="text-3xl font-bold tabular-nums text-brand">
          {formatClock(order.franja_recogida)}
        </div>
        <div className={`text-xl tabular-nums ${mins < 0 ? "text-alert" : "text-foreground/70"}`}>
          {mins < 0 ? `hace ${Math.abs(mins)} min` : `en ${mins} min`}
        </div>
      </div>
    );
  } else {
    right = (
      <div className="rounded-lg border-2 border-brand px-3 py-1 text-2xl font-black text-brand">
        ENVÍO
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-6xl font-black tracking-tight">{pedidoLabel(order)}</div>
        {right}
      </div>
      <div className="mt-3 flex flex-col gap-4">
        {groups.map((g, i) =>
          g.pack ? (
            <div key={i} className="rounded-xl border border-brand/40 p-3">
              <div className="mb-2 text-lg font-bold tracking-wide text-brand uppercase">
                {g.pack}
              </div>
              <div className="flex flex-col gap-3">
                {g.lines.map((l) => (
                  <LineaView key={l.id} l={l} />
                ))}
              </div>
            </div>
          ) : (
            <LineaView key={i} l={g.lines[0]} />
          ),
        )}
        {lines.length === 0 && <div className="text-foreground/50">Sin líneas</div>}
      </div>
      {bar}
      <button
        disabled={busy}
        onClick={onListo}
        className="mt-4 w-full rounded-xl bg-ok py-5 text-3xl font-black tracking-wide text-black active:scale-[0.99] disabled:opacity-40"
      >
        LISTO
      </button>
      <button
        disabled={busy}
        onClick={onSoltar}
        className="mt-3 w-full text-center text-sm text-foreground/40 underline-offset-4 hover:underline"
      >
        Devolver a la cola
      </button>
    </div>
  );
}
