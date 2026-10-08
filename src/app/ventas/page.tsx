"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../components/Navbar";
import { isSafeAppInput } from "@/lib/input-validation";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  contenido: number | null;
  stock: number;
  precioVenta: number;
  urlImagen: string | null;
  unidad: {
    unidad: string;
  };
  marca: {
    nombre: string;
  };
  categoria: {
    nombreCategoria: string;
  };
  empaque_productos_empaqueToempaque: {
    nombre_empaque: string;
  } | null;
  proveedores: {
    nombre: string;
  } | null;
  unidad_medida_productos_unidad_medidaTounidad_medida: {
    nombre: string;
  } | null;
};

type UnitCartItem = {
  kind: "unit";
  product: Producto;
  quantity: number;
};

type WeightCartItem = {
  kind: "weight";
  product: Producto;
  priceText: string;
  quantityText: string;
};

type CartItem = UnitCartItem | WeightCartItem;

const VARIABLE_WEIGHT_LABEL = "por peso variable";
const FALLBACK_IMAGE = "/generic-product.svg";
const QUANTITY_PATTERN = /^\d*([.,]\d*)?$/;
const PRICE_PATTERN = /^\d*$/;

function formatPrice(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

function isVariableWeight(product: Producto) {
  return product.unidad.unidad.trim().toLowerCase() === VARIABLE_WEIGHT_LABEL;
}

function getMeasureName(product: Producto) {
  return product.unidad_medida_productos_unidad_medidaTounidad_medida?.nombre ?? "";
}

function getContentLabel(product: Producto) {
  const measure = getMeasureName(product);

  if (product.contenido && measure) {
    return `${product.contenido.toLocaleString("es-CL")} ${measure}`;
  }

  return null;
}

function getPriceLabel(product: Producto) {
  const measure = getMeasureName(product);

  if (isVariableWeight(product) && measure) {
    return `${formatPrice(product.precioVenta)} / ${measure}`;
  }

  return formatPrice(product.precioVenta);
}

// Parses user input that may use comma or dot as decimal separator.
// Empty or invalid text is treated as 0.
function parseDecimal(text: string) {
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// Formats a weight quantity with up to 3 decimals, using comma as decimal separator
// and no thousands grouping so the value stays editable.
function formatQuantity(value: number) {
  return value.toLocaleString("es-CL", {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

function getLineTotal(item: CartItem) {
  if (item.kind === "unit") {
    return item.product.precioVenta * item.quantity;
  }

  return Math.round(parseDecimal(item.priceText));
}

function createCartItem(product: Producto): CartItem {
  if (isVariableWeight(product)) {
    return { kind: "weight", product, priceText: "0", quantityText: "0" };
  }

  return { kind: "unit", product, quantity: 1 };
}

function ProductDetails({ product }: { product: Producto }) {
  const contentLabel = isVariableWeight(product) ? null : getContentLabel(product);

  return (
    <dl className="sales-view-details">
      <div>
        <dt>Marca</dt>
        <dd>{product.marca.nombre}</dd>
      </div>
      <div>
        <dt>Venta</dt>
        <dd>{product.unidad.unidad}</dd>
      </div>
      {contentLabel ? (
        <div>
          <dt>Contenido</dt>
          <dd>{contentLabel}</dd>
        </div>
      ) : null}
      <div>
        <dt>Categoria</dt>
        <dd>{product.categoria.nombreCategoria}</dd>
      </div>
    </dl>
  );
}

export default function SalesPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const weightInputs = useRef(new Map<string, HTMLInputElement>());

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
          return;
        }

        setProductos(data.productos ?? []);
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProductos();
  }, [router]);

  const availableProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return productos.filter(
      (product) =>
        product.stock >= 1 &&
        (!normalizedSearch ||
          product.nombre.toLowerCase().includes(normalizedSearch) ||
          product.marca.nombre.toLowerCase().includes(normalizedSearch)),
    );
  }, [productos, search]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + getLineTotal(item), 0),
    [cart],
  );

  function handleLogout() {
    localStorage.clear();
    router.replace("/login");
  }

  function focusWeightInput(productId: string) {
    const input = weightInputs.current.get(productId);

    if (input) {
      input.scrollIntoView({ block: "nearest", behavior: "smooth" });
      input.focus();
      input.select();
    }
  }

  function addToCart(product: Producto) {
    const existing = cart.find((item) => item.product.id === product.id);

    if (!existing) {
      setCart((items) => [...items, createCartItem(product)]);
      if (isVariableWeight(product)) {
        // Focus once the new row has been rendered.
        requestAnimationFrame(() => focusWeightInput(product.id));
      }
      return;
    }

    if (existing.kind === "weight") {
      focusWeightInput(product.id);
      return;
    }

    updateUnitQuantity(product.id, 1);
  }

  function updateUnitQuantity(productId: string, delta: number) {
    setCart((items) =>
      items.flatMap((item) => {
        if (item.product.id !== productId || item.kind !== "unit") {
          return [item];
        }

        const quantity = Math.min(item.quantity + delta, item.product.stock);
        return quantity <= 0 ? [] : [{ ...item, quantity }];
      }),
    );
  }

  function removeFromCart(productId: string) {
    weightInputs.current.delete(productId);
    setCart((items) => items.filter((item) => item.product.id !== productId));
  }

  // Price field edited: keep the raw text and recompute the quantity.
  function updateWeightPrice(productId: string, text: string) {
    if (!isSafeAppInput(text) || !PRICE_PATTERN.test(text)) {
      return;
    }

    setCart((items) =>
      items.map((item) => {
        if (item.product.id !== productId || item.kind !== "weight") {
          return item;
        }

        const unitPrice = item.product.precioVenta;
        const quantity = unitPrice > 0 ? parseDecimal(text) / unitPrice : 0;
        return { ...item, priceText: text, quantityText: formatQuantity(quantity) };
      }),
    );
  }

  // Quantity field edited: keep the raw text and recompute the price.
  function updateWeightQuantity(productId: string, text: string) {
    if (!isSafeAppInput(text) || !QUANTITY_PATTERN.test(text)) {
      return;
    }

    setCart((items) =>
      items.map((item) => {
        if (item.product.id !== productId || item.kind !== "weight") {
          return item;
        }

        const price = Math.round(item.product.precioVenta * parseDecimal(text));
        return { ...item, quantityText: text, priceText: String(price) };
      }),
    );
  }

  function getCartQuantity(productId: string) {
    const item = cart.find((cartItem) => cartItem.product.id === productId);

    if (!item) {
      return null;
    }

    return item.kind === "unit" ? item.quantity : 0;
  }

  return (
    <main className="sales-view-shell">
      <Navbar onLogout={handleLogout} />

      <section className="sales-view-layout">
        <section className="sales-view-cart" aria-label="Carrito de venta">
          <div className="sales-view-heading">
            <div>
              <span>Nueva venta</span>
              <h1>Carrito</h1>
            </div>
            <strong>{cart.length}</strong>
          </div>

          <div className="sales-view-cart-scroll">
            {cart.length === 0 ? (
              <p className="sales-view-empty">
                El carrito esta vacio. Selecciona productos del catalogo para agregarlos.
              </p>
            ) : (
              <table className="sales-view-cart-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <CartRow
                      key={item.product.id}
                      item={item}
                      onIncrement={() => updateUnitQuantity(item.product.id, 1)}
                      onDecrement={() => updateUnitQuantity(item.product.id, -1)}
                      onRemove={() => removeFromCart(item.product.id)}
                      onPriceChange={(text) => updateWeightPrice(item.product.id, text)}
                      onQuantityChange={(text) => updateWeightQuantity(item.product.id, text)}
                      quantityInputRef={(input) => {
                        if (input) {
                          weightInputs.current.set(item.product.id, input);
                        }
                      }}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="sales-view-total" aria-live="polite">
            <span>Total</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </div>
        </section>

        <section className="sales-view-catalog" aria-label="Catalogo de productos">
          <div className="sales-view-heading">
            <div>
              <span>Catalogo</span>
              <h2>Productos disponibles</h2>
            </div>
            <strong>{availableProducts.length}</strong>
          </div>

          <input
            className="sales-view-search"
            type="search"
            placeholder="Buscar por nombre o marca"
            value={search}
            onChange={(event) => {
              if (isSafeAppInput(event.target.value)) {
                setSearch(event.target.value);
              }
            }}
            aria-label="Buscar producto"
          />

          <div className="sales-view-catalog-scroll">
            {isLoading ? (
              <p className="sales-view-status">Cargando productos...</p>
            ) : error ? (
              <p className="sales-view-status is-error">{error}</p>
            ) : availableProducts.length === 0 ? (
              <p className="sales-view-status">No hay productos con stock disponible.</p>
            ) : (
              <div className="sales-view-grid">
                {availableProducts.map((product) => {
                  const cartQuantity = getCartQuantity(product.id);
                  const isMaxed =
                    !isVariableWeight(product) &&
                    cartQuantity !== null &&
                    cartQuantity >= product.stock;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`sales-view-card${cartQuantity !== null ? " is-in-cart" : ""}`}
                      onClick={() => addToCart(product)}
                      disabled={isMaxed}
                      title={isMaxed ? "Stock maximo agregado al carrito" : "Agregar al carrito"}
                    >
                      <span className="sales-view-card-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.urlImagen || FALLBACK_IMAGE} alt={product.nombre} />
                        {cartQuantity !== null ? (
                          <span className="sales-view-card-badge">
                            {cartQuantity > 0 ? `x${cartQuantity}` : "En carrito"}
                          </span>
                        ) : null}
                      </span>
                      <span className="sales-view-card-body">
                        <strong className="sales-view-card-name">{product.nombre}</strong>
                        <ProductDetails product={product} />
                        <span className="sales-view-card-footer">
                          <span className="sales-view-price">{getPriceLabel(product)}</span>
                          <span className="sales-view-stock">Stock: {product.stock}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

type CartRowProps = {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onPriceChange: (text: string) => void;
  onQuantityChange: (text: string) => void;
  quantityInputRef: (input: HTMLInputElement | null) => void;
};

function CartRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onPriceChange,
  onQuantityChange,
  quantityInputRef,
}: CartRowProps) {
  const { product } = item;
  const measure = getMeasureName(product) || "unidad";

  return (
    <tr>
      <td>
        <div className="sales-view-cart-product">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.urlImagen || FALLBACK_IMAGE} alt={product.nombre} />
          <div>
            <strong>{product.nombre}</strong>
            <ProductDetails product={product} />
            <span className="sales-view-price">{getPriceLabel(product)}</span>
          </div>
        </div>
      </td>

      <td>
        {item.kind === "unit" ? (
          <div className="sales-view-unit-controls">
            <div className="sales-view-stepper">
              <button
                type="button"
                onClick={onDecrement}
                aria-label={item.quantity === 1 ? "Quitar del carrito" : "Disminuir cantidad"}
                title={item.quantity === 1 ? "Quitar del carrito" : "Disminuir cantidad"}
                className={item.quantity === 1 ? "is-remove" : ""}
              >
                -
              </button>
              <span aria-label="Cantidad">{item.quantity}</span>
              <button
                type="button"
                onClick={onIncrement}
                disabled={item.quantity >= product.stock}
                aria-label="Aumentar cantidad"
                title={item.quantity >= product.stock ? "Stock maximo alcanzado" : "Aumentar cantidad"}
              >
                +
              </button>
            </div>
            <small>
              {formatPrice(product.precioVenta)} x {item.quantity} ={" "}
              {formatPrice(getLineTotal(item))}
            </small>
          </div>
        ) : (
          <div className="sales-view-weight-controls">
            <label>
              <span>Precio</span>
              <span className="sales-view-weight-field">
                <em>$</em>
                <input
                  inputMode="numeric"
                  value={item.priceText}
                  onChange={(event) => onPriceChange(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  aria-label={`Precio total de ${product.nombre}`}
                />
              </span>
            </label>
            <label>
              <span>Cantidad</span>
              <span className="sales-view-weight-field">
                <input
                  ref={quantityInputRef}
                  inputMode="decimal"
                  value={item.quantityText}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  aria-label={`Cantidad en ${measure} de ${product.nombre}`}
                />
                <em>{measure}</em>
              </span>
            </label>
            {parseDecimal(item.quantityText) > product.stock ? (
              <small className="is-warning">Supera el stock disponible ({product.stock})</small>
            ) : null}
          </div>
        )}
      </td>

      <td>
        <strong className="sales-view-line-total">{formatPrice(getLineTotal(item))}</strong>
      </td>

      <td>
        <button
          type="button"
          className="sales-view-remove"
          onClick={onRemove}
          aria-label={`Quitar ${product.nombre} del carrito`}
          title="Quitar del carrito"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
