"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, RefreshCw, X } from "lucide-react";
import { Navbar } from "../components/Navbar";

const columns = [
  "N° de venta",
  "Documento",
  "Estado",
  "Fecha de creación",
  "Fecha de pago",
  "Método de pago",
  "Pagos",
  "Cliente",
  "Monto total",
  "Cajero",
];

type Transaction = {
  id_venta: string;
  num_venta: number;
  estado: string;
  fecha_de_creacion: string;
  fecha_pago: string | null;
  valor_total: number;
  recibo: string | null;
  cajero: string;
  pagos: { id_pago: string; id_medio_pago: string; medio_de_pago: string; pago: number }[];
};
type TransactionResults = { transactions: Transaction[]; total: number; page: number; pages: number };
const emptyResults: TransactionResults = { transactions: [], total: 0, page: 1, pages: 1 };
const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function formatDate(value: string | null) { return value ? dateFormatter.format(new Date(value)) : "N/A"; }
function formatAmount(value: number) { return `$${value.toLocaleString("es-CL")}`; }
function paymentTone(name: string) {
  const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return ({ efectivo: "cash", debito: "debit", credito: "credit", transferencia: "transfer", trasnferencia: "transfer", edenred: "edenred" } as Record<string, string>)[key] ?? "other";
}
function paymentName(name: string) {
  const key = name.trim().toLowerCase();
  return ({ debito: "Débito", credito: "Crédito", trasnferencia: "Transferencia" } as Record<string, string>)[key] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export default function TransaccionesPage() {
  const router = useRouter();
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [saleNumber, setSaleNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{ id_medio: string; medio_de_pago: string }[]>([]);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<TransactionResults>(emptyResults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string; saleNumber: number } | null>(null);
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!isActive) return;
        if (response.ok) {
          setIsSessionVerified(true);
          return;
        }
        if (response.status === 401) localStorage.removeItem("jwt");
        router.replace("/login");
      })
      .catch(() => {
        if (isActive) router.replace("/login");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [router]);

  useEffect(() => {
    if (!isSessionVerified) return;

    const controller = new AbortController();
    const token = localStorage.getItem("jwt");

    fetch("/api/medio-pago", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los medios de pago.");
        return response.json() as Promise<{ paymentMethods: { id_medio: string; medio_de_pago: string }[] }>;
      })
      .then((result) => setPaymentMethods(result.paymentMethods))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setPaymentMethodsError(error instanceof Error ? error.message : "No se pudieron cargar los medios de pago.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPaymentMethods(false);
      });

    return () => controller.abort();
  }, [isSessionVerified]);

  useEffect(() => {
    if (!isSessionVerified || invalidDateRange) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ saleNumber, startDate, endDate, status, paymentMethod, page: String(page), pageSize: String(pageSize) });
        const response = await fetch(`/api/transacciones?${query}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("jwt")}` },
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) { localStorage.removeItem("jwt"); router.replace("/login"); }
          throw new Error(data.message ?? "No se pudieron cargar las transacciones.");
        }
        if (!controller.signal.aborted) setResults(data as TransactionResults);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [isSessionVerified, invalidDateRange, saleNumber, startDate, endDate, status, paymentMethod, page, pageSize, refresh, router]);

  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);

  useEffect(() => {
    if (!selectedReceipt) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedReceipt(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [selectedReceipt]);

  function changeFilter(update: () => void) {
    update();
    setPage(1);
    setLoading(true);
    setRefresh((value) => value + 1);
  }

  function clearFilters() {
    setPage(1);
    setLoading(true);
    setSaleNumber("");
    setStartDate("");
    setEndDate("");
    setStatus("");
    setPaymentMethod("");
  }

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  if (!isSessionVerified) {
    return (
      <main className="transactions-shell">
        <p className="transactions-verifying" role="status">Verificando sesión...</p>
      </main>
    );
  }

  const hasFilters = Boolean(saleNumber || startDate || endDate || status || paymentMethod);
  const tableUnavailable = loading || Boolean(error) || invalidDateRange;

  return (
    <main className="transactions-shell">
      <Navbar onLogout={handleLogout} compact />
      <section className="transactions-content" aria-labelledby="transactions-title">
        <header className="transactions-heading">
          <h1 id="transactions-title">Transacciones</h1>
        </header>

        <div className="transactions-filters">
          <label className="transactions-search">
            <span className="sr-only">Buscar por número de venta</span>
            <input
              type="search"
              inputMode="numeric"
              maxLength={25}
              pattern="[0-9]*"
              placeholder="Buscar por número de venta"
              value={saleNumber}
              onChange={(event) => changeFilter(() => setSaleNumber(event.target.value.replace(/\D/g, "")))}
            />
          </label>

          <div className="transactions-filter-row">
            <label className="transactions-field">
              <span>Fecha de inicio</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => changeFilter(() => setStartDate(event.target.value))}
              />
            </label>
            <label className="transactions-field">
              <span>Fecha de término</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => changeFilter(() => setEndDate(event.target.value))}
              />
            </label>
            <label className="transactions-field">
              <span>Estado de la venta</span>
              <select value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value))}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="completado">Completado</option>
                <option value="pagado">Pagado completo</option>
                <option value="reservado">Reservado</option>
              </select>
            </label>
            <label className="transactions-field">
              <span>Método de pago</span>
              <select value={paymentMethod} onChange={(event) => changeFilter(() => setPaymentMethod(event.target.value))} disabled={loadingPaymentMethods || Boolean(paymentMethodsError)}>
                <option value="">{loadingPaymentMethods ? "Cargando métodos..." : paymentMethodsError || "Todos los métodos"}</option>
                {paymentMethods.map((method) => (
                  <option key={method.id_medio} value={method.id_medio}>
                    {method.medio_de_pago}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="transactions-clear"
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {invalidDateRange ? (
            <p className="transactions-date-error" role="alert">
              La fecha de término debe ser igual o posterior a la de inicio.
            </p>
          ) : null}
        </div>

        <div className="transactions-results" aria-busy={loading && !invalidDateRange}>
          <div className="transactions-results-header">
            <h2>Ventas</h2>
            <div className="transactions-result-actions">
              <span role="status">{tableUnavailable ? "" : `${results.total} resultados`}</span>
              <button type="button" className="transactions-refresh" title="Actualizar transacciones" aria-label="Actualizar transacciones" disabled={loading || invalidDateRange} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="transactions-table-scroll">
            <table className="transactions-table">
              <thead>
                <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
              </thead>
              <tbody>
                {tableUnavailable ? <tr><td colSpan={columns.length} className="transactions-empty">
                  <span role={error ? "alert" : "status"}>{invalidDateRange ? "Revisa el rango de fechas." : error || "Cargando transacciones..."}</span>
                </td></tr> : results.transactions.length ? results.transactions.map((transaction) => (
                  <tr key={transaction.id_venta}>
                    <td>{transaction.num_venta}</td>
                    <td>
                      {transaction.recibo ? (
                        <button
                          className="transactions-receipt-button"
                          type="button"
                          onClick={() => setSelectedReceipt({ url: transaction.recibo as string, saleNumber: transaction.num_venta })}
                        >
                          <Eye size={17} aria-hidden="true" /> Ver
                        </button>
                      ) : null}
                    </td>
                    <td className="transactions-sale-status">{transaction.estado}</td>
                    <td className="transactions-date">{formatDate(transaction.fecha_de_creacion)}</td>
                    <td className="transactions-date">{formatDate(transaction.fecha_pago)}</td>
                    <td><div className="transaction-payment-stack">
                      {transaction.pagos.length ? transaction.pagos.map((payment) => (
                        <span key={payment.id_pago} className="transaction-payment-badge" data-tone={paymentTone(payment.medio_de_pago)} title={`${paymentName(payment.medio_de_pago)}: ${formatAmount(payment.pago)}`}>
                          {paymentName(payment.medio_de_pago)}
                        </span>
                      )) : <span className="transaction-payment-badge" data-tone="other">Sin pago</span>}
                    </div></td>
                    <td><div className="transaction-payment-stack">
                      {transaction.pagos.length ? transaction.pagos.map((payment) => (
                        <span key={payment.id_pago} className="transaction-payment-badge" data-tone={paymentTone(payment.medio_de_pago)} title={paymentName(payment.medio_de_pago)} aria-label={`${paymentName(payment.medio_de_pago)}: ${formatAmount(payment.pago)}`}>
                          {formatAmount(payment.pago)}
                        </span>
                      )) : <span className="transaction-payment-badge" data-tone="other">{formatAmount(0)}</span>}
                    </div></td>
                    <td />
                    <td className="transactions-amount">{formatAmount(transaction.valor_total)}</td>
                    <td>{transaction.cajero}</td>
                  </tr>
                )) : (
                <tr>
                  <td colSpan={columns.length} className="transactions-empty">
                    <strong>No hay transacciones para mostrar</strong>
                    <span>{hasFilters ? "No hay ventas que coincidan con los filtros." : "Aún no hay ventas registradas."}</span>
                  </td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="transactions-pagination">
            <label>
              Filas por página
              <select value={pageSize} onChange={(event) => changeFilter(() => setPageSize(Number(event.target.value)))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span>{tableUnavailable ? "" : `${results.total ? (results.page - 1) * pageSize + 1 : 0}–${Math.min(results.page * pageSize, results.total)} de ${results.total}`}</span>
            <nav aria-label="Páginas de transacciones">
              <button type="button" aria-label="Primera página" title="Primera página" disabled={tableUnavailable || results.page <= 1} onClick={() => { setPage(1); setLoading(true); }}><ChevronsLeft size={18} /></button>
              <button type="button" aria-label="Página anterior" title="Página anterior" disabled={tableUnavailable || results.page <= 1} onClick={() => { setPage(results.page - 1); setLoading(true); }}><ChevronLeft size={18} /></button>
              <span aria-current="page">{results.page}</span>
              <button type="button" aria-label="Página siguiente" title="Página siguiente" disabled={tableUnavailable || results.page >= results.pages} onClick={() => { setPage(results.page + 1); setLoading(true); }}><ChevronRight size={18} /></button>
              <button type="button" aria-label="Última página" title="Última página" disabled={tableUnavailable || results.page >= results.pages} onClick={() => { setPage(results.pages); setLoading(true); }}><ChevronsRight size={18} /></button>
            </nav>
          </footer>
        </div>
      </section>
      {selectedReceipt ? (
        <div
          className="transactions-receipt-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedReceipt(null);
          }}
        >
          <section
            className="transactions-receipt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transactions-receipt-title"
          >
            <header>
              <h2 id="transactions-receipt-title">Recibo N° {selectedReceipt.saleNumber}</h2>
              <button type="button" onClick={() => setSelectedReceipt(null)} title="Cerrar recibo" aria-label="Cerrar recibo">
                <X size={22} aria-hidden="true" />
              </button>
            </header>
            <div className="transactions-receipt-image-scroll">
              {/* The generated receipt has a variable intrinsic height. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedReceipt.url} alt={`Recibo de la venta ${selectedReceipt.saleNumber}`} />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
