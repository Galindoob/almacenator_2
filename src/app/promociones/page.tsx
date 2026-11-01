"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Percent, Tag, Gift, Pencil } from "lucide-react";

type Promo = {
  id_promocion: string;
  nombre_promocion: string;
  descripcion: string;
  descuento: number | null;
  cantidad_llevar: number | null;
  cantidad_regalo: number | null;
  combo: number | null;
  precio_combo: number | null;
  tipo_promocion: { tipo: string };
  producto: { id: string; nombre: string; costo: number; precioVenta: number; urlImagen: string | null; marca: { nombre: string } };
};

function money(value: number) { return `$${Math.round(value).toLocaleString("es-CL")}`; }

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeVat, setIncludeVat] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/promociones", { headers: { Authorization: `Bearer ${localStorage.getItem("jwt")}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "No se pudieron cargar las promociones.");
        return data.promociones as Promo[];
      })
      .then((items) => {
        if (controller.signal.aborted) return;
        setPromotions(items);
        setSelectedId(items[0]?.id_promocion ?? null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Error cargando promociones.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => promotions.filter((promo) =>
    `${promo.nombre_promocion} ${promo.producto.nombre} ${promo.tipo_promocion.tipo}`.toLocaleLowerCase("es-CL").includes(search.toLocaleLowerCase("es-CL"))), [promotions, search]);
  const selected = promotions.find((promo) => promo.id_promocion === selectedId) ?? null;
  const priceMultiplier = includeVat ? 1 : 1 / 1.19;
  const costMultiplier = includeVat ? 1.19 : 1;
  const normalPrice = selected ? (selected.tipo_promocion.tipo === "combo" ? selected.producto.precioVenta * (selected.combo ?? 1) : selected.producto.precioVenta) : 0;
  const normalCost = selected ? selected.producto.costo * (selected.tipo_promocion.tipo === "combo" ? selected.combo ?? 1 : 1) : 0;
  const promoPrice = selected ? selected.tipo_promocion.tipo === "descuento"
    ? normalPrice * (1 - (selected.descuento ?? 0) / 100)
    : selected.tipo_promocion.tipo === "combo" ? selected.precio_combo ?? 0
      : normalPrice * (selected.cantidad_llevar ?? 1) / ((selected.cantidad_llevar ?? 1) + (selected.cantidad_regalo ?? 0)) : 0;
  const displayedNormalPrice = normalPrice * priceMultiplier;
  const displayedPromoPrice = promoPrice * priceMultiplier;
  const displayedCost = normalCost * costMultiplier;

  async function deletePromotion(promo: Promo) {
    if (!window.confirm(`¿Eliminar la promoción "${promo.nombre_promocion}" para ${promo.producto.nombre}?`)) return;
    const response = await fetch("/api/promociones", {
      method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwt")}` },
      body: JSON.stringify({ id: promo.id_promocion }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.message ?? "No se pudo eliminar."); return; }
    setPromotions((current) => current.filter((item) => item.id_promocion !== promo.id_promocion));
  }

  return (
    <section className="promotions-content">
      <header className="promotions-page-heading"><h1>Promociones</h1><Link href="/crear_promocion" className="promotions-create-button">Nueva promoción</Link></header>
      <div className="promotions-layout">
        <section className="promotions-list" aria-label="Promociones registradas">
          <label className="promotions-search"><Search aria-hidden="true"/><input type="search" placeholder="Buscar promociones" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="promotions-table-heading"><span>Nombre</span><span>Precio</span><span aria-label="Acciones" /></div>
          <div className="promotions-rows">
            {loading ? <p className="promotions-state">Cargando promociones...</p> : error ? <p className="promotions-state is-error">{error}</p> : filtered.length === 0 ? <p className="promotions-state">No hay promociones registradas.</p> : filtered.map((promo) => (
              <article className={`promotions-row${selectedId === promo.id_promocion ? " is-selected" : ""}`} key={promo.id_promocion}>
                <button type="button" className="promotions-row-select" onClick={() => setSelectedId(promo.id_promocion)}>
                  <strong>{promo.nombre_promocion}</strong><span>{promo.producto.nombre} · {promo.tipo_promocion.tipo}</span>
                </button>
                <span className="promotions-row-price">{money(promo.tipo_promocion.tipo === "combo" ? promo.precio_combo ?? 0 : promo.producto.precioVenta)}</span>
                <button type="button" className="promotions-delete" title="Eliminar promoción" aria-label={`Eliminar ${promo.nombre_promocion}`} onClick={() => void deletePromotion(promo)}><Trash2 aria-hidden="true" /></button>
              </article>
            ))}
          </div>
        </section>
        <aside className="promotion-detail" aria-label="Resumen de promoción">
          {selected ? <>
            <header className="promotion-detail-heading"><span className="promotion-type-icon">{selected.tipo_promocion.tipo === "descuento" ? <Percent/> : selected.tipo_promocion.tipo === "yapa" ? <Gift/> : <Tag/>}</span><div><h2>{selected.nombre_promocion}</h2><p>{selected.tipo_promocion.tipo === "descuento" ? `${selected.descuento}% de descuento` : selected.tipo_promocion.tipo === "yapa" ? `Lleva ${selected.cantidad_llevar} y recibe ${selected.cantidad_regalo} gratis` : `${selected.combo} unidades por ${money(selected.precio_combo ?? 0)}`}</p><span>{selected.producto.nombre} · {selected.producto.marca.nombre}</span></div></header>
            <Link href={`/crear_promocion?id=${encodeURIComponent(selected.id_promocion)}`} className="promotion-edit-button"><Pencil aria-hidden="true" size={17}/>Editar</Link>
            <section className="promotion-price-panel"><h3>Precio de promoción</h3><strong className="promotion-highlight">{money(displayedPromoPrice)}</strong><div className="promotion-comparison"><span></span><b>Sin promo</b><b>Con promo</b><span>Precio</span><strong>{money(displayedNormalPrice)}</strong><strong>{money(displayedPromoPrice)}</strong><span>Costo</span><strong>{money(displayedCost)}</strong><strong>{money(displayedCost)}</strong><span>Margen</span><strong>{money(displayedNormalPrice - displayedCost)}</strong><strong>{money(displayedPromoPrice - displayedCost)}</strong></div></section>
            <label className="promotion-vat-toggle"><span>Valores mostrados</span><button type="button" aria-pressed={includeVat} onClick={() => setIncludeVat((value) => !value)}><span className={!includeVat ? "is-active" : ""}>Sin IVA</span><span className={includeVat ? "is-active" : ""}>Con IVA</span></button></label>
          </> : <p className="promotion-empty-detail">Selecciona una promoción para ver su resumen.</p>}
        </aside>
      </div>
    </section>
  );
}
