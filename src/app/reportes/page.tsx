"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Summary = { sales: number; total: number; margin: number };
type DailyReport = Summary & { date: string };
type PaymentMethod = { id_medio: string; medio_de_pago: string };
type ReportResponse = {
  today: string;
  days: DailyReport[];
  todaySummary: Summary;
  periodSummary: Summary;
  paymentMethods: PaymentMethod[];
  message?: string;
};

const EMPTY_SUMMARY: Summary = { sales: 0, total: 0, margin: 0 };

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

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

function formatPaymentMethod(name: string) {
  const normalized = name.trim().toLocaleLowerCase("es-CL");
  if (normalized === "debito") return "Débito";
  if (normalized === "credito") return "Crédito";
  if (normalized === "trasnferencia") return "Transferencia";
  return name.charAt(0).toLocaleUpperCase("es-CL") + name.slice(1);
}

function SummaryGroup({ title, summary, loading }: { title: string; summary: Summary; loading: boolean }) {
  return (
    <section className="reports-summary-group" aria-label={title}>
      <h2>{title}</h2>
      <div className="reports-summary-grid">
        <div className="reports-summary-item">
          <span>Cantidad de ventas</span>
          <strong>{loading ? "—" : summary.sales.toLocaleString("es-CL")}</strong>
        </div>
        <div className="reports-summary-item">
          <span>Monto total</span>
          <strong>{loading ? "—" : formatMoney(summary.total)}</strong>
        </div>
        <div className="reports-summary-item">
          <span>Margen total</span>
          <strong>{loading ? "—" : formatMoney(summary.margin)}</strong>
        </div>
      </div>
    </section>
  );
}

export default function ReportesPage() {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentChileMonth);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, month] = selectedMonth.split("-").map(Number);
  const dayCount = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1));
    return {
      date: `${selectedMonth}-${String(index + 1).padStart(2, "0")}`,
      number: index + 1,
      weekday: new Intl.DateTimeFormat("es-CL", { weekday: "narrow", timeZone: "UTC" }).format(date),
    };
  }), [dayCount, month, selectedMonth, year]);
  const monthLabel = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const dailyValues = useMemo(
    () => new Map((report?.days ?? []).map((day) => [day.date, day])),
    [report],
  );
  const maxDailyTotal = Math.max(0, ...(report?.days ?? []).map((day) => day.total));
  const hasSales = (report?.periodSummary.sales ?? 0) > 0;

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ month: selectedMonth });
    if (paymentMethod) params.set("paymentMethod", paymentMethod);

    fetch(`/api/reportes?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as ReportResponse;
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("jwt");
            router.replace("/login");
          }
          throw new Error(data.message ?? "No se pudo cargar el reporte.");
        }
        return data;
      })
      .then((data) => setReport(data))
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar el reporte.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [paymentMethod, router, selectedMonth]);

  return (
    <section className="reports-content" aria-labelledby="reports-title">
      <header className="reports-heading">
        <h1 id="reports-title">Reporte instantáneo</h1>
      </header>

      <div className="reports-filters">
        <label>
          <span>Método de pago</span>
          <select value={paymentMethod} onChange={(event) => {
            setLoading(true);
            setError("");
            setPaymentMethod(event.target.value);
          }}>
            <option value="">Todos los métodos de pago</option>
            {(report?.paymentMethods ?? []).map((method) => (
              <option key={method.id_medio} value={method.id_medio}>
                {formatPaymentMethod(method.medio_de_pago)}
              </option>
            ))}
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
            onChange={(event) => {
              setLoading(true);
              setError("");
              setSelectedMonth(event.target.value || getCurrentChileMonth());
            }}
          />
        </label>
      </div>

      {error ? <p className="reports-error" role="alert">{error}</p> : null}

      <div className="reports-body" aria-busy={loading}>
        <section className="reports-chart-section" aria-labelledby="reports-chart-title">
          <div className="reports-section-heading">
            <h2 id="reports-chart-title">Ventas por día</h2>
            <span>{monthLabel}</span>
          </div>
          <div className="reports-chart-scroll">
            <div
              className="reports-chart"
              role="img"
              aria-label={hasSales ? `Ventas por día en ${monthLabel}` : `Sin ventas para graficar en ${monthLabel}`}
            >
              {!loading && !hasSales ? <div className="reports-chart-empty">Aún no hay ventas para graficar</div> : null}
              {loading ? <div className="reports-chart-empty">Cargando reporte...</div> : null}
              <div
                className="reports-chart-days"
                style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(25px, 1fr))` }}
              >
                {days.map((day) => {
                  const value = dailyValues.get(day.date);
                  const height = value && maxDailyTotal > 0 ? Math.max(5, (value.total / maxDailyTotal) * 100) : 0;
                  return (
                    <div
                      className={`reports-chart-day${value ? " has-sales" : ""}`}
                      key={day.number}
                      aria-label={value ? `${day.number}: ${value.sales} ventas, ${formatMoney(value.total)}` : `${day.number}: sin ventas`}
                    >
                      <span className="reports-chart-bar-space">
                        {value ? (
                          <span
                            className="reports-chart-bar"
                            style={{ height: `${height}%` }}
                            title={`${value.sales} ventas · ${formatMoney(value.total)}`}
                          />
                        ) : null}
                      </span>
                      <span className="reports-chart-tick" />
                      <strong>{day.number}</strong>
                      <small>{day.weekday}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="reports-summary">
          <SummaryGroup title="Hoy" summary={report?.todaySummary ?? EMPTY_SUMMARY} loading={loading} />
          <SummaryGroup title="Período seleccionado" summary={report?.periodSummary ?? EMPTY_SUMMARY} loading={loading} />
        </aside>
      </div>
    </section>
  );
}
