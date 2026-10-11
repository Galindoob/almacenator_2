export default function ReporteProductosPage() {
  return (
    <section className="reports-content" aria-labelledby="product-reports-title">
      <header className="reports-heading">
        <h1 id="product-reports-title">Reporte por productos</h1>
      </header>
      <div className="reports-product-empty">
        <strong>Sin reportes de productos todavía</strong>
        <p>Este espacio se completará cuando estén definidos los indicadores de venta.</p>
      </div>
    </section>
  );
}
