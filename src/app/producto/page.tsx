"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  stock: number;
  costo: number;
  precioVenta: number;
  urlImagen: string | null;
  unidad: {
    unidad: string;
  };
  categoria: {
    nombreCategoria: string;
  };
};

export default function ProductoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<"precio" | "inventario" | null>(
    "precio",
  );
  const [adjustedPrice, setAdjustedPrice] = useState(0);

  useEffect(() => {
    async function loadProductos() {
      const token = localStorage.getItem("jwt");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch("/api/producto", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json()) as {
          status?: "ok" | "error";
          message?: string;
          productos?: Producto[];
        };

        if (!response.ok || data.status !== "ok") {
          if (response.status === 401) {
            localStorage.removeItem("jwt");
            router.replace("/login");
            return;
          }

          setError(data.message ?? "No se pudieron cargar los productos.");
          setIsLoading(false);
          return;
        }

        setProductos(data.productos ?? []);
        setIsLoading(false);
      } catch {
        setError("No se pudo conectar con el servidor.");
        setIsLoading(false);
      }
    }

    loadProductos();
  }, [router]);

  function handleLogout() {
    localStorage.clear();
    router.replace("/login");
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return productos;
    }

    return productos.filter((producto) =>
      producto.nombre.toLowerCase().includes(query),
    );
  }, [productos, search]);

  const selectedProduct = useMemo(
    () => productos.find((producto) => producto.id === selectedProductId) ?? null,
    [productos, selectedProductId],
  );

  function selectProduct(producto: Producto) {
    setSelectedProductId(producto.id);
    setAdjustedPrice(producto.precioVenta);
  }

  function calculateMargins(producto: Producto, price: number) {
    const costoSinIva = producto.costo;
    const precioSinIva = Math.round(price / 1.19);
    const costoConIva = Math.round(producto.costo * 1.19);
    const precioConIva = price;
    const margenSinIva = precioSinIva - costoSinIva;
    const margenConIva = precioConIva - costoConIva;
    const margenSobreCosto =
      costoSinIva > 0 ? (margenSinIva / costoSinIva) * 100 : 0;
    const margenSobreVenta =
      precioConIva > 0 ? (margenConIva / precioConIva) * 100 : 0;

    return {
      costoSinIva,
      precioSinIva,
      costoConIva,
      precioConIva,
      margenSinIva,
      margenConIva,
      margenSobreCosto,
      margenSobreVenta,
    };
  }

  return (
    <main className="product-view-shell">
      <Navbar
        onLogout={handleLogout}
        showProductTabs
        activeProductTab="productos"
        showLogout={false}
      />

      <section className="product-view-layout">
        <div className="product-list-panel">
          <input
            className="product-search"
            type="search"
            placeholder="Buscar producto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {isLoading ? <p className="product-empty">Cargando productos...</p> : null}
          {error ? <p className="product-error">{error}</p> : null}

          {!isLoading && !error ? (
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Stock</th>
                    <th>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((producto) => {
                    const imageUrl = producto.urlImagen || "/generic-product.svg";

                    return (
                    <tr
                      key={producto.id}
                      className={selectedProductId === producto.id ? "is-selected" : ""}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectProduct(producto)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectProduct(producto);
                        }
                      }}
                    >
                      <td>
                        <div className="product-name-cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageUrl} alt={producto.nombre} />
                          <div>
                            <strong>{producto.nombre}</strong>
                            <span>{producto.descripcion || "Sin descripcion"}</span>
                            <span>Tipo de venta: {producto.unidad.unidad}</span>
                            <span>Categoria: {producto.categoria.nombreCategoria}</span>
                          </div>
                        </div>
                      </td>
                      <td>{producto.stock}</td>
                      <td>${producto.precioVenta.toLocaleString("es-CL")}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            adjustedPrice={adjustedPrice || selectedProduct.precioVenta}
            openAccordion={openAccordion}
            onAccordionChange={setOpenAccordion}
            onPriceChange={setAdjustedPrice}
            margins={calculateMargins(
              selectedProduct,
              adjustedPrice || selectedProduct.precioVenta,
            )}
          />
        ) : (
          <aside className="product-detail-empty">
            <svg
              aria-hidden="true"
              width="72"
              height="72"
              viewBox="0 0 72 72"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="14" y="18" width="44" height="38" rx="6" stroke="currentColor" strokeWidth="4" />
              <path d="M24 30H48" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M24 40H40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <circle cx="53" cy="53" r="9" fill="currentColor" opacity="0.22" />
            </svg>
            <p>Haz click en un producto o promo para revisar detalles</p>
          </aside>
        )}
      </section>
    </main>
  );
}

