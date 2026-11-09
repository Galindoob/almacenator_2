"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSyncRevision } from "./SyncProvider";

type Caja = { id_apertura: string; horario_apertura: string; horario_cierre: string | null; saldo_apertura: number; saldo_cierre: number | null; diferencia: number | null; valor_real: number; users: { nombre: string; apellido: string } };
type Movimiento = { id: string; id_apertura_caja: string; tipo: string; monto: number; fecha: string; usuario: { nombre: string; apellido: string } };
type Data = { cajas: Caja[]; movimientos: Movimiento[]; abierta: boolean; puedeEditar: boolean; ranking: { nombre: string; cantidad: number; monto: number }[] };
const money = (n: number | null) => n === null ? "—" : `$ ${n.toLocaleString("es-CL")}`;
const dateTime = (value: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function FinanceSettings() {
  const syncRevision = useSyncRevision();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [monto, setMonto] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<"cajas" | "capital">("cajas");
  const [expanded, setExpanded] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/configuracion/finanzas", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudieron cargar las finanzas.");
    setData(result as Data);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/configuracion/finanzas", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "No se pudieron cargar las finanzas.");
        setData(result as Data);
      }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [syncRevision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice(""); key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/configuracion/finanzas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: key.current, tipo, monto: Number(monto) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo registrar el movimiento.");
      key.current = null; setMonto(""); setNotice("Movimiento registrado correctamente.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar el movimiento."); }
    finally { setSaving(false); }
  }
  const rankingCantidad = [...(data?.ranking ?? [])].sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto).slice(0, 3);
  const rankingMonto = [...(data?.ranking ?? [])].sort((a, b) => b.monto - a.monto || b.cantidad - a.cantidad).slice(0, 3);
  return <div className="finance-settings">
    <header className="settings-heading"><h1>Finanzas</h1><p>Consulta el capital, las aperturas y las ventas realizadas.</p></header>
    {error && <p className="finance-error" role="alert">{error}</p>}
    {notice && <p className="finance-notice" role="status">{notice}</p>}
    {!data ? !error && <p role="status">Cargando finanzas...</p> : <>
      <div className="finance-summary"><article><span>Aperturas de caja</span><strong>{data.cajas.length}</strong></article><article><span>Valor real de la última caja</span><strong>{data.cajas.length ? money(data.cajas[0].valor_real) : "—"}</strong><small>{data.abierta ? "Caja abierta: el saldo esperado refleja los movimientos de la sesión." : "Caja cerrada"}</small></article></div>
      <section className="finance-panel"><h2>Administrar capital de caja</h2>
        {!data.puedeEditar ? <p>No tienes permiso para modificar el capital.</p> : data.abierta ? <p>Cierra la caja para ingresar o retirar capital.</p> : !data.cajas.length ? <p>Debe existir una caja cerrada para registrar movimientos.</p> : <form className="finance-form" onSubmit={submit}>
          <label>Movimiento<select value={tipo} onChange={(e) => { setTipo(e.target.value as "ingreso" | "egreso"); key.current = null; }}><option value="ingreso">Ingresar dinero</option><option value="egreso">Retirar dinero</option></select></label>
          <label>Monto en pesos<input type="number" min="1" max="2147483647" step="1" required value={monto} onChange={(e) => { setMonto(e.target.value); key.current = null; }} /></label>
          <button disabled={saving || !monto} type="submit">{saving ? "Guardando..." : "Registrar movimiento"}</button>
        </form>}
      </section>
      <section className="finance-panel"><label className="finance-history-selector">Historial <select value={history} onChange={(event) => setHistory(event.target.value as "cajas" | "capital")}><option value="cajas">Historial de cajas</option><option value="capital">Historial de descuento de caja</option></select></label><div className="finance-table-scroll">{history === "cajas" ? <><table><thead><tr><th>Apertura</th><th>Abierta por</th><th>Saldo apertura</th><th>Saldo cierre</th><th>Diferencia</th><th>Valor real</th></tr></thead><tbody>{data.cajas.map((c) => <Fragment key={c.id_apertura}><tr><td><button type="button" className="finance-expand" aria-expanded={expanded === c.id_apertura} onClick={() => setExpanded(expanded === c.id_apertura ? null : c.id_apertura)}><span aria-hidden="true">{expanded === c.id_apertura ? "▾" : "▸"}</span> {dateTime(c.horario_apertura)}</button></td><td>{c.users.nombre} {c.users.apellido}</td><td>{money(c.saldo_apertura)}</td><td>{money(c.saldo_cierre)}</td><td>{money(c.diferencia)}</td><td>{money(c.valor_real)}</td></tr>{expanded === c.id_apertura && <tr><td colSpan={6}><strong>Movimientos de capital después del cierre</strong>{data.movimientos.some((m) => m.id_apertura_caja === c.id_apertura) ? <ul className="finance-movement-list">{data.movimientos.filter((m) => m.id_apertura_caja === c.id_apertura).map((m) => <li key={m.id}>{dateTime(m.fecha)} · {m.tipo === "ingreso" ? "Ingreso" : "Retiro"} · {money(m.monto)} · {m.usuario.nombre} {m.usuario.apellido}</li>)}</ul> : <p>No hay movimientos de capital asociados.</p>}</td></tr>}</Fragment>)}</tbody></table>{!data.cajas.length && <p>No hay aperturas registradas.</p>}</> : <><p>Ingresos y retiros de capital realizados con la caja cerrada.</p><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Monto</th><th>Usuario</th><th>Apertura asociada</th></tr></thead><tbody>{data.movimientos.map((m) => { const caja = data.cajas.find((c) => c.id_apertura === m.id_apertura_caja); return <tr key={m.id}><td>{dateTime(m.fecha)}</td><td>{m.tipo === "ingreso" ? "Ingreso" : "Retiro"}</td><td>{money(m.monto)}</td><td>{m.usuario.nombre} {m.usuario.apellido}</td><td>{caja ? dateTime(caja.horario_apertura) : "—"}</td></tr>; })}</tbody></table>{!data.movimientos.length && <p>No hay movimientos de capital registrados.</p>}</>}</div></section>
      <section className="finance-panel"><h2>Vendedores destacados</h2><p>Ventas completadas de todos los períodos.</p><div className="finance-rankings">{[{ title: "Por cantidad de ventas", rows: rankingCantidad, field: "cantidad" as const }, { title: "Por monto vendido", rows: rankingMonto, field: "monto" as const }].map((group) => <div key={group.title}><h3>{group.title}</h3>{group.rows.length ? <ol>{group.rows.map((row, index) => <li key={`${row.nombre}-${index}`}><span>{row.nombre}</span><strong>{group.field === "monto" ? money(row.monto) : `${row.cantidad} ventas`}</strong></li>)}</ol> : <p>Aún no hay ventas completadas.</p>}</div>)}</div></section>
    </>}
  </div>;
}
