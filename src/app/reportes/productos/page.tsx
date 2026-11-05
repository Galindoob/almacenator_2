"use client";

import { useEffect, useMemo, useState } from "react";
import { endSession } from "@/lib/client-session";
import { CartLoader } from "../../components/CartLoader";
import { useBarcodeScanner } from "../../components/useBarcodeScanner";

type Product = { id: string; nombre: string; codigoBarra: string | null; contenido: number | null; marca: { nombre: string }; categoria: { nombreCategoria: string }; unidad: { unidad: string }; unidad_medida_productos_unidad_medidaTounidad_medida: { nombre: string } | null };
type Totals = { id: string; quantity: number; revenue: number; cost: number; sales: number };
type Period = { quantity: number; revenue: number; cost: number };
type Report = { selectedId: string | null; products: Product[]; totals: Totals[]; daily: (Period & { date: string })[]; monthly: (Period & { month: string })[]; message?: string };
const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;
const amount = (value: number) => value.toLocaleString("es-CL", { maximumFractionDigits: 3 });

function chileMonth() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthName(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export default function ReporteProductosPage() {
  const [month, setMonth] = useState(chileMonth);
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [rankingMetric, setRankingMetric] = useState<"revenue" | "margin">("revenue");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ month });
    if (productId) params.set("productId", productId);
    fetch(`/api/reportes/productos?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as Report;
        if (!response.ok) {
          if (response.status === 401) void endSession();
          throw new Error(data.message ?? "No se pudo cargar el reporte.");
        }
        setReport(data);
        setError("");
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se pudo cargar el reporte."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, productId]);

  const selectedId = report?.selectedId;
  const selected = report?.products.find((product) => product.id === selectedId);
  const totals = report?.totals.find((row) => row.id === selectedId) ?? { quantity: 0, revenue: 0, cost: 0, sales: 0 };
  const margin = totals.revenue - totals.cost;
  const marginRate = totals.revenue ? margin / totals.revenue * 100 : 0;
  const allRevenue = (report?.totals ?? []).reduce((sum, row) => sum + row.revenue, 0);
  const share = allRevenue ? totals.revenue / allRevenue * 100 : 0;
  const productMap = useMemo(() => new Map((report?.products ?? []).map((product) => [product.id, product])), [report]);
  const filtered = useMemo(() => (report?.products ?? []).filter((product) => `${product.nombre} ${product.marca.nombre} ${product.categoria.nombreCategoria} ${product.codigoBarra ?? ""}`.toLocaleLowerCase("es-CL").includes(search.trim().toLocaleLowerCase("es-CL"))), [report, search]);
  const dayCount = useMemo(() => { const [year, value] = month.split("-").map(Number); return new Date(Date.UTC(year, value, 0)).getUTCDate(); }, [month]);
  const dailyMap = new Map((report?.daily ?? []).map((row) => [row.date, row]));
  const days = Array.from({ length: dayCount }, (_, index) => ({ day: index + 1, value: dailyMap.get(`${month}-${String(index + 1).padStart(2, "0")}`) }));
  const maxDaily = Math.max(0, ...days.map((day) => day.value?.revenue ?? 0));
  const monthlyMap = new Map((report?.monthly ?? []).map((row) => [row.month, row]));
  const months = Array.from({ length: 6 }, (_, index) => { const key = shiftMonth(month, index - 5); return { key, value: monthlyMap.get(key) }; });
  const maxMonthly = Math.max(0, ...months.flatMap((item) => [item.value?.revenue ?? 0, Math.abs((item.value?.revenue ?? 0) - (item.value?.cost ?? 0))]));
  const rankingValue = (row: Totals) => rankingMetric === "revenue" ? row.revenue : row.revenue - row.cost;
  const top = [...(report?.totals ?? [])].sort((a, b) => rankingValue(b) - rankingValue(a)).slice(0, 5);
  const maxTop = Math.max(0, ...top.map(rankingValue));
  const unit = selected?.unidad.unidad.toLocaleLowerCase("es-CL").includes("peso") ? "kg" : "unidades";
  function chooseProduct(id: string) { if (id !== selectedId) { setProductId(id); setLoading(true); setError(""); } }
  const { onSearchKeyDown } = useBarcodeScanner((code) => {
    const normalized = code.trim();
    if (!normalized) return;
    setSearch(normalized);
    const product = report?.products.find((item) => item.codigoBarra?.trim() === normalized);
    if (product) chooseProduct(product.id);
  }, Boolean(report));

  return (
    <section className="reports-content product-report" aria-labelledby="product-reports-title">
      <header className="reports-heading product-report-heading">
        <div><p className="product-report-eyebrow">Análisis de ventas</p><h1 id="product-reports-title">Reporte por producto</h1><p>Explora qué se vendió, cuánto ingresó y qué margen dejó cada producto.</p></div>
        <label className="product-report-month">Período<input type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setLoading(true); } }} /></label>
      </header>
      {error ? <p className="reports-error" role="alert">{error}</p> : null}
      <div className="product-report-layout" aria-busy={loading}>
        <aside className="product-report-sidebar" aria-label="Seleccionar producto">
          <div className="product-report-sidebar-head"><h2>Productos</h2><span>{report?.products.length ?? 0}</span></div>
          <input type="search" value={search} maxLength={100} placeholder="Buscar nombre, marca, categoría o código" aria-label="Buscar producto" onKeyDown={onSearchKeyDown} onChange={(event) => setSearch(event.target.value)} />
          <div className="product-report-product-list">
            {filtered.map((product) => <button key={product.id} type="button" className={product.id === selectedId ? "is-selected" : ""} aria-pressed={product.id === selectedId} onClick={() => chooseProduct(product.id)}><strong>{product.nombre}</strong><small>{product.marca.nombre} · {product.categoria.nombreCategoria}</small></button>)}
            {!loading && !filtered.length ? <p>{report?.products.length ? "No hay productos que coincidan." : "Todavía no hay productos."}</p> : null}
          </div>
        </aside>
        <div className="product-report-main">
          {loading && !report ? <div className="product-report-panel product-report-wait"><CartLoader label="Cargando datos de ventas..." /></div> : null}
          {!loading && !selected ? <div className="product-report-panel product-report-wait">Agrega un producto para comenzar a analizar ventas.</div> : null}
          {selected ? <>
            <div className="product-report-selected"><div><span>Producto seleccionado</span><h2>{selected.nombre}</h2><p>{selected.marca.nombre} · {selected.categoria.nombreCategoria} · {selected.unidad.unidad}{selected.contenido && selected.unidad_medida_productos_unidad_medidaTounidad_medida ? ` · ${selected.contenido} ${selected.unidad_medida_productos_unidad_medidaTounidad_medida.nombre}` : ""}</p></div><span className="product-report-period">{monthName(month)} {month.slice(0, 4)}</span></div>
            <div className="product-report-kpis">
              <div><span>Ventas con este producto</span><strong>{totals.sales.toLocaleString("es-CL")}</strong><small>Transacciones completadas</small></div>
              <div><span>Cantidad vendida</span><strong>{amount(totals.quantity)}</strong><small>{unit}</small></div>
              <div><span>Ingresos</span><strong>{money(totals.revenue)}</strong><small>Importe cobrado</small></div>
              <div><span>Margen estimado</span><strong className={margin < 0 ? "is-negative" : ""}>{money(margin)}</strong><small>{marginRate.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% de ingresos</small></div>
            </div>
            <div className="product-report-charts">
              <section className="product-report-panel product-report-daily" aria-labelledby="daily-product-title"><header><div><h3 id="daily-product-title">Ingresos por día</h3><p>Importe cobrado por este producto durante el mes</p></div><b>{money(totals.revenue)}</b></header>
                <div className="product-report-daily-scroll"><div className="product-report-daily-plot" role="img" aria-label={`Ingresos diarios de ${selected.nombre} en ${month}`} style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(20px, 1fr))` }}>
                  {days.map(({ day, value }) => <div key={day} className="product-report-day" title={`${day}/${month.slice(5)}/${month.slice(0, 4)} · ${money(value?.revenue ?? 0)} · ${amount(value?.quantity ?? 0)} ${unit}`}><span className="product-report-day-space"><i style={{ height: `${maxDaily && value?.revenue ? Math.max(3, value.revenue / maxDaily * 100) : 0}%` }} /></span><small>{day}</small></div>)}
                </div></div>{!loading && !totals.sales ? <p className="product-report-no-data">Sin ventas de este producto en el período seleccionado.</p> : null}</section>
              <section className="product-report-panel product-report-share" aria-labelledby="share-title"><header><h3 id="share-title">Participación en ingresos</h3><p>Frente a todos los productos del mes</p></header><div className="product-report-donut" style={{ background: `conic-gradient(var(--accent-color) ${share}%, var(--light-primary-color) ${share}% 100%)` }} role="img" aria-label={`${share.toFixed(1)}% de los ingresos del mes`}><span><strong>{share.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%</strong><small>del total</small></span></div><p>{money(totals.revenue)} de {money(allRevenue)} vendidos en el mes</p></section>
              <section className="product-report-panel product-report-trend" aria-labelledby="trend-title"><header><h3 id="trend-title">Evolución de los últimos 6 meses</h3><p>Ingresos y margen estimado del producto</p></header><div className="product-report-legend"><span><i />Ingresos</span><span><i />Margen</span></div><div className="product-report-monthly" role="img" aria-label={`Evolución de ventas de ${selected.nombre} durante seis meses`}>
                {months.map((item) => { const revenue = item.value?.revenue ?? 0; const earned = revenue - (item.value?.cost ?? 0); return <div key={item.key} title={`${monthName(item.key)} ${item.key.slice(0, 4)} · ingresos ${money(revenue)} · margen ${money(earned)}`}><span className="product-report-month-bars"><i style={{ height: `${maxMonthly ? revenue / maxMonthly * 100 : 0}%` }} /><i className={earned < 0 ? "is-negative" : ""} style={{ height: `${maxMonthly ? Math.min(100, Math.abs(earned) / maxMonthly * 100) : 0}%` }} /></span><small>{monthName(item.key)}</small></div>; })}
              </div></section>
              <section className="product-report-panel product-report-ranking" aria-labelledby="ranking-title"><header><h3 id="ranking-title">Productos destacados</h3><p>Comparación del período seleccionado</p></header><div className="product-report-rank-tabs" role="group" aria-label="Ordenar productos"><button type="button" className={rankingMetric === "revenue" ? "is-selected" : ""} aria-pressed={rankingMetric === "revenue"} onClick={() => setRankingMetric("revenue")}>Por ingresos</button><button type="button" className={rankingMetric === "margin" ? "is-selected" : ""} aria-pressed={rankingMetric === "margin"} onClick={() => setRankingMetric("margin")}>Por margen</button></div>{top.length ? <div className="product-report-rank-list">{top.map((row, index) => <button type="button" key={row.id} onClick={() => chooseProduct(row.id)} aria-pressed={row.id === selectedId}><span>{index + 1}. {productMap.get(row.id)?.nombre ?? "Producto"}</span><strong>{money(rankingValue(row))}</strong><i><span style={{ width: `${maxTop ? Math.max(0, rankingValue(row)) / maxTop * 100 : 0}%` }} /></i></button>)}</div> : <p className="product-report-no-data">Todavía no hay ventas completadas en este mes.</p>}</section>
            </div>
            <p className="product-report-note">Se consideran ventas completadas según su fecha de pago en Chile. El margen es el subtotal del detalle menos su costo de adquisición; no incluye otros gastos ni asigna el redondeo del pago en efectivo a cada producto.</p>
          </> : null}
        </div>
      </div>
    </section>
  );
}
