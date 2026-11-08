"use client";

import { hasSessionHint } from "@/lib/client-session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartLoader } from "../components/CartLoader";

type CashRegister = {
  id_apertura: string;
  horario_apertura: string;
  saldo_apertura: number;
  saldo_esperado: number;
  total_efectivo: number;
  total_debito: number;
  total_credito: number;
  total_transferencia: number;
  venta_efectivo: number;
  venta_debito: number;
  venta_credito: number;
  venta_transferencia: number;
  total: number;
  usuario: { nombre: string; apellido: string };
};

type Voucher = {
  titulo: string;
  tienda: string;
  rut: string;
  fechaApertura: string;
  fechaCierre: string;
  responsable: string;
  firmante: string;
  ventas: { efectivo: number; debito: number; credito: number; transferencia: number; total: number };
  montos: { apertura: number; efectivo: number; debito: number; credito: number; transferencia: number; totalVentas: number; esperado: number; enCaja: number; diferencia: number };
  movimientos: { id: string; fecha: string; tipo: string; razon: string | null; comentario: string | null; monto: number }[];
  comentario: string | null;
};

const methods = [
  { key: "efectivo", name: "Efectivo" },
  { key: "debito", name: "Débito" },
  { key: "credito", name: "Crédito" },
  { key: "transferencia", name: "Transferencia" },
] as const;

function currency(value: number) {
  return `$ ${Math.abs(value).toLocaleString("es-CL")}`;
}

function chileDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

