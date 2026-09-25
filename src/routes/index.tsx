import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StockTab } from "@/components/StockTab";
import {
  LINEA_COLS,
  OPTIMAL_MS,
  PEDIDO_COLS,
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

type Auth = { status: "loading" } | { status: "out" } | { status: "in"; store: string | null };

function KdsPage() {
  const [auth, setAuth] = useState<Auth>({ status: "loading" });
  useEffect(() => {
    const apply = (session: { user: { app_metadata?: Record<string, unknown> } } | null) => {
      if (!session) return setAuth({ status: "out" });
      const s = session.user.app_metadata?.["store_id"];
      setAuth({ status: "in", store: typeof s === "string" && s ? s : null });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (auth.status === "loading") return <main className="min-h-screen bg-background" />;
  if (auth.status === "out") return <LoginScreen />;
  if (!auth.store) return <NoStore />;
  return <KdsWithStation store={auth.store} />;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
    setBusy(false);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">
      <div className="text-sm font-semibold tracking-[0.2em] text-brand-strong uppercase"><span className="mr-2 inline-block size-2 rounded-full bg-brand" />Yo Llevo la Tarta</div>
      <h1 className="mt-6 text-5xl font-bold">Empezar turno</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input
          type="email"
          autoComplete="username"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-input bg-surface px-5 py-4 text-2xl text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-input bg-surface px-5 py-4 text-2xl text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        {err && <div className="rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">{err}</div>}
        <button
          disabled={busy}
          className="rounded-xl bg-brand py-6 text-3xl font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-40"
        >
          ENTRAR
        </button>
      </form>
      </div>
    </main>
  );
}

function NoStore() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center text-foreground">
      <div className="rounded-3xl border border-alert/40 bg-surface p-8 text-3xl font-bold shadow-sm">
        Esta cuenta no tiene tienda asignada.
        <div className="mt-2 text-xl font-semibold">Pide al responsable que te asigne una tienda.</div>
      </div>
      <button
        onClick={() => supabase.auth.signOut()}
        className="rounded-xl border border-border bg-surface px-6 py-3 text-xl"
      >
        Volver al login
      </button>
    </main>
  );
}

function KdsWithStation({ store }: { store: string }) {
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
  return <KdsScreen store={store} station={station} onChangeStation={() => choose(null)} />;
}

function StationPicker({ onPick }: { onPick: (n: number) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
      <div className="text-sm font-semibold tracking-[0.2em] text-brand-strong uppercase">
        <span className="mr-2 inline-block size-2 rounded-full bg-brand" />
        Yo Llevo la Tarta
      </div>
      <h1 className="mt-8 text-5xl font-bold">¿Qué estación es esta?</h1>
      <div className="mt-10 flex gap-8">
        {[1, 2].map((n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className="rounded-3xl bg-brand-soft px-20 py-12 text-6xl font-bold text-foreground ring-1 ring-brand/40 active:scale-[0.99]"
          >
            {n}
          </button>
        ))}
      </div>
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

function KdsScreen({
  store,
  station,
  onChangeStation,
}: {
  store: string;
  station: number;
  onChangeStation: () => void;
}) {
  const now = useNow();
  const [tab, setTab] = useState<"cocina" | "stock">("cocina");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { data: avisosSinConfirmar, refresh: refreshAvisos } = useRealtime<number>(
    async () => {
      const r = await supabase
        .from("v_tienda_avisos_stock")
        .select("elaboracion_id", { count: "exact", head: true })
        .eq("ya_agotado", false);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
    0,
    supabase,
    ["traspasos", "traspaso_lineas"],
  );

  const { data, error, refresh } = useRealtime<Data>(async () => {
    const { start, end, date } = todayRange();
    const soon = new Date(Date.now() + 15 * 60_000).toISOString();
    const base = () =>
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store)
        .eq("pago", "pagado")
        .eq("estado", "pendiente")
        .is("estacion", null);

    const [mine, ct, co, al, en] = await Promise.all([
      supabase
        .from("pedidos")
        .select(`${PEDIDO_COLS},lineas_pedido(${LINEA_COLS})`)
        .eq("store_id", store)
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
        .eq("store_id", store)
        .eq("tipo_pedido", "recoger")
        .in("estado", ["pendiente"])
        .gte("franja_recogida", start)
        .lte("franja_recogida", soon)
        .order("franja_recogida"),
      supabase
        .from("pedidos")
        .select(PEDIDO_COLS)
        .eq("store_id", store)
        .in("tipo_pedido", ["recoger", "envio"])
        .eq("estado", "en_nevera")
        .or(
          `and(tipo_pedido.eq.envio,fecha_envio.eq.${date}),and(tipo_pedido.eq.recoger,franja_recogida.gte.${start},franja_recogida.lt.${end})`,
        )
        .order("numero_pedido"),
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
          p_store: store,
          p_estacion: station,
          p_cola: cola,
        }),
      "No hay pedidos en esa cola",
    );
  const terminar = (o: Pedido) =>
    run(() =>
      supabase
        .from("pedidos")
        .update({ estado: o.tipo_pedido === "en_tienda" ? "listo" : "en_nevera" })
        .eq("id", o.id),
    );
  const [histOpen, setHistOpen] = useState(false);
  const soltar = (id: Pedido["id"]) =>
    run(() => supabase.rpc("soltar_pedido", { p_pedido_id: id }));
  const entregado = (id: Pedido["id"]) =>
    run(() => supabase.from("pedidos").update({ estado: "listo" }).eq("id", id));

  const mineCola = data.mine ? colaOf(data.mine) : null;

  const column = (cola: Cola) => {
    const title = cola === "tienda" ? "TIENDA" : "ONLINE";
    const count = cola === "tienda" ? data.countTienda : data.countOnline;
    return (
      <section
        className={`rounded-3xl border bg-surface p-5 shadow-sm ${
          cola === "online" ? "border-brand/40 border-t-4" : "border-border"
        }`}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2
             className={`text-3xl font-bold tracking-tight ${cola === "online" ? "text-brand-strong" : "text-foreground"}`}
          >
            {title}
          </h2>
          <span className="text-xl text-muted-foreground tabular-nums">{count} en cola</span>
        </div>

        {cola === "online" && data.alert.length > 0 && (
          <div className="mb-4 rounded-2xl border border-alert/40 border-l-[6px] bg-alert-soft p-4 text-center">
            <div className="flex items-center justify-center gap-3 text-3xl font-bold text-alert"><span className="size-3 shrink-0 animate-pulse rounded-full bg-alert" />¡RECOGIDA EN MENOS DE 15 MIN!</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {data.alert
                .map((p) =>
                  `${pedidoLabel(p)} · ${p.franja_recogida ? formatClock(p.franja_recogida) : ""}`,
                )
                .join("   ")}
            </div>
          </div>
        )}

        {data.mine && mineCola === cola ? (
          <OrderCard
            order={data.mine}
            now={now}
            busy={busy}
            onListo={() => data.mine && terminar(data.mine)}
            onSoltar={() => data.mine && soltar(data.mine.id)}
          />
        ) : (
           <div className="flex flex-col items-center gap-6 rounded-2xl bg-surface-2 p-8">
            <div className="text-center">
              <div className="text-7xl font-bold tabular-nums">{count}</div>
              <div className="text-xl text-muted-foreground">pedidos esperando</div>
            </div>
            <button
              disabled={busy || !!data.mine}
              onClick={() => coger(cola)}
              className={`w-full rounded-2xl py-8 text-4xl font-bold tracking-wide active:scale-[0.99] disabled:opacity-40 ${
                cola === "online" ? "bg-brand text-primary-foreground" : "bg-ok text-destructive-foreground"
              }`}
            >
              COGER SIGUIENTE
            </button>
          </div>
        )}

        {cola === "online" && data.entregar.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-xl font-bold text-muted-foreground">En nevera · para entregar</h3>
            <div className="flex flex-col gap-3">
              {data.entregar.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-3xl font-bold tabular-nums">{pedidoLabel(p)}</span>
                    <span className="rounded-md border border-brand/50 bg-brand-soft px-2 py-0.5 text-sm font-bold uppercase">
                      {p.tipo_pedido === "envio" ? "Envío" : "Recogida"}
                    </span>
                  </span>
                  <span className="text-xl text-brand-strong tabular-nums">
                    {p.franja_recogida ? formatClock(p.franja_recogida) : ""}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => entregado(p.id)}
                    className="rounded-xl bg-brand px-5 py-3 text-lg font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-40"
                  >
                    LISTO
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
    <main className="min-h-screen bg-background px-6 pb-6 text-foreground">
      <header className="mb-4 -mx-6 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="text-sm font-semibold tracking-[0.2em] text-brand-strong uppercase">
          <span className="mr-2 inline-block size-2 rounded-full bg-brand" />Yo Llevo la Tarta
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onChangeStation} className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
            Estación {station} · cambiar
          </button>
          <div className="flex rounded-xl bg-muted p-1 text-sm">
            {(["cocina", "stock"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1 font-semibold uppercase ${tab === t ? "border border-border bg-surface text-foreground" : "text-muted-foreground"}`}
              >
                {t === "cocina" ? "Cocina" : "Stock"}
                {t === "stock" && avisosSinConfirmar > 0 && (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-warn px-1.5 py-0.5 text-xs font-bold text-foreground tabular-nums">
                    {avisosSinConfirmar}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setHistOpen((v) => !v)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
          >
            Historial de hoy
          </button>
          <Link
            to="/pantalla"
            className="rounded-xl border border-border px-3 py-2 text-sm text-foreground"
          >
            Pantalla de recogida
          </Link>
          <span className="text-2xl font-semibold tabular-nums">{formatClock(now)}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl border border-alert/40 px-3 py-2 text-sm font-semibold text-alert"
          >
            Cerrar turno
          </button>
        </div>
      </header>

      <h1 className="sr-only">Kitchen Display System — Yo Llevo la Tarta</h1>

      {(msg || error) && (
        <div className="mb-4 rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">
          {msg ?? `Sin conexión con la base: ${error}`}
        </div>
      )}

      {tab === "stock" ? (
        <StockTab onAvisosChanged={refreshAvisos} />
      ) : (
        <>
      {histOpen && (
        <HistoryPanel
          store={store}
          onClose={() => setHistOpen(false)}
          onReopened={async () => {
            setHistOpen(false);
            await refresh();
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-6">
        {column("tienda")}
        {column("online")}
      </div>
        </>
      )}
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
  const isShake = l.formato === "shake";
  const liquidoTxt = l.liquido === "leche" ? "con leche" : "con bebida vegetal";
  const shakeTxt = isShake
    ? l.extra_matcha
      ? `Matcha ${liquidoTxt}`
      : liquidoTxt.charAt(0).toUpperCase() + liquidoTxt.slice(1)
    : null;
  return (
    <div className="rounded-2xl bg-surface-2 p-4 leading-tight text-foreground">
      <div className="text-4xl font-bold">
        {formatoLabel(l.formato)}
        {shakeTxt && ` · ${shakeTxt}`}
      </div>
      <div className="mt-2 text-3xl font-semibold">{receta ?? l.crema}</div>
      {toppings && <div className="mt-2 text-2xl font-medium">{toppings}</div>}
      {l.foto && (
        <div className="mt-2 rounded-xl border border-warn bg-warn-soft px-3 py-2 text-center text-2xl font-bold text-foreground">
          <span className="animate-pulse text-warn">★</span> DECORACIÓN SORPRESA · la eliges tú <span className="animate-pulse text-warn">★</span>
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
      <div className={`text-3xl font-semibold tabular-nums ${toneText}`}>{elapsed}s / 30s</div>
    );
    bar = (
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${toneBg}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    );
  } else if (order.franja_recogida) {
    const mins = Math.round((new Date(order.franja_recogida).getTime() - now) / 60000);
    right = (
      <div className="text-right">
        <div className="text-3xl font-semibold tabular-nums text-brand-strong">
          {formatClock(order.franja_recogida)}
        </div>
        <div className={`text-xl tabular-nums ${mins < 0 ? "text-alert" : "text-muted-foreground"}`}>
          {mins < 0 ? `hace ${Math.abs(mins)} min` : `en ${mins} min`}
        </div>
      </div>
    );
  } else {
    right = (
      <div className="rounded-lg border border-brand/50 bg-brand-soft px-3 py-1 text-2xl font-bold text-foreground">
        ENVÍO
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-6xl font-bold tracking-tight">{pedidoLabel(order)}</div>
        {right}
      </div>
      <div className="mt-3 flex flex-col gap-4">
        {groups.map((g, i) =>
          g.pack ? (
             <div key={i} className="rounded-2xl border border-brand/40 p-3">
               <div className="mb-2 text-lg font-semibold tracking-wide text-brand-strong uppercase">
                {g.pack}
              </div>
              <div className="flex flex-col gap-3">
                {g.lines.map((l) => (
                  <LineaView key={l.id} l={l} />
                ))}
              </div>
            </div>
          ) : (
            g.lines[0] ? <LineaView key={i} l={g.lines[0]} /> : null
          ),
        )}
        {lines.length === 0 && <div className="text-muted-foreground">Sin líneas</div>}
      </div>
      {bar}
      <button
        disabled={busy}
        onClick={onListo}
        className="mt-4 w-full rounded-2xl bg-ok py-5 text-3xl font-bold tracking-wide text-destructive-foreground active:scale-[0.99] disabled:opacity-40"
      >
        {isTienda ? "LISTO" : "EN NEVERA"}
      </button>
      <button
        disabled={busy}
        onClick={onSoltar}
        className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Devolver a la cola
      </button>
    </div>
  );
}

function tipoLabel(t: string) {
  return t === "en_tienda" ? "Tienda" : t === "recoger" ? "Recogida" : t === "envio" ? "Envío" : t;
}

function reabierto(c: unknown) {
  if (c == null) return false;
  if (Array.isArray(c)) return c.length > 0;
  if (typeof c === "object") return Object.keys(c as object).length > 0;
  return String(c).trim() !== "";
}

function matchesSearch(p: Pedido, q: string) {
  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return true;
  const m = t.match(/^([A-Z])?-?0*(\d+)$/);
  if (!m) return pedidoLabel(p).toUpperCase().includes(t);
  if (m[1] && (p.serie ?? "").toUpperCase() !== m[1]) return false;
  return Number(m[2]) === Number(p.numero_pedido);
}

function HistoryPanel({
  store,
  onClose,
  onReopened,
}: {
  store: string;
  onClose: () => void;
  onReopened: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Pedido["id"] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, error } = useRealtime<Pedido[]>(async () => {
    const { start, end } = todayRange();
    const r = await supabase
      .from("pedidos")
      .select(`${PEDIDO_COLS},lineas_pedido(${LINEA_COLS})`)
      .eq("store_id", store)
      .in("estado", ["en_nevera", "listo"])
      .gte("created_at", start)
      .lt("created_at", end);
    if (r.error) throw r.error;
    return (r.data ?? []) as unknown as Pedido[];
  }, []);

  const finishedAt = (p: Pedido) =>
    p.tipo_pedido === "en_tienda" ? p.listo_at : (p.en_nevera_at ?? p.listo_at);
  const byFinishedDesc = (a: Pedido, b: Pedido) =>
    (finishedAt(b) ?? "").localeCompare(finishedAt(a) ?? "");
  const listT = data.filter((p) => p.serie === "T" && matchesSearch(p, q)).sort(byFinishedDesc);
  const listW = data.filter((p) => p.serie !== "T" && matchesSearch(p, q)).sort(byFinishedDesc);
  const order = sel != null ? data.find((p) => p.id === sel) ?? null : null;

  async function reabrir(id: Pedido["id"]) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("reabrir_pedido", { p_pedido_id: id });
    setBusy(false);
    setConfirm(false);
    if (error) setErr(`Error: ${error.message}`);
    else onReopened();
  }

  const finished = (p: Pedido) => {
    const t = p.tipo_pedido === "en_tienda" ? p.listo_at : (p.en_nevera_at ?? p.listo_at);
    return t ? formatClock(t) : "--:--";
  };

  return (
    <div className="mb-4 rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-3xl font-bold">Historial de hoy</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nº (7 o T-07)"
          className="flex-1 rounded-xl border border-input bg-surface px-4 py-3 text-2xl text-foreground outline-none focus:border-brand"
        />
        <button onClick={onClose} className="rounded-xl border border-border px-5 py-3 text-xl font-bold">
          Cerrar
        </button>
      </div>
      {(err || error) && (
        <div className="mb-3 rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">
          {err ?? `Error: ${error}`}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {([["T", listT], ["W", listW]] as const).map(([titulo, lista]) => (
          <div key={titulo}>
            <h3 className="mb-2 text-xl font-bold text-muted-foreground">Serie {titulo}</h3>
            <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto pr-1">
              {lista.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSel(p.id);
                    setConfirm(false);
                    setErr(null);
                  }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                    sel === p.id ? "border-brand bg-brand-soft" : "border-border bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-3xl font-bold tabular-nums">{pedidoLabel(p)}</span>
                    {reabierto(p.ciclos) && (
                      <span className="rounded-md bg-warn px-2 py-0.5 text-sm font-bold text-foreground">
                        REABIERTO
                      </span>
                    )}
                  </span>
                  <span className="text-right text-lg">
                    <div>{tipoLabel(p.tipo_pedido)} · Est. {p.estacion ?? "-"}</div>
                    <div className="tabular-nums text-muted-foreground">{finished(p)}</div>
                  </span>
                </button>
              ))}
              {lista.length === 0 && <div className="text-muted-foreground">Sin pedidos</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="max-h-[40vh] overflow-y-auto">
          {order ? (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-6xl font-bold tracking-tight">{pedidoLabel(order)}</div>
                <div className="text-xl">{tipoLabel(order.tipo_pedido)}</div>
              </div>
              <div className="mt-3 flex flex-col gap-4">
                {groupLines(order.lineas_pedido ?? []).map((g, i) =>
                  g.pack ? (
                    <div key={i} className="rounded-2xl border border-brand/40 p-3">
                      <div className="mb-2 text-lg font-semibold tracking-wide text-brand-strong uppercase">{g.pack}</div>
                      <div className="flex flex-col gap-3">
                        {g.lines.map((l) => (
                          <LineaView key={l.id} l={l} />
                        ))}
                      </div>
                    </div>
                  ) : g.lines[0] ? (
                    <LineaView key={i} l={g.lines[0]} />
                  ) : null,
                )}
              </div>
              {confirm ? (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-2xl font-bold text-foreground">¿Seguro?</span>
                  <button
                    disabled={busy}
                    onClick={() => reabrir(order.id)}
                    className="flex-1 rounded-2xl bg-warn py-4 text-2xl font-bold text-foreground disabled:opacity-40"
                  >
                    Sí
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                    className="flex-1 rounded-xl border border-border py-4 text-2xl font-bold"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirm(true)}
                  className="mt-4 w-full rounded-2xl bg-warn py-5 text-3xl font-bold text-foreground"
                >
                  REABRIR
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xl text-muted-foreground">Pulsa un pedido para ver el detalle</div>
          )}
        </div>
      </div>
    </div>
  );
}
