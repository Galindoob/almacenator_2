"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  marcaId: string;
  codigoBarra: string | null;
  categoriaId: string;
  unidadId: string;
  contenido: number | null;
  unidad_medida: string | null;
  stock: number;
  costo: number;
  precioVenta: number;
  fechaVencimiento: string | null;
  urlImagen: string | null;
  unidad: {
    unidad: string;
  };
  categoria: {
    nombreCategoria: string;
  };
  unidad_medida_productos_unidad_medidaTounidad_medida: {
    nombre: string;
  } | null;
};

type Option = {
  id: string;
  nombre?: string;
  nombreCategoria?: string;
  unidad?: string;
};

type ProductOptions = {
  marcas: Option[];
  categorias: Option[];
  unidades: Option[];
  unidadesMedida: Option[];
};

type CreateProductForm = {
  nombre: string;
  descripcion: string;
  marcaId: string;
  marcaNombre: string;
  codigoBarra: string;
  categoriaId: string;
  unidadId: string;
  contenido: string;
  unidadMedidaId: string;
  precioVenta: string;
  costo: string;
};

type PriceState = {
  costoSinIva: number;
  costoConIva: number;
  precioSinIva: number;
  precioConIva: number;
};

type StockModal = "add" | "waste" | "movements" | null;

type StockMovement = {
  id: string;
  fecha: string;
  costo_sin_iva: number;
  costo_con_iva: number;
  cantidad: number;
  stock_restante: number;
  comentario: string | null;
  tipo: number;
  users: {
    nombre: string;
    apellido: string;
  };
};

function roundCurrency(value: number) {
  return Math.round(value);
}

function getCurrencyInputValue(value: number) {
  return value === 0 ? "" : String(value);
}

function isPositiveIntegerText(value: string) {
  return /^[1-9]\d*$/.test(value);
}

function isUnsignedIntegerText(value: string) {
  return /^\d*$/.test(value);
}

const initialCreateForm: CreateProductForm = {
  nombre: "",
  descripcion: "",
  marcaId: "",
  marcaNombre: "",
  codigoBarra: "",
  categoriaId: "",
  unidadId: "",
  contenido: "",
  unidadMedidaId: "",
  precioVenta: "",
  costo: "",
};

function buildInitialPriceState(producto: Producto): PriceState {
  return {
    costoSinIva: producto.costo,
    costoConIva: roundCurrency(producto.costo * 1.19),
    precioSinIva: roundCurrency(producto.precioVenta / 1.19),
    precioConIva: producto.precioVenta,
  };
}

