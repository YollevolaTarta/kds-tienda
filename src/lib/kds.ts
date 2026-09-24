import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export const supabase = createClient(
  "https://yseuxchiumkwbcovkowu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZXV4Y2hpdW1rd2Jjb3Zrb3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNzY1NDgsImV4cCI6MjEwMzg1MjU0OH0.lZXlL6QfHuilJ5uia92w4KSKeUdwPcn1DUQUjnHQSd0",
  { auth: { persistSession: true, autoRefreshToken: true } },
);

/** Cliente anónimo sin sesión, para la pantalla pública del cliente (/pantalla). */
export const supabaseAnon = createClient(
  "https://yseuxchiumkwbcovkowu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZXV4Y2hpdW1rd2Jjb3Zrb3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNzY1NDgsImV4cCI6MjEwMzg1MjU0OH0.lZXlL6QfHuilJ5uia92w4KSKeUdwPcn1DUQUjnHQSd0",
  { auth: { persistSession: false, autoRefreshToken: false, storageKey: "yllt-anon" } },
);

export function formatKg(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-ES", { maximumFractionDigits: 3 });
}
export function parseKg(s: string) {
  const v = Number(s.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

export const STORE = "Bilbao_CascoViejo";
export const OPTIMAL_MS = 30_000;

export type Linea = {
  id: number | string;
  pack_grupo: string | number | null;
  formato: string | null;
  receta: string | null;
  crema: string | null;
  topping_1: string | null;
  topping_2: string | null;
  foto: boolean | null;
  packs: { nombre: string } | null;
  recetas: { nombre: string } | null;
};

export type Pedido = {
  id: string | number;
  serie: string | null;
  numero_pedido: number | null;
  estado: string;
  estacion: number | null;
  tipo_pedido: string;
  fecha_envio: string | null;
  franja_recogida: string | null;
  cogido_at: string | null;
  listo_at: string | null;
  en_nevera_at?: string | null;
  created_at?: string | null;
  ciclos?: unknown;
  lineas_pedido?: Linea[];
};

// Nunca se piden datos personales del cliente.
export const PEDIDO_COLS =
  "id,serie,numero_pedido,estado,estacion,tipo_pedido,fecha_envio,franja_recogida,cogido_at,listo_at,en_nevera_at,created_at,ciclos";
export const LINEA_COLS =
  "id,pack_grupo,formato,receta,crema,topping_1,topping_2,foto,packs(nombre),recetas(nombre)";

export function pedidoLabel(p: Pick<Pedido, "serie" | "numero_pedido">) {
  const n = String(p.numero_pedido ?? 0).padStart(2, "0");
  return p.serie ? `${p.serie}-${n}` : n;
}

export function formatoLabel(f: string | null) {
  if (f === "abierta") return "Tarta abierta";
  if (f === "lata") return "Tarta en lata";
  if (f === "shake") return "Cake shake";
  return f ?? "";
}

export function todayRange() {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, "0");
  const d = String(s.getDate()).padStart(2, "0");
  return { start: s.toISOString(), end: e.toISOString(), date: `${y}-${m}-${d}` };
}

/** Recarga `load` al montar y ante cualquier cambio en pedidos / lineas_pedido. */
export function useRealtime<T>(
  load: () => Promise<T>,
  initial: T,
  client: typeof supabase = supabase,
  tables: string[] = ["pedidos", "lineas_pedido"],
) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    let ch = client.channel(`kds-${Math.random().toString(36).slice(2)}`);
    for (const t of tables)
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refresh);
    ch.subscribe();
    const poll = setInterval(refresh, 30_000);
    return () => {
      clearInterval(poll);
      client.removeChannel(ch);
    };
  }, [refresh, client]);

  return { data, error, refresh };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatClock(ts: number | string) {
  if (ts === 0) return "--:--";
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
