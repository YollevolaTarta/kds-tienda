import { useState } from "react";
import { supabase, useRealtime } from "@/lib/kds";

type MpRow = {
  materia_prima_id: number;
  nombre: string;
  g_en_tienda: number | string | null;
  ultimo_recuento_at: string | null;
  ultimo_recuento_por: string | null;
};
type Registro = {
  id: number;
  nombre: string;
  gramos: number | string;
  created_at: string;
  usuario_email: string | null;
  anulada_at: string | null;
  anulada_email: string | null;
  origen?: string | null;
  motivo?: string | null;
  clase?: string | null;
};
type ElabRow = { elaboracion_id: number; nombre: string; g_en_tienda: number | string | null };

const fmt = (v: number | string | null | undefined) =>
  Math.round(Number(v ?? 0)).toLocaleString("es-ES", { maximumFractionDigits: 0 });
const fecha = (s: string) =>
  new Date(s).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const toInt = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "")));
const byName = <T extends { nombre: string }>(a: T[]) =>
  [...a].sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

function GInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={value}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "");
        onChange(d ? fmt(d) : "");
      }}
      className="w-40 rounded-xl border border-input bg-surface px-4 py-3 text-right text-3xl font-bold tabular-nums text-foreground"
    />
  );
}

const btn = "rounded-xl px-5 py-4 text-xl font-bold disabled:opacity-40";
const ErrBox = ({ msg }: { msg: string | null }) =>
  msg ? <div className="mt-3 rounded-xl border border-alert/40 bg-alert-soft px-4 py-3 text-lg text-alert">{msg}</div> : null;

async function loadMp() {
  const r = await supabase.from("v_tienda_stock_mp").select("*").order("nombre");
  if (r.error) throw r.error;
  return byName((r.data ?? []) as MpRow[]);
}

