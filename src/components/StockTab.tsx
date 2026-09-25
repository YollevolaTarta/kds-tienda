import { useEffect, useState } from "react";
import { supabase, useRealtime } from "@/lib/kds";
import { MateriaPrima, Tirar } from "@/components/StockMP";

type EnvioLinea = { elaboracion_id: number | string; nombre: string; g_enviados: number | string };
type Envio = {
  traspaso_id: number;
  store_id: string;
  created_at: string;
  enviado_email: string | null;
  lineas: EnvioLinea[] | null;
};
type StockRow = {
  elaboracion_id: number;
  nombre: string;
  tipo: string | null;
  store_id: string;
  g_en_tienda: number | string | null;
  g_en_camino: number | string | null;
};
type AvisoStock = {
  elaboracion_id: number;
  nombre: string;
  tipo: string | null;
  store_id: string;
  g_en_tienda: number | string | null;
  umbral_g: number;
  ya_agotado: boolean;
};

const TABLES = ["traspasos", "traspaso_lineas"];

function formatG(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0)).toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function parseG(value: string) {
  if (!/^\d{1,3}(?:\.\d{3})*$|^\d+$/.test(value.trim())) return NaN;
  return Number(value.replace(/\./g, ""));
}

export function StockTab({ onAvisosChanged }: { onAvisosChanged?: () => Promise<void> }) {
  const { data, error, refresh } = useRealtime<{
    avisos: AvisoStock[];
    envios: Envio[];
    stock: StockRow[];
  }>(
    async () => {
      const [a, e, s] = await Promise.all([
        supabase.from("v_tienda_avisos_stock").select("*").order("nombre"),
        supabase.from("v_tienda_envios_pendientes").select("*").order("created_at"),
        supabase.from("v_tienda_stock").select("*").order("nombre"),
      ]);
      if (a.error) throw a.error;
      if (e.error) throw e.error;
      if (s.error) throw s.error;
      return {
        avisos: (a.data ?? []) as AvisoStock[],
        envios: (e.data ?? []) as Envio[],
        stock: (s.data ?? []) as StockRow[],
      };
    },
    { avisos: [], envios: [], stock: [] },
    supabase,
    TABLES,
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">
          Error al leer el stock: {error}
        </div>
      )}
      {data.avisos.length > 0 && (
        <AvisosStock avisos={data.avisos} onDone={refresh} onAvisosChanged={onAvisosChanged} />
      )}
      {data.envios.map((e) => (
        <EnvioCard
          key={e.traspaso_id}
          envio={e}
          onDone={refresh}
          onAvisosChanged={onAvisosChanged}
        />
      ))}

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-3xl font-bold tracking-tight">STOCK DE LA TIENDA</h2>
        <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-10 gap-y-2">
          <div className="text-lg text-muted-foreground">Elaboración</div>
          <div className="text-right text-lg text-muted-foreground">En tienda</div>
          <div className="text-right text-lg text-muted-foreground">En camino</div>
          {data.stock.map((r) => {
            const agotado = Number(r.g_en_tienda ?? 0) <= 0;
            const cls = agotado ? "text-alert" : "";
            return (
              <div key={r.elaboracion_id} className="contents">
                <div className={`border-t border-border pt-2 text-3xl font-bold ${cls}`}>
                  {r.nombre}
                  {agotado && <span className="ml-3 text-xl font-black">AGOTADO</span>}
                </div>
                <div className={`border-t border-border pt-2 text-right text-4xl font-bold tabular-nums ${cls}`}>
                  {formatG(r.g_en_tienda)} g
                </div>
                <div className="border-t border-border pt-2 text-right text-3xl font-semibold tabular-nums text-foreground">
                  {formatG(r.g_en_camino)} g
                </div>
              </div>
            );
          })}
          {data.stock.length === 0 && !error && (
            <div className="col-span-3 text-xl text-muted-foreground">Sin elaboraciones.</div>
          )}
        </div>
      </section>
      <MateriaPrima />
      <Tirar stock={data.stock} />
    </div>
  );
}

