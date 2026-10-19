"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, Banknote, CreditCard, Wallet, Plus, Trash2, ShoppingBasket, CheckCircle, Printer, ReceiptText } from "lucide-react";
import type { SaleCommand } from "@/lib/sales";
import { Navbar } from "../components/Navbar";
import { useAppearance } from "../components/AppearanceProvider";
import { isSafeAppInput } from "@/lib/input-validation";
import { roundCashAmount } from "@/lib/cash-rounding";
import { CashRoundingNotice } from "../components/CashRoundingNotice";

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

type Sale = {
  id_venta: string;
  num_venta: number;
  revision: number;
  valor_total: number;
  estado: string;
  vuelto: number;
  recibo: string | null;
  detalles: { id_producto: string; cantidad: string; precio_actual: number; subtotal_venta: number; producto: Producto }[];
  pagos: { pago: number }[];
};

function saleCart(sale: Sale): CartItem[] {
  return sale.detalles.map((detail) => {
    const quantity = Number(detail.cantidad);
    const product = { ...detail.producto, precioVenta: detail.precio_actual,
      stock: detail.producto.stock + (detail.producto.controlaStock ? quantity : 0) };
    return product.controlaStock ? { kind: "unit", product, quantity } : {
      kind: "weight", product, quantityText: formatQuantity(quantity), priceText: String(detail.subtotal_venta),
    };
  });
}

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
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const draftKey = useRef<string | null>(null);
  const paymentAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [operationError, setOperationError] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rightPanel, setRightPanel] = useState<"catalog" | "payment" | "complete">("catalog");
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
        const salesResponse = await fetch("/api/ventas", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!salesResponse.ok) throw new Error("No se pudieron cargar las ventas.");
        const saved = await salesResponse.json() as { ventas: Sale[] };
        setSales(saved.ventas);
        if (saved.ventas[0]) {
          setActiveSale(saved.ventas[0]);
          setCart(saleCart(saved.ventas[0]));
        }
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
  const amountPaid = activeSale?.pagos.reduce((sum, payment) => sum + payment.pago, 0) ?? 0;
  const locked = amountPaid > 0;
  const amountDue = Math.max(0, cartTotal - amountPaid);
  const showPaymentDetails = rightPanel === "payment" && cartTotal > 0;
  const showCompletedSale = rightPanel === "complete" && completedSale !== null;
  const selectedMethod = paymentMethods.find((method) => method.id_medio === selectedPaymentMethodId);
  const isCash = selectedMethod?.medio_de_pago.toLowerCase().trim() === "efectivo";
  const cashRounding = roundCashAmount(amountDue);
  const collectionTotal = isCash ? cashRounding.total : amountDue;
  const displayedCartTotal = cartTotal + (isCash ? cashRounding.adjustment : 0);
  const change = isCash ? Math.max(0, Number(cashAmount) - collectionTotal) : 0;
  const invalidCashAmount = isCash && cashAmount !== "" && Number(cashAmount) % 10 !== 0;
  const canRegisterPayment = !busy && (!isCash || (
    cashAmount !== "" && !invalidCashAmount && Number(cashAmount) <= 2147483647 &&
    (Number(cashAmount) > 0 || collectionTotal === 0)
  ));

  function selectSale(sale: Sale | null) {
    if (busyRef.current) return;
    setActiveSale(sale);
    setCart(sale ? saleCart(sale).map((item) => {
      const available = productos.find((product) => product.id === item.product.id);
      return available && item.kind === "unit" ? { ...item, product: { ...item.product, stock: available.stock + item.quantity } } : item;
    }) : []);
    setRightPanel("catalog");
    setSelectedPaymentMethodId(null);
    setCashAmount("");
    setOperationError("");
    setCompletedSale(null);
    draftKey.current = null;
    paymentAttempt.current = null;
  }

  async function refreshInventory() {
    const response = await fetch("/api/producto", { headers: { Authorization: `Bearer ${localStorage.getItem("jwt")}` }, cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setProductos(data.productos ?? []);
    }
  }

  async function mutate(command: SaleCommand) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setOperationError("");
    try {
      const response = await fetch("/api/ventas", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwt")}` },
        body: JSON.stringify(command),
      });
      const data = await response.json() as { venta: Sale | null; message?: string; receiptWarning?: string };
      if (!response.ok) {
        if (response.status === 401) router.replace("/login");
        if (response.status === 409) {
          const updated = await fetch("/api/ventas", { headers: { Authorization: `Bearer ${localStorage.getItem("jwt")}` }, cache: "no-store" });
          if (updated.ok) {
            const { ventas } = await updated.json() as { ventas: Sale[] };
            setSales(ventas);
            const current = ventas.find((sale) => sale.id_venta === activeSale?.id_venta) ?? null;
            setActiveSale(current);
            setCart(current ? saleCart(current) : []);
          }
        }
        throw new Error(data.message ?? "No se pudo guardar la venta.");
      }
      const sale = data.venta;
      if (!sale) {
        const removedId = activeSale?.id_venta;
        setSales((current) => current.filter((item) => item.id_venta !== removedId));
        setActiveSale(null);
        setCart([]);
        setCompletedSale(null);
        setRightPanel("catalog");
        draftKey.current = null;
      } else if (sale.estado === "completado") {
        setSales((current) => current.filter((item) => item.id_venta !== sale.id_venta));
        setActiveSale(null);
        setCart(saleCart(sale));
        setCompletedSale(sale);
        setRightPanel("complete");
        draftKey.current = null;
        if (data.receiptWarning) setOperationError(data.receiptWarning);
      } else {
        setSales((current) => [...current.filter((item) => item.id_venta !== sale.id_venta), sale].sort((a, b) => a.num_venta - b.num_venta));
        setActiveSale(sale);
        setCart(saleCart(sale));
        setCompletedSale(null);
      }
      setSelectedPaymentMethodId(null);
      setCashAmount("");
      paymentAttempt.current = null;
      // A failed catalogue refresh must not turn a successful payment into a retry.
      await refreshInventory().catch(() => undefined);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "No se pudo conectar. Reintenta la operacion.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function saveQuantity(productId: string, quantity: number) {
    if (locked || completedSale || busyRef.current) return;
    if (activeSale) {
      void mutate({ action: "item", saleId: activeSale.id_venta, revision: activeSale.revision, productId, quantity });
    } else {
      draftKey.current ??= crypto.randomUUID();
      void mutate({ action: "create", key: draftKey.current, productId, quantity });
    }
  }

  function cancelSale() {
    if (!activeSale || locked || busyRef.current) return;
    if (window.confirm(`¿Eliminar la venta ${activeSale.num_venta}? Se liberara todo su stock reservado.`)) {
      void mutate({ action: "cancel", saleId: activeSale.id_venta, revision: activeSale.revision });
    }
  }

  function registerPayment() {
    if (!activeSale || !selectedMethod || busyRef.current || !canRegisterPayment) return;
    const amount = isCash ? Number(cashAmount) : undefined;
    const fingerprint = JSON.stringify([activeSale.id_venta, activeSale.revision, selectedMethod.id_medio, amount]);
    if (paymentAttempt.current?.fingerprint !== fingerprint) paymentAttempt.current = { fingerprint, key: crypto.randomUUID() };
    void mutate({ action: "pay", saleId: activeSale.id_venta, revision: activeSale.revision,
      methodId: selectedMethod.id_medio, amount, key: paymentAttempt.current.key });
  }

  function openPaymentDetails() {
    if (busyRef.current || !activeSale || cartTotal <= 0 || rightPanel === "payment") return;
    setPaymentMethodsLoading(true);
    setPaymentMethodsError("");
    setRightPanel("payment");
  }

  function finishCompletedSale() {
    selectSale(null);
  }

  function printCompletedReceipt() {
    if (!completedSale?.recibo) {
      setOperationError("El recibo no está disponible para imprimir.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=520,height=760");
    if (!printWindow) {
      setOperationError("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo nuevamente.");
      return;
    }

    const image = printWindow.document.createElement("img");
    image.alt = `Recibo de la venta ${completedSale.num_venta}`;
    image.src = completedSale.recibo;
    image.style.display = "block";
    image.style.height = "auto";
    image.style.margin = "0 auto";
    image.style.maxWidth = "100%";

    printWindow.document.title = `Recibo venta ${completedSale.num_venta}`;
    printWindow.document.body.style.margin = "0";
    printWindow.document.body.style.background = "#ffffff";
    printWindow.document.body.append(image);
    image.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      finishCompletedSale();
    }, { once: true });
    image.addEventListener("error", () => {
      printWindow.close();
      setOperationError("No se pudo cargar el recibo para imprimir.");
    }, { once: true });
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
    if (locked || busyRef.current) return;
    if (cartTotal <= 0) setRightPanel("catalog");
    const existing = cart.find((item) => item.product.id === product.id);

    if (!existing) {
      saveQuantity(product.id, 1);
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
    if (item?.kind === "unit") saveQuantity(productId, Math.max(0, item.quantity + delta));
  }

  function removeFromCart(productId: string) {
    const item = cart.find((entry) => entry.product.id === productId);
    if (item && cartTotal - getLineTotal(item) <= 0) setRightPanel("catalog");
    weightInputs.current.delete(productId);
    saveQuantity(productId, 0);
  }

  // Price field edited: keep the raw text and recompute the quantity.
  function updateWeightPrice(productId: string, text: string) {
    if (locked || busyRef.current) return;
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
    if (locked || busyRef.current) return;
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

  function saveWeight(item: CartItem) {
    if (item.kind !== "weight" || locked) return;
    const quantity = Math.round(parseDecimal(item.quantityText) * 1000) / 1000;
    const saved = activeSale?.detalles.find((detail) => detail.id_producto === item.product.id);
    if (saved && quantity === Number(saved.cantidad)) {
      setCart((current) => current.map((entry) => entry.product.id === item.product.id ?
        { ...item, quantityText: formatQuantity(quantity), priceText: String(saved.subtotal_venta) } : entry));
      return;
    }
    saveQuantity(item.product.id, quantity);
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
      {operationError && <p className="sales-operation-error" role="alert">{operationError}</p>}
      <section className="sales-view-layout sales-with-tabs" aria-busy={busy}>
        <nav className="sales-tabs" aria-label="Ventas pendientes">
          {sales.map((sale) => (
            <button key={sale.id_venta} type="button" disabled={busy || Boolean(completedSale)}
              aria-current={activeSale?.id_venta === sale.id_venta ? "page" : undefined}
              aria-label={`Seleccionar venta pendiente ${sale.num_venta}`}
              title="Venta pendiente"
              onClick={() => selectSale(sale)}>
              <ShoppingBasket aria-hidden="true" />
            </button>
          ))}
          {!activeSale && sales.length < 5 && <button type="button" aria-current="page" title="Nueva venta" disabled><Plus aria-hidden="true" /><span>Nueva</span></button>}
        </nav>
        <section className="sales-view-cart" aria-label="Carrito de venta">
          <div className="sales-view-heading">
            <div>
              <span>{completedSale ? "Venta completada" : activeSale ? "Venta actual" : "Nueva venta"}</span>
              <h1>{completedSale ? "Venta completada" : "Carrito"}</h1>
            </div>
            <button className="sales-action" type="button" disabled={busy || isLoading || sales.length >= 5 || !activeSale}
              onClick={() => selectSale(null)} title={sales.length >= 5 ? "Limite de cinco ventas pendientes" : "Nueva venta"}>
              <Plus aria-hidden="true" /> Nueva venta
            </button>
            <button className="sales-action sales-delete" type="button" onClick={cancelSale} disabled={busy || locked || !activeSale}
              title={locked ? "No se puede eliminar una venta con pagos" : "Eliminar venta"} aria-label="Eliminar venta">
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          {locked && <p className="sales-locked" role="status">Venta con pagos registrados. Los productos no se pueden modificar.</p>}

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
                      disabled={busy || locked || Boolean(completedSale)}
                      onWeightBlur={() => saveWeight(item)}
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
            disabled={cartTotal <= 0 || busy || !activeSale}
            onClick={openPaymentDetails}
            aria-label={`Ver detalle del carrito. Total ${formatPrice(displayedCartTotal)}`}
          >
            <span>Total</span>
            <strong>{formatPrice(displayedCartTotal)}</strong>
          </button>
        </section>

        <section
          className={`sales-view-catalog${showPaymentDetails ? " sales-view-payment" : ""}${showCompletedSale ? " sales-view-complete" : ""}`}
          aria-label={showCompletedSale ? "Cobro exitoso" : showPaymentDetails ? "Detalle del carrito" : "Catálogo de productos"}
        >
          {showCompletedSale ? (
            <div className="sales-complete-content" role="status">
              <span className="sales-complete-icon"><CheckCircle aria-hidden="true" /></span>
              <div className="sales-complete-message">
                <h2>¡Cobro exitoso!</h2>
                <p>Sólo puedes emitir un Recibo No válido como Boleta</p>
              </div>
              <div className="sales-complete-actions">
                <button type="button" className="is-primary" onClick={printCompletedReceipt} disabled={!completedSale.recibo}>
                  <Printer aria-hidden="true" /> Imprimir boleta
                </button>
                <button type="button" onClick={finishCompletedSale}>
                  <ReceiptText aria-hidden="true" /> Emitir sin imprimir
                </button>
              </div>
              {!completedSale.recibo ? <p className="sales-complete-warning">El recibo no está disponible para imprimir.</p> : null}
            </div>
          ) : showPaymentDetails ? (
            <>
              <header className="sales-payment-heading">
                <button type="button" disabled={busy} onClick={() => selectedMethod ? setSelectedPaymentMethodId(null) : setRightPanel("catalog")} aria-label={selectedMethod ? "Cambiar metodo de pago" : "Volver a productos"} title="Volver">
                  <ArrowLeft aria-hidden="true" />
                </button>
                <h2>{selectedMethod ? "Cambiar método de pago" : "Detalle del carrito"}</h2>
              </header>

              <div className="sales-payment-scroll">
                {selectedMethod ? (
                  <form className="sales-collection" onSubmit={(event) => { event.preventDefault(); registerPayment(); }}>
                    <h3>Total a cobrar con {formatPaymentMethodName(selectedMethod.medio_de_pago)}</h3>
                    <output className="sales-collection-total">{formatPrice(collectionTotal)}</output>
                    {isCash && <CashRoundingNotice adjustment={cashRounding.adjustment} />}
                    {isCash && <label>
                      <span>Ingresar monto entregado</span>
                      <input aria-label="Monto entregado" autoFocus inputMode="numeric" value={cashAmount} disabled={busy}
                        aria-invalid={invalidCashAmount || undefined} aria-describedby={invalidCashAmount ? "cash-amount-error" : undefined}
                        maxLength={10} onChange={(event) => { if (PRICE_PATTERN.test(event.target.value)) setCashAmount(event.target.value); }} />
                    </label>}
                    {invalidCashAmount && <p id="cash-amount-error" className="sales-cash-error" role="alert">Monto ingresado debe terminar en 0</p>}
                    {change > 0 && !invalidCashAmount && <p className="sales-change" role="status">Vuelto a entregar <strong>{formatPrice(change)}</strong></p>}
                    <button className="sales-register-payment" type="submit" disabled={!canRegisterPayment}>
                      {busy ? "Registrando..." : "Registrar cobro"}
                    </button>
                  </form>
                ) : <>
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
                        disabled={busy}
                        onClick={() => { setSelectedPaymentMethodId(method.id_medio); setCashAmount(""); }}
                      >
                        <PaymentMethodIcon name={method.medio_de_pago} />
                        <span>{formatPaymentMethodName(method.medio_de_pago)}</span>
                      </button>
                    ))}
                  </div>
                )}
                </>}
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
                  const isMaxed = product.controlaStock && product.stock <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`sales-view-card${cartQuantity !== null ? " is-in-cart" : ""}`}
                      onClick={() => addToCart(product)}
                      disabled={isMaxed || busy || locked || isLoading || (!activeSale && sales.length >= 5)}
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
  disabled: boolean;
  onWeightBlur: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onPriceChange: (text: string) => void;
  onQuantityChange: (text: string) => void;
  quantityInputRef: (input: HTMLInputElement | null) => void;
};

function CartRow({
  item,
  disabled,
  onWeightBlur,
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
                disabled={disabled}
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
                disabled={disabled || item.quantity >= product.stock}
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
                  disabled={disabled}
                  onBlur={onWeightBlur}
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
                  disabled={disabled}
                  onBlur={onWeightBlur}
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
          disabled={disabled}
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