export default function ProductoPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [options, setOptions] = useState<ProductOptions>({
    marcas: [],
    categorias: [],
    unidades: [],
    unidadesMedida: [],
  });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<"precio" | "inventario" | null>(
    "precio",
  );
  const [priceState, setPriceState] = useState<PriceState | null>(null);
  const [hasPriceChanges, setHasPriceChanges] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [stockModal, setStockModal] = useState<StockModal>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [wasteComment, setWasteComment] = useState("");
  const [stockActionMessage, setStockActionMessage] = useState("");
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"empty" | "detail" | "create">("empty");
  const [createForm, setCreateForm] =
    useState<CreateProductForm>(initialCreateForm);
  const [createMessage, setCreateMessage] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

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
          opciones?: ProductOptions;
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
        if (data.opciones) {
          setOptions(data.opciones);
        }
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
    setPanelMode("detail");
    setPriceState(buildInitialPriceState(producto));
    setOpenAccordion(null);
    setHasPriceChanges(false);
    setSaveMessage("");
    closeStockModal();
  }

  function openCreateProductPanel() {
    setSelectedProductId(null);
    setPanelMode("create");
    setOpenAccordion(null);
    setCreateForm(initialCreateForm);
    setCreateMessage("");
    closeStockModal();
  }

  function updateCreateForm(field: keyof CreateProductForm, value: string) {
    if (
      ["contenido", "precioVenta", "costo"].includes(field) &&
      !isUnsignedIntegerText(value)
    ) {
      return;
    }

    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateMessage("");
  }

  function closeStockModal() {
    setStockModal(null);
    setStockQuantity("");
    setWasteComment("");
    setStockActionMessage("");
    setSelectedComment(null);
  }

  function openStockModal(type: StockModal) {
    setStockModal(type);
    setStockQuantity("");
    setWasteComment("");
    setStockActionMessage("");
    setSelectedComment(null);

    if (type === "movements" && selectedProduct) {
      loadMovements(selectedProduct.id);
    }
  }

  function updateStockQuantity(value: string) {
    if (value === "" || /^[1-9]\d*$/.test(value)) {
      setStockQuantity(value);
      setStockActionMessage("");
    }
  }

  function updatePriceState(field: keyof PriceState, value: number) {
    setPriceState((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current, [field]: value };

      if (field === "costoSinIva") {
        next.costoConIva = roundCurrency(value * 1.19);
      }

      if (field === "costoConIva") {
        next.costoSinIva = roundCurrency(value / 1.19);
      }

      if (field === "precioSinIva") {
        next.precioConIva = roundCurrency(value * 1.19);
      }

      if (field === "precioConIva") {
        next.precioSinIva = roundCurrency(value / 1.19);
      }

      return next;
    });
    setHasPriceChanges(true);
    setSaveMessage("");
  }

  async function saveProductPrices() {
    if (!selectedProduct || !priceState) {
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSavingProduct(true);
    setSaveMessage("");

    try {
      const response = await fetch("/api/producto", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...selectedProduct,
          costo: roundCurrency(priceState.costoSinIva),
          precioVenta: roundCurrency(priceState.precioConIva),
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        producto?: Producto;
      };

      if (!response.ok || data.status !== "ok" || !data.producto) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setSaveMessage(data.message ?? "No se pudo guardar el producto.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id ? data.producto : producto,
        ),
      );
      setPriceState(buildInitialPriceState(data.producto));
      setHasPriceChanges(false);
      setSaveMessage("Producto actualizado correctamente.");
    } catch {
      setSaveMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function createProduct() {
    const selectedUnit = options.unidades.find(
      (unit) => unit.id === createForm.unidadId,
    );
    const needsMeasure = selectedUnit?.unidad?.toLowerCase() === "por unidad";
    const usesNewBrand = createForm.marcaId === "new";

    if (
      !createForm.nombre.trim() ||
      (!createForm.marcaId || (usesNewBrand && !createForm.marcaNombre.trim())) ||
      !createForm.categoriaId ||
      !createForm.unidadId ||
      !isPositiveIntegerText(createForm.precioVenta) ||
      !isPositiveIntegerText(createForm.costo) ||
      (needsMeasure &&
        (!isPositiveIntegerText(createForm.contenido) ||
          !createForm.unidadMedidaId))
    ) {
      setCreateMessage("Completa los datos obligatorios antes de guardar.");
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsCreatingProduct(true);
    setCreateMessage("");

    try {
      const response = await fetch("/api/producto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: createForm.nombre.trim(),
          descripcion: createForm.descripcion.trim() || null,
          marcaId: usesNewBrand ? undefined : createForm.marcaId,
          marcaNombre: usesNewBrand ? createForm.marcaNombre.trim() : undefined,
          codigoBarra: createForm.codigoBarra.trim() || null,
          categoriaId: createForm.categoriaId,
          unidadId: createForm.unidadId,
          contenido: needsMeasure ? Number(createForm.contenido) : null,
          unidad_medida: needsMeasure ? createForm.unidadMedidaId : null,
          precioVenta: Number(createForm.precioVenta),
          costo: Number(createForm.costo),
          stock: 0,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        producto?: Producto;
      };

      if (!response.ok || data.status !== "ok" || !data.producto) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setCreateMessage(data.message ?? "No se pudo crear el producto.");
        return;
      }

      setProductos((current) =>
        [...current, data.producto as Producto].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      );
      setCreateForm(initialCreateForm);
      setCreateMessage("Producto creado correctamente.");
    } catch {
      setCreateMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function saveAddedStock() {
    if (!selectedProduct || !isPositiveIntegerText(stockQuantity)) {
      return;
    }

    const token = localStorage.getItem("jwt");
    const quantity = Number(stockQuantity);
    const nextStock = selectedProduct.stock + quantity;

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSavingStock(true);
    setStockActionMessage("");

    try {
      const response = await fetch("/api/producto", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...selectedProduct,
          stock: nextStock,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        producto?: Producto;
      };

      if (!response.ok || data.status !== "ok" || !data.producto) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setStockActionMessage(data.message ?? "No se pudo actualizar el stock.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id ? data.producto : producto,
        ),
      );
      closeStockModal();
    } catch {
      setStockActionMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingStock(false);
    }
  }

  async function saveWasteStock() {
    if (!selectedProduct || !isPositiveIntegerText(stockQuantity)) {
      return;
    }

    const token = localStorage.getItem("jwt");
    const quantity = Number(stockQuantity);
    const nextStock = selectedProduct.stock - quantity;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (nextStock < 0) {
      return;
    }

    setIsSavingStock(true);
    setStockActionMessage("");

    try {
      const response = await fetch("/api/movimiento-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          producto: selectedProduct.id,
          costo_sin_iva: selectedProduct.costo,
          costo_con_iva: roundCurrency(selectedProduct.costo * 1.19),
          cantidad: quantity,
          stock_restante: nextStock,
          comentario: wasteComment,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        producto?: { id: string; stock: number };
      };

      if (!response.ok || data.status !== "ok" || !data.producto) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setStockActionMessage(data.message ?? "No se pudo registrar la merma.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id
            ? { ...producto, stock: data.producto.stock }
            : producto,
        ),
      );
      closeStockModal();
    } catch {
      setStockActionMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingStock(false);
    }
  }

  async function loadMovements(productId: string) {
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsLoadingMovements(true);
    setStockActionMessage("");

    try {
      const response = await fetch(`/api/movimiento-stock?producto=${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        movimientos?: StockMovement[];
      };

      if (!response.ok || data.status !== "ok") {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setStockActionMessage(data.message ?? "No se pudieron cargar los movimientos.");
        return;
      }

      setMovements(data.movimientos ?? []);
    } catch {
      setStockActionMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsLoadingMovements(false);
    }
  }

  function calculateMargins(values: PriceState) {
    const margenSinIva = values.precioSinIva - values.costoSinIva;
    const margenConIva = values.precioConIva - values.costoConIva;
    const margenSobreCosto =
      values.costoSinIva > 0 ? (margenSinIva / values.costoSinIva) * 100 : 0;
    const margenSobreVenta =
      values.precioConIva > 0 ? (margenConIva / values.precioConIva) * 100 : 0;

    return {
      ...values,
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

        {selectedProduct && priceState ? (
          <ProductDetail
            product={selectedProduct}
            priceState={priceState}
            openAccordion={openAccordion}
            onAccordionChange={setOpenAccordion}
            onPriceChange={updatePriceState}
            margins={calculateMargins(priceState)}
            hasPriceChanges={hasPriceChanges}
            isSavingProduct={isSavingProduct}
            saveMessage={saveMessage}
            onSave={saveProductPrices}
            onOpenStockModal={openStockModal}
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

      {selectedProduct ? (
        <StockModalView
          product={selectedProduct}
          modal={stockModal}
          quantity={stockQuantity}
          comment={wasteComment}
          message={stockActionMessage}
          isSaving={isSavingStock}
          movements={movements}
          isLoadingMovements={isLoadingMovements}
          selectedComment={selectedComment}
          onQuantityChange={updateStockQuantity}
          onCommentChange={setWasteComment}
          onClose={closeStockModal}
          onConfirmAdd={saveAddedStock}
          onConfirmWaste={saveWasteStock}
          onShowComment={setSelectedComment}
        />
      ) : null}
    </main>
  );
}

type ProductDetailProps = {
  product: Producto;
  priceState: PriceState;
  openAccordion: "precio" | "inventario" | null;
  margins: {
    costoSinIva: number;
    precioSinIva: number;
    costoConIva: number;
    precioConIva: number;
    margenSinIva: number;
    margenConIva: number;
    margenSobreCosto: number;
    margenSobreVenta: number;
  };
  onAccordionChange: (value: "precio" | "inventario" | null) => void;
  onPriceChange: (field: keyof PriceState, value: number) => void;
  hasPriceChanges: boolean;
  isSavingProduct: boolean;
  saveMessage: string;
  onSave: () => void;
  onOpenStockModal: (type: StockModal) => void;
};

function ProductDetail({
  product,
  priceState,
  openAccordion,
  margins,
  onAccordionChange,
  onPriceChange,
  hasPriceChanges,
  isSavingProduct,
  saveMessage,
  onSave,
  onOpenStockModal,
}: ProductDetailProps) {
  const imageUrl = product.urlImagen || "/generic-product.svg";
  const minPrice = Math.max(priceState.costoSinIva, 0);
  const maxPrice = Math.max(priceState.precioConIva * 3, minPrice + 1);
  const rangePrice = Math.min(
    Math.max(priceState.precioConIva, minPrice),
    maxPrice,
  );
  const marginClass = (value: number) =>
    value < 0 ? "is-negative" : "is-positive";
  const handleNumericInput = (field: keyof PriceState, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    onPriceChange(field, value === "" ? 0 : Number(value));
  };

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
              <label className="price-main-input">
                Precio
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={getCurrencyInputValue(priceState.precioConIva)}
                  onChange={(event) =>
                    handleNumericInput("precioConIva", event.target.value)
                  }
                />
              </label>
              <span>{product.unidad.unidad}</span>
            </div>

            <label className="price-timeline">
              Ajuste de precio
              <input
                type="range"
                min={minPrice}
                max={maxPrice}
                step="1"
                value={rangePrice}
                onChange={(event) =>
                  onPriceChange("precioConIva", Number(event.target.value))
                }
              />
              <div>
                <span>${minPrice.toLocaleString("es-CL")}</span>
                <span>${maxPrice.toLocaleString("es-CL")}</span>
              </div>
            </label>

            <div className="margin-cards">
              <div>
                <span>Margen sobre costo</span>
                <strong className={marginClass(margins.margenSobreCosto)}>
                  {margins.margenSobreCosto.toFixed(1)}%
                </strong>
              </div>
              <div>
                <span>Margen sobre venta</span>
                <strong className={marginClass(margins.margenSobreVenta)}>
                  {margins.margenSobreVenta.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="tax-columns">
              <div>
                <h3>Sin IVA</h3>
                <label>
                  Precio venta
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getCurrencyInputValue(priceState.precioSinIva)}
                    onChange={(event) =>
                      handleNumericInput("precioSinIva", event.target.value)
                    }
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getCurrencyInputValue(priceState.costoSinIva)}
                    onChange={(event) =>
                      handleNumericInput("costoSinIva", event.target.value)
                    }
                  />
                </label>
                <p className={marginClass(margins.margenSinIva)}>
                  Margen: ${margins.margenSinIva.toLocaleString("es-CL")}
                </p>
              </div>
              <div>
                <h3>Con IVA</h3>
                <label>
                  Precio venta
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getCurrencyInputValue(priceState.precioConIva)}
                    onChange={(event) =>
                      handleNumericInput("precioConIva", event.target.value)
                    }
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getCurrencyInputValue(priceState.costoConIva)}
                    onChange={(event) =>
                      handleNumericInput("costoConIva", event.target.value)
                    }
                  />
                </label>
                <p className={marginClass(margins.margenConIva)}>
                  Margen: $
                  {margins.margenConIva.toLocaleString("es-CL")}
                </p>
              </div>
            </div>

            {hasPriceChanges ? (
              <button
                className="product-save-button"
                type="button"
                disabled={isSavingProduct}
                onClick={onSave}
              >
                {isSavingProduct ? "Guardando..." : "Guardar"}
              </button>
            ) : null}

            {saveMessage ? <p className="product-save-message">{saveMessage}</p> : null}
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
            <div className="inventory-status">
              <span>Disponible</span>
              <strong>{product.stock}</strong>
            </div>
            <div className="inventory-actions">
              <button type="button" onClick={() => onOpenStockModal("add")}>
                Añadir stock
              </button>
              <button type="button" onClick={() => onOpenStockModal("waste")}>
                Ingresar merma
              </button>
              <button type="button" onClick={() => onOpenStockModal("movements")}>
                Movimiento de stock
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

type StockModalViewProps = {
  product: Producto;
  modal: StockModal;
  quantity: string;
  comment: string;
  message: string;
  isSaving: boolean;
  movements: StockMovement[];
  isLoadingMovements: boolean;
  selectedComment: string | null;
  onQuantityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirmAdd: () => void;
  onConfirmWaste: () => void;
  onShowComment: (value: string | null) => void;
};

function StockModalView({
  product,
  modal,
  quantity,
  comment,
  message,
  isSaving,
  movements,
  isLoadingMovements,
  selectedComment,
  onQuantityChange,
  onCommentChange,
  onClose,
  onConfirmAdd,
  onConfirmWaste,
  onShowComment,
}: StockModalViewProps) {
  if (!modal) {
    return null;
  }

  const parsedQuantity = isPositiveIntegerText(quantity) ? Number(quantity) : 0;
  const addedStock = product.stock + parsedQuantity;
  const remainingStock = product.stock - parsedQuantity;
  const canConfirmAdd = parsedQuantity > 0 && !isSaving;
  const canConfirmWaste = parsedQuantity > 0 && remainingStock >= 0 && !isSaving;

  return (
    <div className="stock-modal-layer" role="presentation">
      <button
        className="stock-modal-backdrop"
        type="button"
        aria-label="Cerrar modal"
        onClick={onClose}
      />
      <section
        className={modal === "movements" ? "stock-modal is-wide" : "stock-modal"}
        role="dialog"
        aria-modal="true"
      >
        {modal === "add" ? (
          <>
            <h2>Agregar stock de {product.nombre}</h2>
            <label>
              Cantidad
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
              />
            </label>
            <p>Tu nuevo stock será: {addedStock}</p>
            {message ? <p className="stock-modal-message">{message}</p> : null}
            <div className="stock-modal-actions">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirmAdd}
                onClick={onConfirmAdd}
              >
                {isSaving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </>
        ) : null}

        {modal === "waste" ? (
          <>
            <h2>Ingresando merma de {product.nombre}</h2>
            <label>
              Cantidad
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
              />
            </label>
            <label>
              Comentario
              <textarea
                className="stock-comment-input"
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
              />
            </label>
            <p className={remainingStock < 0 ? "is-negative" : ""}>
              Tu nuevo stock será: {remainingStock}
            </p>
            {message ? <p className="stock-modal-message">{message}</p> : null}
            <div className="stock-modal-actions">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirmWaste}
                onClick={onConfirmWaste}
              >
                {isSaving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </>
        ) : null}

        {modal === "movements" ? (
          <>
            <h2>Movimiento de stock de {product.nombre}</h2>
            {isLoadingMovements ? <p>Cargando movimientos...</p> : null}
            {message ? <p className="stock-modal-message">{message}</p> : null}
            {!isLoadingMovements ? (
              <div className="stock-movements-wrap">
                <table className="stock-movements-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Costo sin IVA</th>
                      <th>Costo con IVA</th>
                      <th>Cantidad</th>
                      <th>Stock restante</th>
                      <th>Comentario</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id}>
                        <td>{new Date(movement.fecha).toLocaleDateString("es-CL")}</td>
                        <td>${movement.costo_sin_iva.toLocaleString("es-CL")}</td>
                        <td>${movement.costo_con_iva.toLocaleString("es-CL")}</td>
                        <td>{movement.cantidad}</td>
                        <td>{movement.stock_restante}</td>
                        <td>
                          <button
                            type="button"
                            disabled={!movement.comentario}
                            onClick={() => onShowComment(movement.comentario)}
                          >
                            Ver
                          </button>
                        </td>
                        <td>
                          {movement.users.nombre} {movement.users.apellido}
                        </td>
                      </tr>
                    ))}
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7}>Sin movimientos registrados.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="stock-modal-actions">
              <button type="button" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : null}

        {selectedComment ? (
          <div className="comment-modal-layer" role="presentation">
            <button
              className="stock-modal-backdrop"
              type="button"
              aria-label="Cerrar comentario"
              onClick={() => onShowComment(null)}
            />
            <section className="comment-modal" role="dialog" aria-modal="true">
              <h3>Comentario</h3>
              <p>{selectedComment}</p>
              <button type="button" onClick={() => onShowComment(null)}>
                Cerrar
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