type ProductDetailProps = {
  product: Producto;
  adjustedPrice: number;
  openAccordion: "precio" | "inventario" | null;
  margins: {
    costoSinIva: number;
    precioSinIva: number;
    costoConIva: number;
    precioConIva: number;
    margenSinIva: number;
    margenSobreCosto: number;
    margenSobreVenta: number;
  };
  onAccordionChange: (value: "precio" | "inventario" | null) => void;
  onPriceChange: (value: number) => void;
};

function ProductDetail({
  product,
  adjustedPrice,
  openAccordion,
  margins,
  onAccordionChange,
  onPriceChange,
}: ProductDetailProps) {
  const imageUrl = product.urlImagen || "/generic-product.svg";
  const minPrice = Math.max(product.costo, 0);
  const maxPrice = Math.max(product.precioVenta * 3, minPrice + 1);

  return (
    <aside className="product-detail-panel">
      <div className="product-detail-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={product.nombre} />
        <div>
          <h2>{product.nombre}</h2>
          <p>{product.descripcion || "Sin descripcion"}</p>
          <span>Categoria: {product.categoria.nombreCategoria}</span>
          <span>Tipo de venta: {product.unidad.unidad}</span>
        </div>
      </div>

      <div className="detail-accordion">
        <button
          type="button"
          aria-expanded={openAccordion === "precio"}
          onClick={() =>
            onAccordionChange(openAccordion === "precio" ? null : "precio")
          }
        >
          Precio de venta
        </button>

        {openAccordion === "precio" ? (
          <section className="price-detail-section">
            <div className="price-summary">
              <strong>${adjustedPrice.toLocaleString("es-CL")}</strong>
              <span>{product.unidad.unidad}</span>
            </div>

            <label className="price-timeline">
              Ajuste de precio
              <input
                type="range"
                min={minPrice}
                max={maxPrice}
                step="1"
                value={adjustedPrice}
                onChange={(event) => onPriceChange(Number(event.target.value))}
              />
              <div>
                <span>${minPrice.toLocaleString("es-CL")}</span>
                <span>${maxPrice.toLocaleString("es-CL")}</span>
              </div>
            </label>

            <div className="margin-cards">
              <div>
                <span>Margen sobre costo</span>
                <strong>{margins.margenSobreCosto.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Margen sobre venta</span>
                <strong>{margins.margenSobreVenta.toFixed(1)}%</strong>
              </div>
            </div>

            <div className="tax-columns">
              <div>
                <h3>Sin IVA</h3>
                <label>
                  Precio venta
                  <input readOnly value={margins.precioSinIva.toLocaleString("es-CL")} />
                </label>
                <label>
                  Costo
                  <input readOnly value={margins.costoSinIva.toLocaleString("es-CL")} />
                </label>
                <p>Margen: ${margins.margenSinIva.toLocaleString("es-CL")}</p>
              </div>
              <div>
                <h3>Con IVA</h3>
                <label>
                  Precio venta
                  <input readOnly value={margins.precioConIva.toLocaleString("es-CL")} />
                </label>
                <label>
                  Costo
                  <input readOnly value={margins.costoConIva.toLocaleString("es-CL")} />
                </label>
                <p>
                  Margen: $
                  {(margins.precioConIva - margins.costoConIva).toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="detail-accordion">
        <button
          type="button"
          aria-expanded={openAccordion === "inventario"}
          onClick={() =>
            onAccordionChange(openAccordion === "inventario" ? null : "inventario")
          }
        >
          Inventario
        </button>

        {openAccordion === "inventario" ? (
          <section className="inventory-detail-section">
            <div>
              <span>Stock actual</span>
              <strong>{product.stock}</strong>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
