"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { isSafeAppInput } from "@/lib/input-validation";

type PriceProduct = {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigoBarra: string | null;
  precioVenta: number;
  urlImagen: string | null;
  contenido: number | null;
  marca: { nombre: string };
  categoria: { nombreCategoria: string };
  empaque_productos_empaqueToempaque: { nombre_empaque: string } | null;
  unidad_medida_productos_unidad_medidaTounidad_medida: { nombre: string } | null;
};

function formatPrice(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

export default function ConsultarPrecioPage() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<PriceProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [error, setError] = useState("");

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
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const token = localStorage.getItem("jwt");

      if (!token) {
        router.replace("/login");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/consultar-precio?q=${encodeURIComponent(normalizedQuery)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as {
          status?: "ok" | "error";
          message?: string;
          productos?: PriceProduct[];
        };

        if (!response.ok || data.status !== "ok") {
          if (response.status === 401) {
            localStorage.removeItem("jwt");
            router.replace("/login");
            return;
          }
          setProducts([]);
          setError(data.message ?? "No se pudieron consultar los precios.");
          return;
        }

        const foundProducts = data.productos ?? [];
        setProducts(foundProducts);
        setSelectedProductId(foundProducts[0]?.id ?? null);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setProducts([]);
        setError("No se pudo conectar con el servidor.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, router]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0] ?? null;
  const productContent = selectedProduct?.contenido
    ? `${selectedProduct.contenido.toLocaleString("es-CL")} ${selectedProduct.unidad_medida_productos_unidad_medidaTounidad_medida?.nombre ?? ""}`.trim()
    : null;

  if (!isSessionVerified) {
    return (
      <main className="price-lookup-shell">
        <p className="price-lookup-feedback" role="status" aria-live="polite">
          Verificando sesión...
        </p>
      </main>
    );
  }

  return (
    <main className="price-lookup-shell">
      <Navbar onLogout={handleLogout} />
      <section className="price-lookup-content">
        <header className="price-lookup-topbar">
          <h1>Consultar precio</h1>
        </header>

        <form
          className="price-lookup-search-wrap"
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = searchText.trim();
            if (nextQuery !== query) {
              setProducts([]);
              setSelectedProductId(null);
              setError("");
              setIsLoading(Boolean(nextQuery));
              setQuery(nextQuery);
            }
          }}
        >
          <label className="price-lookup-search-icon" htmlFor="price-lookup-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 5 5" />
            </svg>
          </label>
          <input
            id="price-lookup-search"
            autoFocus
            type="search"
            value={searchText}
            onChange={(event) => {
              if (isSafeAppInput(event.target.value)) setSearchText(event.target.value);
            }}
            placeholder="Nombre o código de barras"
          />
          <button type="submit" aria-label="Buscar producto" title="Buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12h15" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </button>
        </form>

        {isLoading ? <p className="price-lookup-feedback">Buscando productos...</p> : null}
        {error ? <p className="price-lookup-error">{error}</p> : null}
        {!isLoading && !error && query && products.length === 0 ? (
          <p className="price-lookup-feedback">No se encontraron productos.</p>
        ) : null}

        {products.length > 1 ? (
          <div className="price-lookup-matches" aria-label="Coincidencias">
            {products.map((product) => (
              <button
                className={product.id === selectedProduct?.id ? "is-selected" : ""}
                key={product.id}
                type="button"
                onClick={() => setSelectedProductId(product.id)}
              >
                <span>{product.nombre}</span>
                <strong>{formatPrice(product.precioVenta)}</strong>
              </button>
            ))}
          </div>
        ) : null}

        {selectedProduct ? (
          <article className="price-lookup-product" aria-live="polite">
            <div className="price-lookup-image-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProduct.urlImagen || "/generic-product.svg"}
                alt={selectedProduct.nombre}
              />
            </div>
            <div className="price-lookup-product-info">
              <span className="price-lookup-category">
                {selectedProduct.categoria.nombreCategoria}
              </span>
              <h2>{selectedProduct.nombre}</h2>
              {selectedProduct.descripcion ? (
                <p className="price-lookup-description">{selectedProduct.descripcion}</p>
              ) : null}
              <p className="price-lookup-product-data">
                {[
                  selectedProduct.marca.nombre,
                  selectedProduct.empaque_productos_empaqueToempaque?.nombre_empaque,
                  productContent,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
              {selectedProduct.codigoBarra ? (
                <span className="price-lookup-barcode">
                  Código de barras: {selectedProduct.codigoBarra}
                </span>
              ) : null}
              <strong className="price-lookup-price">
                {formatPrice(selectedProduct.precioVenta)}
              </strong>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