function AvisosStock({
  avisos,
  onDone,
  onAvisosChanged,
}: {
  avisos: AvisoStock[];
  onDone: () => Promise<void>;
  onAvisosChanged: (() => Promise<void>) | undefined;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function cambiar(aviso: AvisoStock) {
    setBusyId(aviso.elaboracion_id);
    setErr(null);
    const { error } = await supabase.rpc(
      aviso.ya_agotado ? "tienda_quitar_agotado" : "tienda_marcar_agotado",
      { p_elaboracion_id: aviso.elaboracion_id },
    );
    setBusyId(null);
    if (error) return setErr(`Error: ${error.message}`);
    await Promise.all([onDone(), onAvisosChanged?.()]);
  }

  return (
    <section className="rounded-3xl border border-warn/60 bg-warn-soft p-5">
      <h2 className="text-3xl font-bold tracking-tight text-foreground">STOCK BAJO MÍNIMOS</h2>
      {err && <div className="mt-3 rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">{err}</div>}
      <div className="mt-4 flex flex-col gap-3">
        {avisos.map((aviso) => (
          <div
            key={aviso.elaboracion_id}
            className={`flex min-h-20 items-center gap-5 rounded-xl border border-border bg-surface px-4 py-3 ${
              aviso.ya_agotado ? "opacity-50" : ""
            }`}
          >
             <div className="min-w-0 flex-1 text-3xl font-bold">{aviso.nombre}</div>
             <div className="text-right text-4xl font-bold tabular-nums text-foreground">
              {formatG(aviso.g_en_tienda)} g
            </div>
            {aviso.ya_agotado && <span className="text-xl font-black text-alert">AGOTADO</span>}
            <button
              disabled={busyId !== null}
              onClick={() => cambiar(aviso)}
               className={`min-w-56 rounded-xl px-5 py-4 text-xl font-bold disabled:opacity-40 ${
                 aviso.ya_agotado ? "border border-border bg-surface" : "bg-alert text-destructive-foreground"
              }`}
            >
              {aviso.ya_agotado ? "Ya hay" : "MARCAR AGOTADO"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function EnvioCard({
  envio,
  onDone,
  onAvisosChanged,
}: {
  envio: Envio;
  onDone: () => Promise<void>;
  onAvisosChanged: (() => Promise<void>) | undefined;
}) {
  const lineas = envio.lineas ?? [];
  const [gramos, setGramos] = useState<Record<string, string>>({});
  const [diff, setDiff] = useState(false);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [invalidos, setInvalidos] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of lineas) init[String(l.elaboracion_id)] = formatG(l.g_enviados);
    setGramos(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envio.traspaso_id]);

  async function confirmar(conDiferencias: boolean) {
    setErr(null);
    if (conDiferencias && invalidos.size > 0) {
      setErr("Escribe los gramos sin decimales");
      return;
    }
    const recibidosG: Record<string, number> = {};
    for (const l of lineas) {
      const id = String(l.elaboracion_id);
      const v = conDiferencias ? parseG(gramos[id] ?? "") : Number(l.g_enviados);
      if (!Number.isInteger(v) || v < 0) return setErr(`Gramos no válidos en ${l.nombre}`);
      recibidosG[id] = v;
    }
    if (conDiferencias && !nota.trim()) return setErr("Escribe una nota explicando las diferencias.");
    setBusy(true);
    const { error } = await supabase.rpc("tienda_confirmar_envio", {
      p_traspaso_id: envio.traspaso_id,
      p_recibidos_g: recibidosG,
      p_nota: conDiferencias ? nota.trim() : null,
    });
    setBusy(false);
    if (error) return setErr(`Error: ${error.message}`);
    await Promise.all([onDone(), onAvisosChanged?.()]);
  }

  const fecha = new Date(envio.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-3xl border border-brand/40 bg-surface p-5 shadow-sm">
      <h2 className="text-3xl font-bold tracking-tight text-brand-strong">ENVÍO DEL OBRADOR PENDIENTE</h2>
      <div className="mt-1 text-xl text-muted-foreground">
        Envío del obrador · {fecha} · enviado por {envio.enviado_email ?? "—"}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-8 gap-y-3">
        <div className="text-lg text-muted-foreground">Elaboración</div>
        <div className="text-right text-lg text-muted-foreground">Enviados</div>
        <div className="text-right text-lg text-muted-foreground">Gramos recibidos</div>
        {lineas.map((l) => {
          const id = String(l.elaboracion_id);
          return (
            <div key={id} className="contents">
              <div className="text-3xl font-bold">{l.nombre}</div>
              <div className="text-right text-3xl font-bold tabular-nums">{formatG(l.g_enviados)} g</div>
              <input
                inputMode="numeric"
                aria-label={`Gramos recibidos de ${l.nombre}`}
                value={gramos[id] ?? ""}
                onBeforeInput={(e) => {
                  const inserted = (e.nativeEvent as InputEvent).data;
                  if (inserted === "," || inserted === ".") {
                    e.preventDefault();
                    setInvalidos((current) => new Set(current).add(id));
                    setErr("Escribe los gramos sin decimales");
                  }
                }}
                onPaste={(e) => {
                  if (/[.,]/.test(e.clipboardData.getData("text"))) {
                    e.preventDefault();
                    setInvalidos((current) => new Set(current).add(id));
                    setErr("Escribe los gramos sin decimales");
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.includes(",") || (raw.includes(".") && !/^\d{1,3}(?:\.\d{3})*$/.test(raw))) {
                    setInvalidos((current) => new Set(current).add(id));
                    setErr("Escribe los gramos sin decimales");
                    return;
                  }
                  const digits = raw.replace(/\D/g, "");
                  setInvalidos((current) => {
                    const next = new Set(current);
                    next.delete(id);
                    return next;
                  });
                  setErr(null);
                  setGramos((current) => ({ ...current, [id]: digits ? formatG(digits) : "" }));
                }}
                className="w-40 rounded-xl border border-input bg-surface px-4 py-3 text-right text-3xl font-bold tabular-nums text-foreground"
              />
            </div>
          );
        })}
      </div>

      {diff && (
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota obligatoria: ¿qué diferencias hay?"
          className="mt-4 w-full rounded-xl border border-warn/60 bg-surface px-4 py-3 text-2xl text-foreground"
          rows={3}
        />
      )}
      {err && <div className="mt-3 rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">{err}</div>}

      <div className="mt-5 grid grid-cols-2 gap-4">
        {!diff ? (
          <>
            <button
              disabled={busy}
              onClick={() => confirmar(false)}
              className="rounded-xl bg-ok py-6 text-3xl font-bold text-destructive-foreground disabled:opacity-40"
            >
              TODO CORRECTO
            </button>
            <button
              disabled={busy}
              onClick={() => setDiff(true)}
              className="rounded-xl bg-warn py-6 text-3xl font-bold text-foreground disabled:opacity-40"
            >
              HAY DIFERENCIAS
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => {
                setDiff(false);
                setErr(null);
              }}
              className="rounded-xl border border-border py-6 text-2xl font-bold disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              disabled={busy || !nota.trim()}
              onClick={() => confirmar(true)}
              className="rounded-xl bg-warn py-6 text-3xl font-bold text-foreground disabled:opacity-40"
            >
              CONFIRMAR CON DIFERENCIAS
            </button>
          </>
        )}
      </div>
    </section>
  );
}
