import { useEffect, useState } from "react";
import { formatKg, parseKg, supabase, useRealtime } from "@/lib/kds";

type EnvioLinea = { elaboracion_id: number | string; nombre: string; kg_enviados: number | string };
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
  kg_en_tienda: number | string | null;
  kg_en_camino: number | string | null;
};

const TABLES = ["traspasos", "traspaso_lineas"];

export function StockTab() {
  const { data, error, refresh } = useRealtime<{ envios: Envio[]; stock: StockRow[] }>(
    async () => {
      const [e, s] = await Promise.all([
        supabase.from("v_tienda_envios_pendientes").select("*").order("created_at"),
        supabase.from("v_tienda_stock").select("*").order("nombre"),
      ]);
      if (e.error) throw e.error;
      if (s.error) throw s.error;
      return { envios: (e.data ?? []) as Envio[], stock: (s.data ?? []) as StockRow[] };
    },
    { envios: [], stock: [] },
    supabase,
    TABLES,
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-white/15 bg-surface-2 px-4 py-3 text-lg">
          Error al leer el stock: {error}
        </div>
      )}
      {data.envios.map((e) => (
        <EnvioCard key={e.traspaso_id} envio={e} onDone={refresh} />
      ))}

      <section className="rounded-3xl border border-white/10 bg-surface p-5">
        <h2 className="mb-4 text-3xl font-black tracking-tight">STOCK DE LA TIENDA</h2>
        <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-10 gap-y-2">
          <div className="text-lg text-foreground/60">Elaboración</div>
          <div className="text-right text-lg text-foreground/60">En tienda</div>
          <div className="text-right text-lg text-foreground/60">En camino</div>
          {data.stock.map((r) => {
            const agotado = Number(r.kg_en_tienda ?? 0) <= 0;
            const cls = agotado ? "text-alert" : "";
            return (
              <div key={r.elaboracion_id} className="contents">
                <div className={`border-t border-white/10 pt-2 text-3xl font-bold ${cls}`}>
                  {r.nombre}
                  {agotado && <span className="ml-3 text-xl font-black">AGOTADO</span>}
                </div>
                <div className={`border-t border-white/10 pt-2 text-right text-4xl font-black tabular-nums ${cls}`}>
                  {formatKg(r.kg_en_tienda)} kg
                </div>
                <div className="border-t border-white/10 pt-2 text-right text-3xl font-semibold tabular-nums text-foreground/80">
                  {formatKg(r.kg_en_camino)} kg
                </div>
              </div>
            );
          })}
          {data.stock.length === 0 && !error && (
            <div className="col-span-3 text-xl text-foreground/60">Sin elaboraciones.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function EnvioCard({ envio, onDone }: { envio: Envio; onDone: () => Promise<void> }) {
  const lineas = envio.lineas ?? [];
  const [kg, setKg] = useState<Record<string, string>>({});
  const [diff, setDiff] = useState(false);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of lineas) init[String(l.elaboracion_id)] = formatKg(l.kg_enviados);
    setKg(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envio.traspaso_id]);

  async function confirmar(conDiferencias: boolean) {
    setErr(null);
    const recibidos: Record<string, number> = {};
    for (const l of lineas) {
      const id = String(l.elaboracion_id);
      const v = conDiferencias ? parseKg(kg[id] ?? "") : Number(l.kg_enviados);
      if (!Number.isFinite(v) || v < 0) return setErr(`Kg no válidos en ${l.nombre}`);
      recibidos[id] = v;
    }
    if (conDiferencias && !nota.trim()) return setErr("Escribe una nota explicando las diferencias.");
    setBusy(true);
    const { error } = await supabase.rpc("tienda_confirmar_envio", {
      p_traspaso_id: envio.traspaso_id,
      p_recibidos: recibidos,
      p_nota: conDiferencias ? nota.trim() : null,
    });
    setBusy(false);
    if (error) return setErr(`Error: ${error.message}`);
    await onDone();
  }

  const fecha = new Date(envio.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-3xl border-2 border-brand/60 bg-surface p-5">
      <h2 className="text-3xl font-black tracking-tight text-brand">ENVÍO DEL OBRADOR PENDIENTE</h2>
      <div className="mt-1 text-xl text-foreground/70">
        {fecha}
        {envio.enviado_email ? ` · enviado por ${envio.enviado_email}` : ""}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-8 gap-y-3">
        <div className="text-lg text-foreground/60">Elaboración</div>
        <div className="text-right text-lg text-foreground/60">Enviados</div>
        <div className="text-right text-lg text-foreground/60">Kg recibidos</div>
        {lineas.map((l) => {
          const id = String(l.elaboracion_id);
          return (
            <div key={id} className="contents">
              <div className="text-3xl font-bold">{l.nombre}</div>
              <div className="text-right text-3xl font-black tabular-nums">{formatKg(l.kg_enviados)} kg</div>
              <input
                inputMode="decimal"
                value={kg[id] ?? ""}
                onChange={(e) => setKg((k) => ({ ...k, [id]: e.target.value.replace(".", ",") }))}
                className="w-40 rounded-xl border border-white/25 bg-surface-2 px-4 py-3 text-right text-3xl font-black tabular-nums text-foreground"
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
          className="mt-4 w-full rounded-xl border border-warn/60 bg-surface-2 px-4 py-3 text-2xl text-foreground"
          rows={3}
        />
      )}
      {err && <div className="mt-3 rounded-xl border-2 border-alert bg-alert/15 px-4 py-3 text-lg">{err}</div>}

      <div className="mt-5 grid grid-cols-2 gap-4">
        {!diff ? (
          <>
            <button
              disabled={busy}
              onClick={() => confirmar(false)}
              className="rounded-xl bg-ok py-6 text-3xl font-black text-black disabled:opacity-40"
            >
              TODO CORRECTO
            </button>
            <button
              disabled={busy}
              onClick={() => setDiff(true)}
              className="rounded-xl bg-warn py-6 text-3xl font-black text-black disabled:opacity-40"
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
              className="rounded-xl border border-white/30 py-6 text-2xl font-bold disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              disabled={busy || !nota.trim()}
              onClick={() => confirmar(true)}
              className="rounded-xl bg-warn py-6 text-3xl font-black text-black disabled:opacity-40"
            >
              CONFIRMAR CON DIFERENCIAS
            </button>
          </>
        )}
      </div>
    </section>
  );
}
