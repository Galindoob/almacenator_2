"use client";

import { useRef } from "react";
import { Info } from "lucide-react";

export function CashRoundingNotice({ adjustment }: { adjustment: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = `Redondeo aplicado: $${adjustment > 0 ? "+" : ""}${adjustment}`;

  if (adjustment === 0) return null;

  return (
    <>
      <div className="sales-rounding-notice">
        <strong role="status">{label}</strong>
        <button type="button" onClick={() => dialog.current?.showModal()}>
          Saber más de esta ley <Info size={18} aria-hidden="true" />
        </button>
      </div>
      <dialog ref={dialog} className="sales-rounding-dialog" aria-labelledby="cash-rounding-title">
        <h2 id="cash-rounding-title">{label}</h2>
        <p>El artículo 13 de la ley N° 20.956 dispone que en todos los pagos cuya solución se realice en dinero efectivo, las cantidades iguales o inferiores a $5 se depreciarán a la decena inferior, y las cantidades iguales o superiores a $6 se elevarán a la decena superior.</p>
        <p>Ejemplo redondeo hacia abajo: si el total de la venta que estás haciendo es de $1.325, deberás cobrar $1.320.</p>
        <p>Ejemplo redondeo hacia arriba: si el total de la venta que estás haciendo es de $1.326, deberás cobrar $1.330</p>
        <div className="sales-rounding-actions"><button type="button" autoFocus onClick={() => dialog.current?.close()}>¡OK!</button></div>
      </dialog>
    </>
  );
}