function Historial({
  titulo,
  items,
  detalle,
  anular,
}: {
  titulo: string;
  items: Registro[];
  detalle: (r: Registro) => string;
  anular: (id: number) => Promise<string | null>;
}) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-6">
       <h3 className="mb-2 text-2xl font-bold">{titulo}</h3>
      <ErrBox msg={err} />
      <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
       {items.length === 0 && <div className="text-xl text-muted-foreground">Ninguna.</div>}
        {items.map((r) => {
          const anulada = !!r.anulada_at;
          return (
            <div
              key={r.id}
               className={`flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 ${anulada ? "text-muted-foreground" : ""}`}
            >
              <div className={`min-w-0 flex-1 ${anulada ? "line-through" : ""}`}>
                <div className="text-2xl font-bold">
                  {r.nombre} · {fmt(r.gramos)} g
                </div>
                <div className="text-lg">
                  {detalle(r)} · {fecha(r.created_at)} · {r.usuario_email ?? "—"}
                </div>
              </div>
              {anulada ? (
                <div className="text-lg">
                  Anulada {fecha(r.anulada_at!)} por {r.anulada_email ?? "—"}
                </div>
              ) : confirm === r.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">¿Seguro?</span>
                  <button
                    disabled={busy}
                     className={`${btn} bg-alert text-destructive-foreground`}
                    onClick={async () => {
                      setBusy(true);
                      setErr(await anular(r.id));
                      setBusy(false);
                      setConfirm(null);
                    }}
                  >
                    Sí
                  </button>
                   <button className={`${btn} border border-border`} onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                 <button className={`${btn} border border-border`} onClick={() => setConfirm(r.id)}>
                  Anular
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MateriaPrima() {
  const { data, error, refresh } = useRealtime(
    async () => {
      const [mp, en] = await Promise.all([
        loadMp(),
        supabase.from("v_tienda_entradas_mp").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      if (en.error) throw en.error;
      return { mp, entradas: (en.data ?? []) as Registro[] };
    },
    { mp: [] as MpRow[], entradas: [] as Registro[] },
    supabase,
    [],
  );
  const [modo, setModo] = useState<null | "recuento" | "entrada">(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [origen, setOrigen] = useState<"obrador" | "compra" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function abrir(m: "recuento" | "entrada") {
    const init: Record<string, string> = {};
    for (const r of data.mp) init[String(r.materia_prima_id)] = m === "recuento" ? fmt(r.g_en_tienda) : "";
    setVals(init);
    setOrigen(null);
    setErr(null);
    setModo(m);
  }

  async function guardar() {
    const g: Record<string, number> = {};
    for (const [k, v] of Object.entries(vals)) {
      const n = toInt(v);
      if (n !== null && n > 0 ? true : modo === "recuento" && n !== null) g[k] = n!;
    }
    if (modo === "entrada") {
      if (!origen) return setErr("Elige el origen de la entrada.");
      if (Object.keys(g).length === 0) return setErr("Escribe los gramos recibidos.");
    }
    setBusy(true);
    setErr(null);
    const { error } =
      modo === "recuento"
        ? await supabase.rpc("tienda_registrar_recuento_mp", { p_gramos: g })
        : await supabase.rpc("tienda_registrar_entrada_mp", { p_origen: origen, p_gramos: g });
    setBusy(false);
    if (error) return setErr(error.message);
    setModo(null);
    await refresh();
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
         <h2 className="flex-1 text-3xl font-bold tracking-tight">MATERIA PRIMA</h2>
         <button className={`${btn} border border-border`} onClick={() => abrir("recuento")}>
          RECUENTO
        </button>
         <button className={`${btn} bg-brand text-primary-foreground`} onClick={() => abrir("entrada")}>
          + ENTRADA
        </button>
      </div>
      {error && <ErrBox msg={`Error al leer la materia prima: ${error}`} />}

      {modo && (
         <div className="mb-5 rounded-2xl border border-brand/40 bg-brand-soft p-4">
           <h3 className="text-2xl font-bold text-brand-strong">
            {modo === "recuento" ? "RECUENTO · cuenta todas" : "NUEVA ENTRADA"}
          </h3>
          {modo === "entrada" && (
            <div className="mt-3 flex gap-3">
              {(
                [
                  ["obrador", "Del obrador"],
                  ["compra", "Compra en tienda"],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setOrigen(v)}
                   className={`${btn} ${origen === v ? "bg-brand text-primary-foreground" : "border border-border bg-surface"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3">
            {data.mp.map((r) => {
              const id = String(r.materia_prima_id);
              return (
                <div key={id} className="flex items-center gap-4">
                  <div className="flex-1 text-3xl font-bold">{r.nombre}</div>
                  <GInput
                    label={`Gramos de ${r.nombre}`}
                    value={vals[id] ?? ""}
                    onChange={(v) => setVals((c) => ({ ...c, [id]: v }))}
                  />
                  <span className="text-2xl">g</span>
                </div>
              );
            })}
          </div>
          <ErrBox msg={err} />
          <div className="mt-4 grid grid-cols-2 gap-4">
             <button className={`${btn} border border-border bg-surface`} onClick={() => setModo(null)}>
              Cancelar
            </button>
             <button disabled={busy} className={`${btn} bg-ok text-destructive-foreground`} onClick={guardar}>
              GUARDAR
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {data.mp.map((r) => {
          const rojo = Number(r.g_en_tienda ?? 0) <= 0;
          return (
             <div key={r.materia_prima_id} className={`border-t border-border py-2 ${rojo ? "text-alert" : ""}`}>
              <div className="flex items-baseline gap-4">
                <div className="flex-1 text-3xl font-bold">
                  {r.nombre}
                  {rojo && <span className="ml-3 text-xl font-bold">AGOTADO</span>}
                </div>
                <div className="text-4xl font-bold tabular-nums">{fmt(r.g_en_tienda)} g</div>
              </div>
               <div className={`text-lg ${rojo ? "" : "text-muted-foreground"}`}>
                {r.ultimo_recuento_at
                  ? `Contado ${fecha(r.ultimo_recuento_at)} por ${r.ultimo_recuento_por ?? "—"}`
                  : "Nunca se ha contado"}
              </div>
            </div>
          );
        })}
         {data.mp.length === 0 && !error && <div className="text-xl text-muted-foreground">Sin materias primas.</div>}
      </div>

      <Historial
        titulo="Últimas entradas"
        items={data.entradas}
        detalle={(r) => (r.origen === "compra" ? "Compra en tienda" : r.origen === "obrador" ? "Del obrador" : r.origen ?? "")}
        anular={async (id) => {
          const { error } = await supabase.rpc("tienda_anular_entrada_mp", { p_id: id });
          await refresh();
          return error ? error.message : null;
        }}
      />
    </section>
  );
}

const MOTIVOS = ["Caducado", "Se ha caído", "Error de preparación", "Otro"];

export function Tirar({ stock }: { stock: ElabRow[] }) {
  const { data, error, refresh } = useRealtime(
    async () => {
      const [mp, me] = await Promise.all([
        loadMp(),
        supabase.from("v_tienda_mermas").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      if (me.error) throw me.error;
      return { mp, mermas: (me.data ?? []) as Registro[] };
    },
    { mp: [] as MpRow[], mermas: [] as Registro[] },
    supabase,
    [],
  );
  const [open, setOpen] = useState(false);
  const [elab, setElab] = useState<Record<string, string>>({});
  const [mat, setMat] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const [revisar, setRevisar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const elabs = byName(stock);
  const pick = (vals: Record<string, string>) => {
    const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(vals)) {
      const n = toInt(v);
      if (n && n > 0) o[k] = n;
    }
    return o;
  };
  const pElab = pick(elab);
  const pMat = pick(mat);
  const motivoFinal = motivo === "Otro" ? otro.trim() : motivo;
  const resumen = [
    ...elabs.filter((e) => pElab[e.elaboracion_id]).map((e) => [e.nombre, pElab[e.elaboracion_id]] as const),
    ...data.mp.filter((m) => pMat[m.materia_prima_id]).map((m) => [m.nombre, pMat[m.materia_prima_id]] as const),
  ];

  function reset() {
    setElab({});
    setMat({});
    setMotivo(null);
    setOtro("");
    setRevisar(false);
    setErr(null);
  }

  function siguiente() {
    if (resumen.length === 0) return setErr("Escribe los gramos de lo que se tira.");
    if (!motivoFinal) return setErr(motivo === "Otro" ? "Escribe el motivo." : "Elige un motivo.");
    setErr(null);
    setRevisar(true);
  }

  async function confirmar() {
    setBusy(true);
    const { error } = await supabase.rpc("tienda_registrar_merma", {
      p_elaboraciones_g: pElab,
      p_materias_g: pMat,
      p_motivo: motivoFinal,
    });
    setBusy(false);
    if (error) {
      setRevisar(false);
      return setErr(error.message);
    }
    reset();
    setOpen(false);
    await refresh();
  }

  const fila = (id: string, nombre: string, g: number | string | null, v: string, set: (v: string) => void) => (
    <div key={id} className="flex items-center gap-4 border-t border-border py-2">
      <div className="flex-1 text-3xl font-bold">{nombre}</div>
      <div className="text-xl text-muted-foreground tabular-nums">hay {fmt(g)} g</div>
      <GInput label={`Gramos a tirar de ${nombre}`} value={v} onChange={set} />
      <span className="text-2xl">g</span>
    </div>
  );

  return (
    <section className="rounded-3xl border border-alert/40 bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
         <h2 className="flex-1 text-3xl font-bold tracking-tight text-alert">MERMAS</h2>
        <button
           className="rounded-xl bg-alert px-8 py-5 text-3xl font-bold text-destructive-foreground"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          TIRAR
        </button>
      </div>
      {error && <ErrBox msg={`Error al leer las mermas: ${error}`} />}

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-6">
           <div className="mx-auto max-w-4xl rounded-3xl border border-alert/40 bg-surface p-6 shadow-sm">
            <div className="flex items-center">
               <h2 className="flex-1 text-4xl font-bold text-alert">TIRAR PRODUCTO</h2>
               <button className={`${btn} border border-border`} onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            {!revisar ? (
              <>
                <h3 className="mt-5 text-2xl font-bold">Producto del obrador</h3>
                {elabs.map((e) =>
                  fila(String(e.elaboracion_id), e.nombre, e.g_en_tienda, elab[e.elaboracion_id] ?? "", (v) =>
                    setElab((c) => ({ ...c, [e.elaboracion_id]: v })),
                  ),
                )}
                <h3 className="mt-5 text-2xl font-bold">Materia prima</h3>
                {data.mp.map((m) =>
                  fila(String(m.materia_prima_id), m.nombre, m.g_en_tienda, mat[m.materia_prima_id] ?? "", (v) =>
                    setMat((c) => ({ ...c, [m.materia_prima_id]: v })),
                  ),
                )}
                <h3 className="mt-5 text-2xl font-bold">Motivo</h3>
                <div className="mt-2 flex flex-wrap gap-3">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMotivo(m)}
                       className={`${btn} ${motivo === m ? "bg-warn text-foreground" : "border border-border"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {motivo === "Otro" && (
                  <input
                    value={otro}
                    onChange={(e) => setOtro(e.target.value)}
                    placeholder="Escribe el motivo"
                    className="mt-3 w-full rounded-xl border border-warn/60 bg-surface-2 px-4 py-3 text-2xl text-foreground"
                  />
                )}
                <ErrBox msg={err} />
                 <button className={`${btn} mt-5 w-full bg-alert py-6 text-3xl text-destructive-foreground`} onClick={siguiente}>
                  REVISAR Y TIRAR
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-5 text-3xl font-bold">Vas a tirar:</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {resumen.map(([n, g]) => (
                     <div key={n} className="flex items-baseline border-t border-border py-2">
                      <div className="flex-1 text-3xl font-bold">{n}</div>
                      <div className="text-4xl font-bold tabular-nums text-alert">{fmt(g)} g</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-2xl">
                  Motivo: <b>{motivoFinal}</b>
                </div>
                <ErrBox msg={err} />
                <div className="mt-5 grid grid-cols-2 gap-4">
                   <button className={`${btn} border border-border py-6 text-2xl`} onClick={() => setRevisar(false)}>
                    Volver
                  </button>
                  <button
                    disabled={busy}
                     className={`${btn} bg-alert py-6 text-3xl text-destructive-foreground`}
                    onClick={confirmar}
                  >
                    SÍ, TIRAR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Historial
        titulo="Últimas mermas"
        items={data.mermas}
        detalle={(r) => [r.clase, r.motivo].filter(Boolean).join(" · ")}
        anular={async (id) => {
          const { error } = await supabase.rpc("tienda_anular_merma", { p_id: id });
          await refresh();
          return error ? error.message : null;
        }}
      />
    </section>
  );
}
