"use client";

import { useState } from "react";

const paymentMethods = [
  ["", "Todos los métodos de pago"],
  ["efectivo", "Efectivo"],
  ["debito", "Débito"],
  ["credito", "Crédito"],
  ["transferencia", "Transferencia"],
  ["replay", "Replay"],
] as const;

function getCurrentChileMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function SummaryGroup({ title }: { title: string }) {
  return (
    <section className="reports-summary-group" aria-label={title}>
      <h2>{title}</h2>
      <div className="reports-summary-grid">
        <div className="reports-summary-item">
          <span>Cantidad de ventas</span>
          <strong>—</strong>
        </div>
        <div className="reports-summary-item">
          <span>Monto total</span>
          <strong>—</strong>
        </div>
        <div className="reports-summary-item">
          <span>Margen total</span>
          <strong>—</strong>
        </div>
      </div>
    </section>
  );
}

export default function ReportesPage() {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentChileMonth);
  const [year, month] = selectedMonth.split("-").map(Number);
  const dayCount = new Date(year, month, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1));
    return {
      number: index + 1,
      weekday: new Intl.DateTimeFormat("es-CL", {
        weekday: "narrow",
        timeZone: "UTC",
      }).format(date),
    };
  });
  const monthLabel = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <section className="reports-content" aria-labelledby="reports-title">
      <header className="reports-heading">
        <h1 id="reports-title">Reporte instantáneo</h1>
      </header>

      <div className="reports-filters">
        <label>
          <span>Método de pago</span>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Caja</span>
          <select defaultValue="all">
            <option value="all">Todas las cajas</option>
          </select>
        </label>
        <label>
          <span>Mes</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || getCurrentChileMonth())}
          />
        </label>
      </div>

      <div className="reports-body">
        <section className="reports-chart-section" aria-labelledby="reports-chart-title">
          <div className="reports-section-heading">
            <h2 id="reports-chart-title">Ventas por día</h2>
            <span>{monthLabel}</span>
          </div>
          <div className="reports-chart-scroll">
            <div className="reports-chart" role="img" aria-label={`Sin ventas para graficar en ${monthLabel}`}>
              <div className="reports-chart-empty">Aún no hay ventas para graficar</div>
              <div
                className="reports-chart-days"
                style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(25px, 1fr))` }}
              >
                {days.map((day) => (
                  <div className="reports-chart-day" key={day.number}>
                    <span className="reports-chart-tick" />
                    <strong>{day.number}</strong>
                    <small>{day.weekday}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="reports-summary">
          <SummaryGroup title="Hoy" />
          <SummaryGroup title="Período seleccionado" />
        </aside>
      </div>
    </section>
  );
}
