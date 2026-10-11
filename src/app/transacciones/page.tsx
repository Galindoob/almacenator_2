"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  function clearFilters() {
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
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);

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
              maxLength={60}
              pattern="[0-9]*"
              placeholder="Buscar por número de venta"
              value={saleNumber}
              onChange={(event) => setSaleNumber(event.target.value.replace(/\D/g, ""))}
            />
          </label>

          <div className="transactions-filter-row">
            <label className="transactions-field">
              <span>Fecha de inicio</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="transactions-field">
              <span>Fecha de término</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label className="transactions-field">
              <span>Estado de la venta</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado completo</option>
                <option value="reservado">Reservado</option>
              </select>
            </label>
            <label className="transactions-field">
              <span>Método de pago</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={loadingPaymentMethods || Boolean(paymentMethodsError)}>
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
              ×
            </button>
          </div>
          {invalidDateRange ? (
            <p className="transactions-date-error" role="alert">
              La fecha de término debe ser igual o posterior a la de inicio.
            </p>
          ) : null}
        </div>

        <div className="transactions-results">
          <div className="transactions-results-header">
            <h2>Ventas</h2>
            <span>0 resultados</span>
          </div>
          <div className="transactions-table-scroll">
            <table className="transactions-table">
              <thead>
                <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={columns.length} className="transactions-empty">
                    <strong>No hay transacciones para mostrar</strong>
                    <span>Las ventas aparecerán aquí cuando estén disponibles.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer className="transactions-pagination">
            <label>
              Filas por página
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span>0–0 de 0</span>
            <nav aria-label="Páginas de transacciones">
              <button type="button" aria-label="Primera página" disabled>«</button>
              <button type="button" aria-label="Página anterior" disabled>‹</button>
              <span aria-current="page">1</span>
              <button type="button" aria-label="Página siguiente" disabled>›</button>
              <button type="button" aria-label="Última página" disabled>»</button>
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}
