"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Search, Check } from "lucide-react";
import { isSafeAppInput, isSafeDescriptionInput } from "@/lib/input-validation";
import { useBarcodeScanner } from "../components/useBarcodeScanner";

type Product = { id: string; nombre: string; codigoBarra: string | null; precioVenta: number; costo: number; stock: number; urlImagen: string | null; categoriaId: string; marca: { nombre: string }; categoria: { nombreCategoria: string } };
type PromoKind = "descuento" | "yapa" | "combo";
type EditablePromotion = {
  id_promocion: string;
  nombre_promocion: string;
  descripcion: string;
  descuento: number | null;
  cantidad_llevar: number | null;
  cantidad_regalo: number | null;
  combo: number | null;
  precio_combo: number | null;
  tipo_promocion: { tipo: PromoKind };
  producto: { id: string };
};
const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

function CreatePromotionForm() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const [products, setProducts] = useState<Product[]>([]);
  const [productPromotions, setProductPromotions] = useState<{ id_promocion: string; id_productos: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [kind, setKind] = useState<PromoKind>("descuento");
  const [discount, setDiscount] = useState("10");
  const [take, setTake] = useState("2");
  const [gift, setGift] = useState("1");
  const [comboCount, setComboCount] = useState("2");
  const [comboPrice, setComboPrice] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedEdit, setLoadedEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = editId;
    const controller = new AbortController();
    const headers = {};
    async function load() {
      const [productResponse, promotionResponse, promotionsResponse] = await Promise.all([
        fetch("/api/producto", { headers, cache: "no-store", signal: controller.signal }),
        id ? fetch(`/api/promociones?id=${encodeURIComponent(id)}`, { headers, cache: "no-store", signal: controller.signal }) : Promise.resolve(null),
        fetch("/api/promociones", { headers, cache: "no-store", signal: controller.signal }),
      ]);
      const productData = await productResponse.json();
      if (!productResponse.ok) throw new Error(productData.message ?? "No se pudieron cargar los productos.");
      const promotionsData = await promotionsResponse.json();
      if (!promotionsResponse.ok) throw new Error(promotionsData.message ?? "No se pudieron cargar las promociones.");
      let promotion: EditablePromotion | null = null;
      if (promotionResponse) {
        const promotionData = await promotionResponse.json();
        if (!promotionResponse.ok) throw new Error(promotionData.message ?? "No se pudo cargar la promoción.");
        promotion = promotionData.promocion as EditablePromotion;
      }
      if (controller.signal.aborted) return;
      setProducts(productData.productos ?? []);
      setProductPromotions(promotionsData.promociones ?? []);
      if (promotion) {
        setKind(promotion.tipo_promocion.tipo);
        setSelectedIds([promotion.producto.id]);
        setDiscount(String(promotion.descuento ?? 10));
        setTake(String(promotion.cantidad_llevar ?? 2));
        setGift(String(promotion.cantidad_regalo ?? 1));
        setComboCount(String(promotion.combo ?? 2));
        setComboPrice(promotion.precio_combo === null ? "" : String(promotion.precio_combo));
        setName(promotion.nombre_promocion);
        setDescription(promotion.descripcion);
        setLoadedEdit(true);
      }
    }
    void load().catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [editId]);

  const selectedProducts = useMemo(() => products.filter((product) => selectedIds.includes(product.id)), [products, selectedIds]);
  const categories = useMemo(() => Array.from(new Map(products.map((product) => [product.categoriaId, product.categoria.nombreCategoria])).entries())
    .sort((a, b) => a[1].localeCompare(b[1], "es-CL")), [products]);
  const visibleProducts = useMemo(() => products.filter((product) =>
    (!categoryId || product.categoriaId === categoryId) &&
    `${product.nombre} ${product.marca.nombre} ${product.categoria.nombreCategoria} ${product.codigoBarra ?? ""}`
      .toLocaleLowerCase("es-CL").includes(search.toLocaleLowerCase("es-CL"))), [products, search, categoryId]);
  const count = Number(kind === "combo" ? comboCount : take);
  const guidePrice = kind === "combo" && selectedProducts.length === 1 && Number.isInteger(count) && count > 0
    ? selectedProducts[0].precioVenta * count : 0;

  function updateNumber(setter: (value: string) => void, value: string) {
    if (/^\d*$/.test(value) && value.length <= 9) setter(value);
  }

  function toggleProduct(id: string) {
    if (productPromotions.some((promotion) => promotion.id_productos === id && promotion.id_promocion !== editId)) return;
    if (kind === "combo" || editId) {
      setSelectedIds((current) => current.includes(id) ? [] : [id]);
      setComboPrice("");
      return;
    }
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const { onSearchKeyDown } = useBarcodeScanner((code) => {
    const normalized = code.trim();
    if (!normalized || !isSafeAppInput(normalized)) return;
    setSearch(normalized);
    setCategoryId("");
    const product = products.find((item) => item.codigoBarra?.trim() === normalized);
    if (!product || productPromotions.some((promotion) => promotion.id_productos === product.id && promotion.id_promocion !== editId)) return;
    if (kind === "combo" || editId) {
      setSelectedIds([product.id]);
      setComboPrice("");
    } else {
      setSelectedIds((current) => current.includes(product.id) ? current : [...current, product.id]);
    }
  }, modalOpen && !loading && !saving);

  function selectKind(value: PromoKind) {
    setKind(value);
    if (value === "combo" || editId) {
      setSelectedIds((current) => current.slice(0, 1));
      setComboPrice("");
    }
  }

  function updateComboCount(value: string) {
    if (!/^\d*$/.test(value) || value.length > 9) return;
    setComboCount(value);
    const selected = products.find((product) => product.id === selectedIds[0]);
    const newLimit = selected ? selected.precioVenta * Number(value) : 0;
    if (comboPrice && (!newLimit || Number(comboPrice) > newLimit)) setComboPrice("");
  }

  function updateComboPrice(value: string) {
    if (/^\d*$/.test(value) && value.length <= 9 && (value === "" || Number(value) <= guidePrice)) setComboPrice(value);
  }

  async function createPromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim() || !isSafeAppInput(name) || !isSafeDescriptionInput(description)) { setError("Revisa el nombre y la descripción: no deben incluir comillas ni superar sus límites."); return; }
    if (editId && !loadedEdit) { setError("No se pudo cargar la promoción para editarla."); return; }
    if (!selectedIds.length) { setError("Selecciona al menos un producto."); return; }
    if (editId && selectedIds.length !== 1) { setError("Selecciona un solo producto para editar esta promoción."); return; }
    if (kind === "combo" && selectedIds.length !== 1) { setError("El combo debe incluir un solo producto."); return; }
    if (kind === "combo" && (!Number(comboCount) || !Number(comboPrice) || Number(comboPrice) > guidePrice)) { setError("El precio del combo debe ser positivo y no superar el precio normal de las unidades."); return; }
    if (kind === "descuento" && (Number(discount) <= 0 || Number(discount) > 100)) { setError("El descuento debe ser mayor que 0 y hasta 100%."); return; }
    if (kind === "yapa" && (!Number(take) || !Number(gift))) { setError("Ingresa cantidades válidas para llevar y regalar."); return; }

    setSaving(true);
    try {
      const response = await fetch("/api/promociones", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editId ? { id: editId } : {}), tipo: kind, nombre: name.trim(), descripcion: description.trim(), productos: selectedIds,
          ...(kind === "descuento" ? { descuento: Number(discount) } : {}),
          ...(kind === "yapa" ? { cantidadLlevar: Number(take), cantidadRegalo: Number(gift) } : {}),
          ...(kind === "combo" ? { combo: Number(comboCount), precioCombo: Number(comboPrice) } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? (editId ? "No se pudo guardar la promoción." : "No se pudo crear la promoción."));
      router.push("/promociones");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la promoción.");
    } finally { setSaving(false); }
  }

  return (
    <section className="promotion-create-content">
      <header className="promotion-create-heading"><Link href="/promociones" aria-label="Volver a promociones">←</Link><h1>{editId ? "Editar promoción" : "Nueva promoción"}</h1></header>
      <form className="promotion-create-form" onSubmit={createPromotion}>
        <h2>{editId ? "Editar promoción" : "Crear una promoción"}</h2>
        <fieldset className="promotion-kind-picker"><legend>¿Qué tipo de promo deseas crear?</legend>
          {(["descuento", "yapa", "combo"] as const).map((option) => <button key={option} type="button" className={kind === option ? "is-selected" : ""} aria-pressed={kind === option} onClick={() => selectKind(option)}>{option === "yapa" ? "Yapa (compra y recibe gratis)" : option.charAt(0).toUpperCase() + option.slice(1)}</button>)}
        </fieldset>
        <div className="promotion-product-select"><div><strong>{kind === "combo" || editId ? "Selecciona un producto" : "Selecciona el o los productos"}</strong><span>{selectedProducts.length ? selectedProducts.map((product) => product.nombre).join(", ") : "Ningún producto seleccionado"}</span></div><button type="button" onClick={() => setModalOpen(true)}>{kind === "combo" || editId ? "Elegir producto" : "Elegir productos"}</button></div>
        <div className="promotion-parameters">
          {kind === "descuento" ? <label>Porcentaje de descuento<input type="number" min="1" max="100" value={discount} onChange={(event) => updateNumber(setDiscount, event.target.value)} required/><span>%</span></label> : null}
          {kind === "yapa" ? <><label>Unidades que lleva<input type="number" min="1" value={take} onChange={(event) => updateNumber(setTake, event.target.value)} required/></label><span className="promotion-times">+</span><label>Unidades de regalo<input type="number" min="1" value={gift} onChange={(event) => updateNumber(setGift, event.target.value)} required/></label></> : null}
          {kind === "combo" ? <><label>Unidades del combo<input type="number" min="1" value={comboCount} onChange={(event) => updateComboCount(event.target.value)} required/></label><label>Precio especial<input type="number" min="1" max={guidePrice || undefined} value={comboPrice} onChange={(event) => updateComboPrice(event.target.value)} disabled={!guidePrice} required/></label><p className="promotion-guide-price">{selectedProducts.length === 1 ? <>Precio normal de {comboCount || 0} unidad(es): <strong>{money(guidePrice)}</strong>. El precio especial no puede superar este valor.</> : "Selecciona un producto para calcular el precio máximo del combo."}</p></> : null}
        </div>
        <div className="promotion-create-fields"><label>Nombre de la promoción<input maxLength={60} value={name} onChange={(event) => { if (isSafeAppInput(event.target.value)) setName(event.target.value); }} placeholder="Ej.: Promo Pisco, Combo jugos" required/></label><label>Descripción<textarea maxLength={200} value={description} onChange={(event) => { if (isSafeDescriptionInput(event.target.value)) setDescription(event.target.value); }} placeholder="Describe las condiciones de la promoción"/></label></div>
        {error ? <p className="promotion-form-error" role="alert">{error}</p> : null}
        <footer className="promotion-form-actions"><Link href="/promociones">Cancelar</Link><button type="submit" disabled={saving || loading || Boolean(editId && !loadedEdit)}>{saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear promoción"}</button></footer>
      </form>
      {modalOpen ? (
        <div className="promotion-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="promotion-product-modal" role="dialog" aria-modal="true" aria-labelledby="promotion-products-title">
            <header>
              <h2 id="promotion-products-title">{kind === "combo" || editId ? "Seleccionar un producto" : "Seleccionar productos"}</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setModalOpen(false)}><X/></button>
            </header>
            <label className="promotions-search"><Search/><input placeholder="Buscar producto, categoría o código de barras" value={search} onKeyDown={onSearchKeyDown} onChange={(event) => setSearch(event.target.value)}/></label>
            <label className="promotion-category-filter">
              <span>Categoría</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map(([id, categoryName]) => <option key={id} value={id}>{categoryName}</option>)}
              </select>
            </label>
            <div className="promotion-product-options">
              {loading ? <p>Cargando productos...</p> : visibleProducts.length === 0 ? <p>No hay productos para esta búsqueda.</p> : visibleProducts.map((product) => (
                <button type="button" key={product.id} aria-pressed={selectedIds.includes(product.id)}
                  disabled={productPromotions.some((promotion) => promotion.id_productos === product.id && promotion.id_promocion !== editId)}
                  onClick={() => toggleProduct(product.id)}>
                  <span className="promotion-product-thumb">{product.urlImagen ? <img src={product.urlImagen} alt=""/> : <span>{product.nombre.charAt(0)}</span>}</span>
                  <span><strong>{product.nombre}</strong><small>{product.marca.nombre} · {product.categoria.nombreCategoria} · {money(product.precioVenta)}</small>
                    {productPromotions.some((promotion) => promotion.id_productos === product.id && promotion.id_promocion !== editId) ? <small>Ya tiene una promoción</small> : null}</span>
                  {selectedIds.includes(product.id) ? <Check aria-hidden="true"/> : null}
                </button>
              ))}
            </div>
            <footer><span>{selectedIds.length} {selectedIds.length === 1 ? "seleccionado" : "seleccionados"}</span><button type="button" onClick={() => setModalOpen(false)}>Listo</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default function CreatePromotionPage() {
  return <Suspense fallback={<section className="promotion-create-content"><p role="status">Cargando formulario...</p></section>}><CreatePromotionForm /></Suspense>;
}
