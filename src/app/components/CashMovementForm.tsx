"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { CartLoader } from "./CartLoader";
import { useSyncRevision } from "./SyncProvider";

type MovementType = "ingreso" | "egreso";
type Reason = { id_razon: string; razon: string };

export function CashMovementForm({ type }: { type: MovementType }) {
  const syncRevision = useSyncRevision();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/movimiento-caja", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { abierta?: boolean; razones?: Reason[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? "No se pudo consultar la caja.");
        setOpen(Boolean(data.abierta));
        setReasons(data.razones ?? []);
        if (!data.abierta) setMessage("No hay una caja abierta. Ábrela desde Inicio para registrar movimientos.");
        else setMessage((current) => current.startsWith("No hay una caja abierta.") ? "" : current);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudo consultar la caja.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [syncRevision]);

  const validAmount = /^\d+$/.test(amount) && Number(amount) > 0 && Number(amount) <= 2147483647;
  const canSubmit = open && validAmount && (type === "ingreso" || Boolean(reasonId)) && !saving;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setMessage("");
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/movimiento-caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: type,
          key: requestKey.current,
          movimiento: Number(amount),
          comentario: comment,
          ...(type === "egreso" ? { id_razon: reasonId } : {}),
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "No se pudo registrar el movimiento.");
      setSuccess(true);
      setSaving(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el movimiento.");
      setSaving(false);
    }
  }

  return (
    <main className="cash-movement-shell">
      <header className="cash-movement-topbar">
        <button type="button" aria-label="Volver al inicio" onClick={() => router.push("/home")}><ArrowLeft aria-hidden="true" /></button>
        <h1>Registrar {type}</h1>
      </header>
      {loading ? <CartLoader screen label="Consultando la caja..." /> : success ? (
        <section className="cash-movement-success" role="status">
          <span className="cash-movement-success-icon" aria-hidden="true"><Check /></span>
          <h2>{type === "ingreso" ? "Ingreso" : "Egreso"} registrado exitosamente</h2>
          <button type="button" onClick={() => router.replace("/home")}>Continuar</button>
        </section>
      ) : (
        <form className="cash-movement-form" onSubmit={submit}>
          <h2>{type === "ingreso" ? "Efectivo ingresado" : "Efectivo solicitado"}</h2>
          <label className="cash-movement-amount">
            <span className="sr-only">Monto en pesos</span>
            <span aria-hidden="true">$</span>
            <input
              aria-label="Monto en pesos"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amount}
              disabled={!open || saving}
              onChange={(event) => {
                if (/^\d{0,10}$/.test(event.target.value) && Number(event.target.value || 0) <= 2147483647) { setAmount(event.target.value); requestKey.current = null; }
              }}
            />
            <Pencil aria-hidden="true" />
          </label>
          {type === "egreso" ? (
            <label className="cash-movement-field"><span>Tipo de egreso <em aria-hidden="true">*</em></span>
              <select value={reasonId} disabled={!open || saving} required onChange={(event) => { setReasonId(event.target.value); requestKey.current = null; }}>
                <option value="">Selecciona un tipo de egreso</option>
                {reasons.map((reason) => <option key={reason.id_razon} value={reason.id_razon}>{reason.razon}</option>)}
              </select>
            </label>
          ) : null}
          <label className="cash-movement-field">Comentario
            <input
              type="text"
              maxLength={255}
              placeholder={type === "ingreso" ? "Ej.: Abono para vuelto" : "Ej.: Pago a proveedor"}
              value={comment}
              disabled={!open || saving}
              onChange={(event) => { if (!/['"]/.test(event.target.value)) { setComment(event.target.value); requestKey.current = null; } }}
            />
          </label>
          {message ? <p className="cash-movement-message" role="alert">{message}</p> : null}
          <button className="cash-movement-submit" type="submit" disabled={!canSubmit}>{saving ? "Registrando..." : "Registrar"}</button>
        </form>
      )}
    </main>
  );
}