export default function CierreCajaPage() {
  const router = useRouter();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [cashOnHand, setCashOnHand] = useState("0");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [voucher, setVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    if (!hasSessionHint()) { router.replace("/login"); return; }
    const controller = new AbortController();
    fetch("/api/caja", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { abierta?: boolean; caja?: CashRegister; puedeCerrar?: boolean; ventasPendientes?: number; message?: string };
        if (!response.ok) throw new Error(data.message ?? "No se pudo cargar la caja.");
        if (!data.abierta || !data.caja) { router.replace("/home"); return; }
        if (!data.puedeCerrar) { window.alert("Solo quien abrió la caja puede cerrarla."); router.replace("/home"); return; }
        if (data.ventasPendientes) {
          window.alert(`Hay ${data.ventasPendientes} ${data.ventasPendientes === 1 ? "venta pendiente" : "ventas pendientes"}. Termínalas o elimínalas antes de cerrar la caja.`);
          router.replace("/home");
          return;
        }
        setCashRegister(data.caja);
      })
      .catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudo cargar la caja."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    if (!voucher) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setVoucher(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [voucher]);

  const enteredCash = cashOnHand === "" ? 0 : Number(cashOnHand);
  const difference = cashRegister ? enteredCash - cashRegister.saldo_esperado : 0;
  const differenceTitle = difference < 0 ? "Faltan" : "Sobran";

  async function previewVoucher() {
    if (!cashRegister || cashOnHand === "") return;
    setPreviewing(true);
    setMessage("");
    try {
      const response = await fetch("/api/caja/voucher", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enCaja: enteredCash, comentario: comment }),
      });
      const data = await response.json() as Voucher & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "No se pudo generar el detalle.");
      setVoucher(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el detalle.");
    } finally { setPreviewing(false); }
  }

  async function closeCashRegister() {
    if (!cashRegister || cashOnHand === "" || closing) return;
    setClosing(true);
    setMessage("");
    try {
      const response = await fetch("/api/caja", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldo_cierre: enteredCash, comentario: comment }),
      });
      const data = await response.json() as { status?: string; message?: string };
      if (!response.ok || data.status !== "ok") throw new Error(data.message ?? "No se pudo cerrar la caja.");
      router.replace("/home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar la caja.");
    } finally { setClosing(false); }
  }

  if (loading) return <main className="cash-close-shell"><CartLoader screen label="Cargando cierre de caja..." /></main>;
  if (!cashRegister) return <main className="cash-close-shell"><p className="cash-close-status">{message || "No hay caja disponible para cerrar."}</p></main>;

  return (
    <main className="cash-close-shell">
      <header className="cash-close-topbar">
        <button type="button" aria-label="Volver" onClick={() => router.push("/home")}>{"<"}</button>
        <h1>Cierre de caja</h1>
      </header>
      <section className="cash-close-content">
        <p className="cash-close-opening-message">Caja abierta por {cashRegister.usuario.nombre} {cashRegister.usuario.apellido} a las {chileDate(cashRegister.horario_apertura)}</p>
        <div className="cash-close-summary">
          <section className="cash-close-column">
            <h2>Efectivo total</h2>
            <label>En caja
              <input type="text" inputMode="numeric" value={cashOnHand} onChange={(event) => {
                if (/^\d{0,10}$/.test(event.target.value) && Number(event.target.value || 0) <= 2147483647) { setCashOnHand(event.target.value); setMessage(""); }
              }} />
            </label>
            <label>Esperado <input type="text" readOnly value={currency(cashRegister.saldo_esperado)} /></label>
            <label>{differenceTitle} <input type="text" readOnly value={currency(difference)} /></label>
          </section>
          <section className="cash-close-column">
            <h2>Ventas por método de pago</h2>
            <div className="cash-payment-grid">
              {methods.map((method) => (
                <div className="cash-close-method" key={method.key}>
                  <strong>{method.name}</strong>
                  <span>{cashRegister[`venta_${method.key}`]} ventas</span>
                  <input type="text" readOnly aria-label={`Total ${method.name}`} value={currency(cashRegister[`total_${method.key}`])} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="cash-close-footer">
          <label className="cash-close-comment">Comentario
            <input type="text" maxLength={255} placeholder="Agregar comentario" value={comment} onChange={(event) => {
              if (!/['"]/.test(event.target.value)) setComment(event.target.value);
            }} />
          </label>
          {message ? <p role="alert">{message}</p> : null}
          <div className="cash-close-buttons">
            <button type="button" disabled={cashOnHand === "" || previewing || closing} onClick={previewVoucher}>{previewing ? "Preparando..." : "Ver detalle voucher"}</button>
            <button type="button" disabled={cashOnHand === "" || closing} onClick={closeCashRegister}>{closing ? "Cerrando..." : "Cerrar caja"}</button>
          </div>
        </div>
      </section>

      {voucher ? (
        <div className="cash-voucher-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVoucher(null); }}>
          <section className="cash-voucher" role="dialog" aria-modal="true" aria-label="Vista previa del cierre de caja">
            <button className="cash-voucher-close" type="button" aria-label="Cerrar detalle" onClick={() => setVoucher(null)}>×</button>
            <h2>{voucher.titulo}</h2>
            <p className="cash-voucher-store">{voucher.tienda}<br />RUT {voucher.rut}</p>
            <dl className="cash-voucher-lines">
              <div><dt>Fecha apertura</dt><dd>{chileDate(voucher.fechaApertura)}</dd></div>
              <div><dt>Fecha cierre estimada</dt><dd>{chileDate(voucher.fechaCierre)}</dd></div>
              <div><dt>Responsable</dt><dd>{voucher.responsable}</dd></div>
            </dl>
            <h3>Resumen</h3>
            <dl className="cash-voucher-lines">
              {methods.map((method) => <div key={method.key}><dt>Ventas {method.name}</dt><dd>{voucher.ventas[method.key]}</dd></div>)}
              <div className="is-total"><dt>Total ventas</dt><dd>{voucher.ventas.total}</dd></div>
            </dl>
            <h3>Ingresos</h3>
            <dl className="cash-voucher-lines">
              <div><dt>Apertura de caja</dt><dd>{currency(voucher.montos.apertura)}</dd></div>
              {methods.map((method) => <div key={method.key}><dt>Ventas {method.name}</dt><dd>{currency(voucher.montos[method.key])}</dd></div>)}
              <div className="is-total"><dt>Total de ventas</dt><dd>{currency(voucher.montos.totalVentas)}</dd></div>
            </dl>
            <h3>Movimientos de caja</h3>
            {voucher.movimientos.length ? voucher.movimientos.map((movement) => (
              <div className="cash-voucher-movement" key={movement.id}>
                <strong>{movement.tipo === "ingreso" ? "+" : "−"}{currency(movement.monto)} · {movement.razon ?? movement.tipo}</strong>
                <small>{chileDate(movement.fecha)}</small>
                {movement.comentario ? <span>{movement.comentario}</span> : null}
              </div>
            )) : <p>Sin movimientos registrados.</p>}
            <h3>Efectivo</h3>
            <dl className="cash-voucher-lines">
              <div><dt>Efectivo recaudado</dt><dd>{currency(voucher.montos.efectivo)}</dd></div>
              <div><dt>Efectivo esperado</dt><dd>{currency(voucher.montos.esperado)}</dd></div>
              <div className="is-total"><dt>Diferencia</dt><dd>{voucher.montos.diferencia < 0 ? "−" : "+"}{currency(voucher.montos.diferencia)}</dd></div>
            </dl>
            <h3>Comentario</h3>
            <p>{voucher.comentario || "Sin comentario."}</p>
            <div className="cash-voucher-signature"><span />Firma de {voucher.firmante}</div>
            <p className="cash-voucher-note">Vista previa. La fecha y los montos definitivos se guardan al cerrar la caja.</p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
