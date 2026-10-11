"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, Banknote, CreditCard, Wallet } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAppearance } from "../components/AppearanceProvider";
import { isSafeAppInput } from "@/lib/input-validation";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  contenido: number | null;
  stock: number;
  controlaStock: boolean;
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

type PaymentMethod = {
  id_medio: string;
  medio_de_pago: string;
};

const PAYMENT_METHOD_ORDER: Record<string, number> = {
  efectivo: 0,
  debito: 1,
  credito: 2,
  transferencia: 3,
  trasnferencia: 3,
  edenred: 4,
};

const FALLBACK_IMAGE = "/generic-product.svg";
const QUANTITY_PATTERN = /^\d*([.,]\d*)?$/;
const PRICE_PATTERN = /^\d*$/;

function formatPrice(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

function PaymentMethodIcon({ name }: { name: string }) {
  const normalized = name.trim().toLocaleLowerCase("es-CL");
  if (normalized === "efectivo") return <Banknote aria-hidden="true" />;
  if (normalized === "debito" || normalized === "débito" || normalized === "credito" || normalized === "crédito") {
    return <CreditCard aria-hidden="true" />;
  }
  if (normalized === "transferencia" || normalized === "trasnferencia") {
    return <ArrowLeftRight aria-hidden="true" />;
  }
  return <Wallet aria-hidden="true" />;
}

function formatPaymentMethodName(name: string) {
  const normalized = name.trim().toLocaleLowerCase("es-CL");
  if (normalized === "debito") return "Débito";
  if (normalized === "credito") return "Crédito";
  if (normalized === "trasnferencia") return "Transferencia";
  return name.charAt(0).toLocaleUpperCase("es-CL") + name.slice(1);
}

function paymentMethodRank(name: string) {
  const normalized = name.trim().toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return PAYMENT_METHOD_ORDER[normalized] ?? Number.MAX_SAFE_INTEGER;
}

function isVariableWeight(product: Producto) {
  return !product.controlaStock;
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
  const { storeName } = useAppearance();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rightPanel, setRightPanel] = useState<"catalog" | "payment">("catalog");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
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

  useEffect(() => {
    if (rightPanel !== "payment") return;

    const token = localStorage.getItem("jwt");
    if (!token) return;

    const controller = new AbortController();
    fetch("/api/medio-pago", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los métodos de pago.");
        return response.json() as Promise<{ paymentMethods: PaymentMethod[] }>;
      })
      .then((data) => {
        setPaymentMethods([...data.paymentMethods].sort((a, b) =>
          paymentMethodRank(a.medio_de_pago) - paymentMethodRank(b.medio_de_pago) ||
          a.medio_de_pago.localeCompare(b.medio_de_pago, "es-CL"),
        ));
        setPaymentMethodsError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPaymentMethodsError("No se pudieron cargar los métodos de pago.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false);
      });

    return () => controller.abort();
  }, [rightPanel]);

  const availableProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return productos.filter(
      (product) =>
        (!product.controlaStock || product.stock >= 1) &&
        (!normalizedSearch ||
          product.nombre.toLowerCase().includes(normalizedSearch) ||
          product.marca.nombre.toLowerCase().includes(normalizedSearch)),
    );
  }, [productos, search]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + getLineTotal(item), 0),
    [cart],
  );
  const amountPaid = 0;
  const amountDue = Math.max(0, cartTotal - amountPaid);
  const showPaymentDetails = rightPanel === "payment" && cartTotal > 0;

  function openPaymentDetails() {
    if (cartTotal <= 0 || rightPanel === "payment") return;
    setPaymentMethodsLoading(true);
    setPaymentMethodsError("");
    setRightPanel("payment");
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
    if (cartTotal <= 0) setRightPanel("catalog");
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
    const item = cart.find((entry) => entry.product.id === productId);
    if (item?.kind === "unit" && cartTotal - item.product.precioVenta <= 0 && delta < 0) {
      setRightPanel("catalog");
    }
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
    const item = cart.find((entry) => entry.product.id === productId);
    if (item && cartTotal - getLineTotal(item) <= 0) setRightPanel("catalog");
    weightInputs.current.delete(productId);
    setCart((items) => items.filter((item) => item.product.id !== productId));
  }

  // Price field edited: keep the raw text and recompute the quantity.
  function updateWeightPrice(productId: string, text: string) {
    if (!isSafeAppInput(text) || !PRICE_PATTERN.test(text)) {
      return;
    }

    const item = cart.find((entry) => entry.product.id === productId);
    if (item?.kind === "weight" && cartTotal - getLineTotal(item) + parseDecimal(text) <= 0) {
      setRightPanel("catalog");
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

    const item = cart.find((entry) => entry.product.id === productId);
    if (item?.kind === "weight" && cartTotal - getLineTotal(item) + Math.round(item.product.precioVenta * parseDecimal(text)) <= 0) {
      setRightPanel("catalog");
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
      <Navbar compact showLogout={false} />

      <section className="sales-view-layout">
        <section className="sales-view-cart" aria-label="Carrito de venta">
          <div className="sales-view-heading">
            <div>
              <span>Nueva venta</span>
              <h1>Carrito</h1>
            </div>
            <strong>{cart.length}</strong>
          </div>

          <div className={`sales-view-cart-scroll${cart.length === 0 ? " is-empty" : ""}`}>
            {cart.length === 0 ? (
              <div className="sales-view-empty">
                <strong className="sales-view-empty-store">{storeName}</strong>
                <svg className="sales-view-empty-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <path d="M23 9h-7a5 5 0 0 0-5 5v41a5 5 0 0 0 5 5h32a5 5 0 0 0 5-5V14a5 5 0 0 0-5-5h-7" />
                  <path d="M24 6h16v9H24zM21 27h22M21 37h22M21 47h14" />
                </svg>
                <p>Busca o escanea un producto<br />para iniciar esta venta</p>
              </div>
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

          <button
            type="button"
            className="sales-view-total"
            disabled={cartTotal <= 0}
            onClick={openPaymentDetails}
            aria-label={`Ver detalle del carrito. Total ${formatPrice(cartTotal)}`}
          >
            <span>Total</span>
            <strong>{formatPrice(cartTotal)}</strong>
          </button>
        </section>

        <section className={`sales-view-catalog${showPaymentDetails ? " sales-view-payment" : ""}`} aria-label={showPaymentDetails ? "Detalle del carrito" : "Catálogo de productos"}>
          {showPaymentDetails ? (
            <>
              <header className="sales-payment-heading">
                <button type="button" onClick={() => setRightPanel("catalog")} aria-label="Volver a productos" title="Volver a productos">
                  <ArrowLeft aria-hidden="true" />
                </button>
                <h2>Detalle del carrito</h2>
              </header>

              <div className="sales-payment-scroll">
                <dl className="sales-payment-summary">
                  <div>
                    <dt>Productos por cobrar ({cart.length})</dt>
                    <dd>{formatPrice(cartTotal)}</dd>
                  </div>
                  <div>
                    <dt>Ya pagado</dt>
                    <dd>{formatPrice(amountPaid)}</dd>
                  </div>
                  <div className="is-due">
                    <dt>Por cobrar</dt>
                    <dd>{formatPrice(amountDue)}</dd>
                  </div>
                </dl>

                <div className="sales-payment-methods-heading">
                  <h3>Método de pago</h3>
                </div>
                {paymentMethodsLoading ? (
                  <p className="sales-payment-status" role="status">Cargando métodos de pago...</p>
                ) : paymentMethodsError ? (
                  <p className="sales-payment-status is-error" role="alert">{paymentMethodsError}</p>
                ) : paymentMethods.length === 0 ? (
                  <p className="sales-payment-status">No hay métodos de pago disponibles.</p>
                ) : (
                  <div className="sales-payment-method-grid">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id_medio}
                        type="button"
                        className="sales-payment-method"
                        aria-pressed={selectedPaymentMethodId === method.id_medio}
                        onClick={() => setSelectedPaymentMethodId(method.id_medio)}
                      >
                        <PaymentMethodIcon name={method.medio_de_pago} />
                        <span>{formatPaymentMethodName(method.medio_de_pago)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
          <>
          <input
            className="sales-view-search"
            type="search"
            placeholder="Buscar producto por nombre o marca"
            value={search}
            onChange={(event) => {
              if (isSafeAppInput(event.target.value)) {
                setSearch(event.target.value);
              }
            }}
            aria-label="Buscar producto"
          />

          <div className="sales-view-catalog-heading">
            <h2>Productos disponibles</h2>
            <span>{availableProducts.length}</span>
          </div>

          <div className="sales-view-catalog-scroll">
            {isLoading ? (
              <p className="sales-view-status">Cargando productos...</p>
            ) : error ? (
              <p className="sales-view-status is-error">{error}</p>
            ) : availableProducts.length === 0 ? (
              <p className="sales-view-status">No hay productos disponibles.</p>
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
                          {product.controlaStock ? (
                            <span className="sales-view-stock">Stock: {product.stock}</span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </>
          )}
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
