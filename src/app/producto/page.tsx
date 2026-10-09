"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "../components/Navbar";
import { isSafeAppInput, isSafeDescriptionInput } from "@/lib/input-validation";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  marcaId: string;
  codigoBarra: string | null;
  categoriaId: string;
  unidadId: string;
  empaque: string | null;
  id_proveedor: string | null;
  contenido: number | null;
  unidad_medida: string | null;
  stock: number;
  costo: number;
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

type ExpiringProduct = Producto & {
  lotes: {
    fecha_vencimiento: string;
    cantidad: number;
  }[];
};

type Option = {
  id: string;
  nombre?: string;
  nombreCategoria?: string;
  unidad?: string;
  id_empaque?: string;
  nombre_empaque?: string;
  id_proveedor?: string;
};

type ProductOptions = {
  marcas: Option[];
  categorias: Option[];
  unidades: Option[];
  unidadesMedida: Option[];
  empaques: Option[];
  proveedores: Option[];
};

type CreateProductForm = {
  nombre: string;
  descripcion: string;
  marcaId: string;
  marcaNombre: string;
  codigoBarra: string;
  categoriaId: string;
  categoriaNombre: string;
  unidadId: string;
  empaqueId: string;
  empaqueNombre: string;
  proveedorId: string;
  contenido: string;
  unidadMedidaId: string;
  precioVenta: string;
  costo: string;
};

type EditProductForm = {
  nombre: string;
  descripcion: string;
  marcaId: string;
  codigoBarra: string;
  categoriaId: string;
  unidadId: string;
  empaqueId: string;
  proveedorId: string;
  contenido: string;
  unidadMedidaId: string;
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

type PendingLotDeletion = {
  productId: string;
  productName: string;
  expirationDate: string;
  quantity: number;
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

function getProductContentLabel(producto: Producto) {
  const measure =
    producto.unidad_medida_productos_unidad_medidaTounidad_medida?.nombre ?? "";

  if (producto.contenido && measure) {
    return `${producto.contenido.toLocaleString("es-CL")} ${measure}`;
  }

  return producto.descripcion || "Sin descripcion";
}

function getMovementReason(tipo: number) {
  if (tipo === 2) {
    return {
      label: "Ingreso de stock",
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 7h11v10H3z" />
          <path d="M14 11h4l3 3v3h-7z" />
          <path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          <path d="M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      ),
    };
  }

  if (tipo === 3) {
    return {
      label: "Venta",
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M6 8h12l1 13H5z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      ),
    };
  }

  return {
    label: "Eliminacion de stock",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M7 7l1 14h8l1-14" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    ),
  };
}

function getMovementQuantity(movement: StockMovement) {
  if (movement.tipo === 1 || movement.tipo === 3) {
    return -Math.abs(movement.cantidad);
  }

  return movement.cantidad;
}

function getTomorrowDateInputValue(chileToday: string | null) {
  if (!chileToday) return "";
  const tomorrow = new Date(`${chileToday}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function getExpirationDiffDays(expirationDate: string, chileToday: string | null) {
  if (!expirationDate || !chileToday) {
    return null;
  }

  const normalizedExpirationDate = expirationDate.includes("T")
    ? expirationDate.slice(0, 10)
    : expirationDate;
  const expiration = new Date(`${normalizedExpirationDate}T00:00:00.000Z`);
  const today = new Date(`${chileToday}T00:00:00.000Z`);

  if (Number.isNaN(expiration.getTime())) {
    return null;
  }

  return Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function isFutureExpirationDate(expirationDate: string, chileToday: string | null) {
  const diffDays = getExpirationDiffDays(expirationDate, chileToday);
  return diffDays !== null && diffDays > 0;
}

function getExpirationSummary(expirationDate: string, chileToday: string | null) {
  const diffDays = getExpirationDiffDays(expirationDate, chileToday);

  if (diffDays === null) {
    return "";
  }

  if (diffDays <= 0) {
    return "la fecha ingresada no es válida";
  }

  const years = Math.floor(diffDays / 365);
  const remainingAfterYears = diffDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} año${years === 1 ? "" : "s"}`);
  }

  if (months > 0) {
    parts.push(`${months} mes${months === 1 ? "" : "es"}`);
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${days} día${days === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

function isCloseToExpiration(expirationDate: string, chileToday: string | null) {
  const diffDays = getExpirationDiffDays(expirationDate, chileToday);
  return diffDays !== null && diffDays > 0 && diffDays <= 5;
}

function isExpiredOrToday(expirationDate: string, chileToday: string | null) {
  const diffDays = getExpirationDiffDays(expirationDate, chileToday);
  return diffDays !== null && diffDays <= 0;
}

function buildEditForm(producto: Producto): EditProductForm {
  return {
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    marcaId: producto.marcaId,
    codigoBarra: producto.codigoBarra ?? "",
    categoriaId: producto.categoriaId,
    unidadId: producto.unidadId,
    empaqueId: producto.empaque ?? "",
    proveedorId: producto.id_proveedor ?? "",
    contenido: producto.contenido ? String(producto.contenido) : "",
    unidadMedidaId: producto.unidad_medida ?? "",
  };
}

const initialCreateForm: CreateProductForm = {
  nombre: "",
  descripcion: "",
  marcaId: "",
  marcaNombre: "",
  codigoBarra: "",
  categoriaId: "",
  categoriaNombre: "",
  unidadId: "",
  empaqueId: "",
  empaqueNombre: "",
  proveedorId: "",
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
  const [activeProductTab, setActiveProductTab] = useState<
    "productos" | "promociones" | "vencimiento"
  >("productos");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [isLoadingExpiringProducts, setIsLoadingExpiringProducts] = useState(false);
  const [expiringProductsError, setExpiringProductsError] = useState("");
  const [openExpiringProductId, setOpenExpiringProductId] = useState<string | null>(
    null,
  );
  const [pendingLotDeletion, setPendingLotDeletion] =
    useState<PendingLotDeletion | null>(null);
  const [isDeletingLot, setIsDeletingLot] = useState(false);
  const [chileToday, setChileToday] = useState<string | null>(null);
  const [chileTimeError, setChileTimeError] = useState("");
  const [deleteLotMessage, setDeleteLotMessage] = useState("");
  const [options, setOptions] = useState<ProductOptions>({
    marcas: [],
    categorias: [],
    unidades: [],
    unidadesMedida: [],
    empaques: [],
    proveedores: [],
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
  const [stockExpirationDate, setStockExpirationDate] = useState("");
  const [showStockExpirationConfirm, setShowStockExpirationConfirm] =
    useState(false);
  const [wasteComment, setWasteComment] = useState("");
  const [stockActionMessage, setStockActionMessage] = useState("");
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"empty" | "detail" | "create">("empty");
  const [createForm, setCreateForm] =
    useState<CreateProductForm>(initialCreateForm);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [createMessage, setCreateMessage] = useState("");
  const [createMessageType, setCreateMessageType] = useState<"error" | "success">(
    "error",
  );
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditProductForm | null>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [isEditImageRemoved, setIsEditImageRemoved] = useState(false);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadChileDate = useCallback(async () => {
    try {
      const response = await fetch("/api/hora-chile", { cache: "no-store" });
      const data = (await response.json()) as { status?: string; fecha?: string };
      if (!response.ok || data.status !== "ok" || !data.fecha) {
        throw new Error("No se pudo consultar la fecha de Chile.");
      }
      setChileToday(data.fecha);
      setChileTimeError("");
    } catch {
      setChileToday(null);
      setChileTimeError("No se pudo consultar la fecha de Chile. Revisa tu conexión e intenta nuevamente.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadChileDate(), 0);
    const interval = window.setInterval(loadChileDate, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadChileDate]);

  const loadExpiringProducts = useCallback(async () => {
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsLoadingExpiringProducts(true);
    setExpiringProductsError("");

    try {
      const response = await fetch("/api/producto-vencimiento", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        productos?: ExpiringProduct[];
      };

      if (!response.ok || data.status !== "ok") {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setExpiringProductsError(
          data.message ?? "No se pudieron cargar los productos por vencer.",
        );
        return;
      }

      setExpiringProducts(data.productos ?? []);
    } catch {
      setExpiringProductsError("No se pudo conectar con el servidor.");
    } finally {
      setIsLoadingExpiringProducts(false);
    }
  }, [router]);

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
        loadExpiringProducts();
      } catch {
        setError("No se pudo conectar con el servidor.");
        setIsLoading(false);
      }
    }

    loadProductos();
  }, [loadExpiringProducts, router]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  function changeProductTab(tab: "productos" | "promociones" | "vencimiento") {
    setActiveProductTab(tab);
    closeStockModal();
    setPendingLotDeletion(null);
    setDeleteLotMessage("");

    if (tab === "vencimiento") {
      setSelectedProductId(null);
      setPanelMode("empty");
      setPriceState(null);
      setOpenExpiringProductId(null);
      loadExpiringProducts();
    }
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

  const filteredExpiringProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return expiringProducts;
    }

    return expiringProducts.filter((producto) =>
      producto.nombre.toLowerCase().includes(query),
    );
  }, [expiringProducts, search]);

  const selectedProduct = useMemo(
    () => productos.find((producto) => producto.id === selectedProductId) ?? null,
    [productos, selectedProductId],
  );
  const hasCloseExpiringProduct = useMemo(
    () =>
      expiringProducts.some((producto) =>
        producto.lotes.some((lote) => isCloseToExpiration(lote.fecha_vencimiento, chileToday)),
      ),
    [expiringProducts, chileToday],
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
    setCreateImage(null);
    setCreateMessage("");
    setCreateMessageType("error");
    setCreateSubmitted(false);
    closeStockModal();
  }

  function updateCreateForm(field: keyof CreateProductForm, value: string) {
    const isSafeValue =
      field === "descripcion"
        ? isSafeDescriptionInput(value)
        : isSafeAppInput(value);

    if (!isSafeValue) {
      return;
    }

    if (
      ["contenido", "precioVenta", "costo"].includes(field) &&
      !isUnsignedIntegerText(value)
    ) {
      return;
    }

    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateMessage("");
    setCreateMessageType("error");
  }

  function openEditModal(producto: Producto) {
    setEditForm(buildEditForm(producto));
    setEditImage(null);
    setIsEditImageRemoved(false);
    setEditSubmitted(false);
    setEditMessage("");
    setIsEditModalOpen(true);
    closeStockModal();
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditForm(null);
    setEditImage(null);
    setIsEditImageRemoved(false);
    setEditSubmitted(false);
    setEditMessage("");
  }

  function updateEditForm(field: keyof EditProductForm, value: string) {
    const isSafeValue =
      field === "descripcion"
        ? isSafeDescriptionInput(value)
        : isSafeAppInput(value);

    if (!isSafeValue) {
      return;
    }

    if (field === "contenido" && !isUnsignedIntegerText(value)) {
      return;
    }

    setEditForm((current) => (current ? { ...current, [field]: value } : current));
    setEditMessage("");
  }

  function closeStockModal() {
    setStockModal(null);
    setStockQuantity("");
    setStockExpirationDate("");
    setShowStockExpirationConfirm(false);
    setWasteComment("");
    setStockActionMessage("");
    setSelectedComment(null);
  }

  function openStockModal(type: StockModal) {
    setStockModal(type);
    setStockQuantity("");
    setStockExpirationDate("");
    setShowStockExpirationConfirm(false);
    setWasteComment("");
    setStockActionMessage("");
    setSelectedComment(null);

    if (type === "movements" && selectedProduct) {
      loadMovements(selectedProduct.id);
    }
  }

  function updateStockQuantity(value: string) {
    if (isSafeAppInput(value) && (value === "" || /^[1-9]\d*$/.test(value))) {
      setStockQuantity(value);
      setStockActionMessage("");
    }
  }

  function updateStockExpirationDate(value: string) {
    if (isSafeAppInput(value)) {
      setStockExpirationDate(value);
    }
  }

  function updateWasteComment(value: string) {
    if (isSafeAppInput(value)) {
      setWasteComment(value);
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
    const usesNewCategory = createForm.categoriaId === "new";
    const usesNewPackaging = createForm.empaqueId === "new";
    const normalizedBrandName = createForm.marcaNombre.trim().toLocaleLowerCase("es-CL");
    const normalizedCategoryName = createForm.categoriaNombre
      .trim()
      .toLocaleLowerCase("es-CL");
    const normalizedPackagingName = createForm.empaqueNombre
      .trim()
      .toLocaleLowerCase("es-CL");
    const brandAlreadyExists = options.marcas.some(
      (marca) => marca.nombre?.trim().toLocaleLowerCase("es-CL") === normalizedBrandName,
    );
    const categoryAlreadyExists = options.categorias.some(
      (categoria) =>
        categoria.nombreCategoria?.trim().toLocaleLowerCase("es-CL") ===
        normalizedCategoryName,
    );
    const packagingAlreadyExists = options.empaques.some(
      (empaque) =>
        empaque.nombre_empaque?.trim().toLocaleLowerCase("es-CL") ===
        normalizedPackagingName,
    );

    setCreateSubmitted(true);

    if (
      !createForm.nombre.trim() ||
      (!createForm.marcaId || (usesNewBrand && !createForm.marcaNombre.trim())) ||
      (!createForm.categoriaId ||
        (usesNewCategory && !createForm.categoriaNombre.trim())) ||
      (!createForm.empaqueId ||
        (usesNewPackaging && !createForm.empaqueNombre.trim())) ||
      !createForm.unidadId ||
      !isPositiveIntegerText(createForm.precioVenta) ||
      !isPositiveIntegerText(createForm.costo) ||
      (needsMeasure &&
        (!isPositiveIntegerText(createForm.contenido) ||
          !createForm.unidadMedidaId))
    ) {
      setCreateMessage("Completa los datos obligatorios antes de guardar.");
      setCreateMessageType("error");
      return;
    }

    if (usesNewBrand && brandAlreadyExists) {
      setCreateMessage("La marca ingresada ya existe. Seleccionala desde la lista.");
      setCreateMessageType("error");
      return;
    }

    if (usesNewCategory && categoryAlreadyExists) {
      setCreateMessage("La categoria ingresada ya existe. Seleccionala desde la lista.");
      setCreateMessageType("error");
      return;
    }

    if (usesNewPackaging && packagingAlreadyExists) {
      setCreateMessage("El empaque ingresado ya existe. Seleccionalo desde la lista.");
      setCreateMessageType("error");
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
      const formData = new FormData();
      formData.append("nombre", createForm.nombre.trim());
      formData.append("descripcion", createForm.descripcion.trim());
      if (usesNewBrand) {
        formData.append("marcaNombre", createForm.marcaNombre.trim());
      } else {
        formData.append("marcaId", createForm.marcaId);
      }
      formData.append("codigoBarra", createForm.codigoBarra.trim());
      if (usesNewCategory) {
        formData.append("categoriaNombre", createForm.categoriaNombre.trim());
      } else {
        formData.append("categoriaId", createForm.categoriaId);
      }
      if (usesNewPackaging) {
        formData.append("empaqueNombre", createForm.empaqueNombre.trim());
      } else {
        formData.append("empaque", createForm.empaqueId);
      }
      formData.append("unidadId", createForm.unidadId);
      formData.append("id_proveedor", createForm.proveedorId);
      if (needsMeasure) {
        formData.append("contenido", createForm.contenido);
        formData.append("unidad_medida", createForm.unidadMedidaId);
      }
      formData.append("precioVenta", createForm.precioVenta);
      formData.append("costo", createForm.costo);
      formData.append("stock", "0");
      if (createImage) {
        formData.append("imagen", createImage);
      }

      const response = await fetch("/api/producto", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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
        setCreateMessageType("error");
        return;
      }

      setProductos((current) =>
        [...current, data.producto as Producto].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      );
      if (usesNewBrand) {
        setOptions((current) => ({
          ...current,
          marcas: [
            ...current.marcas,
            { id: data.producto?.marcaId ?? "", nombre: createForm.marcaNombre.trim() },
          ]
            .filter((marca) => marca.id)
            .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
        }));
      }
      if (usesNewCategory) {
        setOptions((current) => ({
          ...current,
          categorias: [
            ...current.categorias,
            {
              id: data.producto?.categoriaId ?? "",
              nombreCategoria: createForm.categoriaNombre.trim(),
            },
          ]
            .filter((categoria) => categoria.id)
            .sort((a, b) =>
              (a.nombreCategoria ?? "").localeCompare(b.nombreCategoria ?? ""),
            ),
        }));
      }
      if (usesNewPackaging) {
        setOptions((current) => ({
          ...current,
          empaques: [
            ...current.empaques,
            {
              id: data.producto?.empaque ?? "",
              id_empaque: data.producto?.empaque ?? "",
              nombre_empaque: createForm.empaqueNombre.trim(),
            },
          ]
            .filter((empaque) => empaque.id_empaque)
            .sort((a, b) =>
              (a.nombre_empaque ?? "").localeCompare(b.nombre_empaque ?? ""),
            ),
        }));
      }
      setCreateForm(initialCreateForm);
      setCreateImage(null);
      setCreateMessage("Producto creado correctamente.");
      setCreateMessageType("success");
      setCreateSubmitted(false);
    } catch {
      setCreateMessage("No se pudo conectar con el servidor.");
      setCreateMessageType("error");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  function requestAddedStockConfirmation() {
    if (
      !isPositiveIntegerText(stockQuantity) ||
      !isFutureExpirationDate(stockExpirationDate, chileToday)
    ) {
      return;
    }

    setShowStockExpirationConfirm(true);
  }

  async function saveEditedProduct() {
    if (!selectedProduct || !editForm) {
      return;
    }

    const selectedUnit = options.unidades.find((unit) => unit.id === editForm.unidadId);
    const needsMeasure = selectedUnit?.unidad?.toLowerCase() === "por unidad";

    setEditSubmitted(true);

    if (
      !editForm.nombre.trim() ||
      !editForm.marcaId ||
      !editForm.categoriaId ||
      !editForm.empaqueId ||
      !editForm.unidadId ||
      (needsMeasure &&
        (!isPositiveIntegerText(editForm.contenido) || !editForm.unidadMedidaId))
    ) {
      setEditMessage("Completa los datos obligatorios antes de guardar.");
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSavingEdit(true);
    setEditMessage("");

    try {
      const formData = new FormData();
      formData.append("id", selectedProduct.id);
      formData.append("nombre", editForm.nombre.trim());
      formData.append("descripcion", editForm.descripcion.trim());
      formData.append("marcaId", editForm.marcaId);
      formData.append("codigoBarra", editForm.codigoBarra.trim());
      formData.append("categoriaId", editForm.categoriaId);
      formData.append("empaque", editForm.empaqueId);
      formData.append("unidadId", editForm.unidadId);
      formData.append("id_proveedor", editForm.proveedorId);
      if (needsMeasure) {
        formData.append("contenido", editForm.contenido);
        formData.append("unidad_medida", editForm.unidadMedidaId);
      }
      if (isEditImageRemoved || editImage) {
        formData.append("removeImage", "true");
      }
      if (editImage) {
        formData.append("imagen", editImage);
      }

      const response = await fetch("/api/producto", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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

        setEditMessage(data.message ?? "No se pudo actualizar el producto.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id ? data.producto : producto,
        ),
      );
      setPriceState(buildInitialPriceState(data.producto));
      closeEditModal();
    } catch {
      setEditMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function saveAddedStock() {
    if (
      !selectedProduct ||
      !isPositiveIntegerText(stockQuantity) ||
      !isFutureExpirationDate(stockExpirationDate, chileToday)
    ) {
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
          stock: nextStock,
          stock_restante: nextStock,
          comentario: null,
          tipo: 2,
          fecha_vencimiento: stockExpirationDate,
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

        setStockActionMessage(data.message ?? "No se pudo actualizar el stock.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id
            ? { ...producto, stock: data.producto.stock }
            : producto,
        ),
      );
      await loadExpiringProducts();
      setShowStockExpirationConfirm(false);
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
          tipo: 1,
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
      await loadExpiringProducts();
      closeStockModal();
    } catch {
      setStockActionMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingStock(false);
    }
  }

  async function deleteExpiredLot() {
    if (!pendingLotDeletion) {
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsDeletingLot(true);
    setDeleteLotMessage("");

    try {
      const response = await fetch("/api/producto-vencimiento", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productoId: pendingLotDeletion.productId,
          fecha_vencimiento: pendingLotDeletion.expirationDate,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        producto?: { id: string; stock: number };
        deletedCount?: number;
      };

      if (!response.ok || data.status !== "ok" || !data.producto) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setDeleteLotMessage(data.message ?? "No se pudo eliminar el lote.");
        return;
      }

      setProductos((current) =>
        current.map((producto) =>
          producto.id === data.producto?.id
            ? { ...producto, stock: data.producto.stock }
            : producto,
        ),
      );
      await loadExpiringProducts();
      setPendingLotDeletion(null);
    } catch {
      setDeleteLotMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsDeletingLot(false);
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

      setMovements(
        [...(data.movimientos ?? [])].sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        ),
      );
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
        activeProductTab={activeProductTab}
        onProductTabChange={changeProductTab}
        showExpiringAlert={hasCloseExpiringProduct}
        showLogout={false}
      />

      <section
        className={
          activeProductTab === "vencimiento"
            ? "product-view-layout is-expiring-view"
            : "product-view-layout"
        }
      >
        <div className="product-list-panel">
          <div
            className={
              activeProductTab === "productos"
                ? "product-search-row"
                : "product-search-row is-full"
            }
          >
            <input
              className="product-search"
              type="search"
              placeholder="Buscar producto"
              value={search}
              onChange={(event) => {
                if (isSafeAppInput(event.target.value)) {
                  setSearch(event.target.value);
                }
              }}
            />
            {activeProductTab === "productos" ? (
              <button
                className="product-add-button"
                type="button"
                aria-label="Agregar producto"
                title="Agregar producto"
                onClick={openCreateProductPanel}
              >
                +
              </button>
            ) : null}
          </div>

          {activeProductTab === "vencimiento" ? (
            <ExpiringProductsTable
              products={filteredExpiringProducts}
              isLoading={isLoadingExpiringProducts}
              error={expiringProductsError}
              chileToday={chileToday}
              timeError={chileTimeError}
              openProductId={openExpiringProductId}
              onToggleProduct={(productId) =>
                setOpenExpiringProductId((current) =>
                  current === productId ? null : productId,
                )
              }
              onRequestDeleteLot={setPendingLotDeletion}
            />
          ) : null}

          {activeProductTab === "productos" && isLoading ? (
            <p className="product-empty">Cargando productos...</p>
          ) : null}
          {activeProductTab === "productos" && error ? (
            <p className="product-error">{error}</p>
          ) : null}

          {activeProductTab === "productos" && !isLoading && !error ? (
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
                            <span>Marca: {producto.marca.nombre}</span>
                            <span>{getProductContentLabel(producto)}</span>
                            <span>Tipo de venta: {producto.unidad.unidad}</span>
                            <span>Categoria: {producto.categoria.nombreCategoria}</span>
                            <span>
                              Tipo de empaque:{" "}
                              {producto.empaque_productos_empaqueToempaque
                                ?.nombre_empaque ?? "Sin empaque"}
                            </span>
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

        {activeProductTab === "vencimiento" ? null : panelMode === "create" ? (
          <ProductCreatePanel
            form={createForm}
            options={options}
            message={createMessage}
            messageType={createMessageType}
            submitted={createSubmitted}
            isCreating={isCreatingProduct}
            onChange={updateCreateForm}
            onSubmit={createProduct}
            image={createImage}
            onImageChange={setCreateImage}
          />
        ) : selectedProduct && priceState ? (
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
            onEdit={openEditModal}
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
          chileToday={chileToday}
          timeError={chileTimeError}
          modal={stockModal}
          quantity={stockQuantity}
          expirationDate={stockExpirationDate}
          comment={wasteComment}
          message={stockActionMessage}
          isSaving={isSavingStock}
          movements={movements}
          isLoadingMovements={isLoadingMovements}
          selectedComment={selectedComment}
          showExpirationConfirm={showStockExpirationConfirm}
          onQuantityChange={updateStockQuantity}
          onExpirationDateChange={updateStockExpirationDate}
          onCommentChange={updateWasteComment}
          onClose={closeStockModal}
          onConfirmAdd={requestAddedStockConfirmation}
          onBackFromExpirationConfirm={() => setShowStockExpirationConfirm(false)}
          onAcceptExpirationConfirm={saveAddedStock}
          onConfirmWaste={saveWasteStock}
          onShowComment={setSelectedComment}
        />
      ) : null}

      {selectedProduct && editForm && isEditModalOpen ? (
        <ProductEditModal
          product={selectedProduct}
          form={editForm}
          options={options}
          image={editImage}
          isImageRemoved={isEditImageRemoved}
          submitted={editSubmitted}
          message={editMessage}
          isSaving={isSavingEdit}
          onChange={updateEditForm}
          onImageChange={setEditImage}
          onRemoveImage={() => {
            setIsEditImageRemoved(true);
            setEditImage(null);
          }}
          onClose={closeEditModal}
          onSave={saveEditedProduct}
        />
      ) : null}

      {pendingLotDeletion ? (
        <DeleteExpiredLotModal
          lot={pendingLotDeletion}
          message={deleteLotMessage}
          isDeleting={isDeletingLot}
          onClose={() => {
            if (!isDeletingLot) {
              setPendingLotDeletion(null);
              setDeleteLotMessage("");
            }
          }}
          onConfirm={deleteExpiredLot}
        />
      ) : null}
    </main>
  );
}

type ExpiringProductsTableProps = {
  products: ExpiringProduct[];
  isLoading: boolean;
  error: string;
  chileToday: string | null;
  timeError: string;
  openProductId: string | null;
  onToggleProduct: (productId: string) => void;
  onRequestDeleteLot: (lot: PendingLotDeletion) => void;
};

function ExpiringProductsTable({
  products,
  isLoading,
  error,
  chileToday,
  timeError,
  openProductId,
  onToggleProduct,
  onRequestDeleteLot,
}: ExpiringProductsTableProps) {
  if (isLoading) {
    return <p className="product-empty">Cargando productos por vencer...</p>;
  }

  if (error) {
    return <p className="product-error">{error}</p>;
  }

  return (
    <div className="product-table-wrap">
      {timeError ? <p className="product-error">{timeError}</p> : null}
      <table className="product-table expiring-products-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Stock total</th>
          </tr>
        </thead>
        <tbody>
          {products.map((producto) => {
            const imageUrl = producto.urlImagen || "/generic-product.svg";
            const isOpen = openProductId === producto.id;
            const hasCloseLot = producto.lotes.some((lote) =>
              isCloseToExpiration(lote.fecha_vencimiento, chileToday),
            );

            return (
              <Fragment key={producto.id}>
                <tr
                  className={isOpen ? "is-selected" : ""}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleProduct(producto.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggleProduct(producto.id);
                    }
                  }}
                >
                  <td>
                    <div className="product-name-cell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={producto.nombre} />
                      <div>
                        <strong className="product-name-title">
                          {producto.nombre}
                          {hasCloseLot ? (
                            <span
                              className="expiration-alert-icon"
                              aria-label="Producto próximo a vencer"
                              title="Producto próximo a vencer"
                            >
                              !
                            </span>
                          ) : null}
                        </strong>
                        <span>Marca: {producto.marca.nombre}</span>
                        <span>{getProductContentLabel(producto)}</span>
                        <span>Tipo de venta: {producto.unidad.unidad}</span>
                        <span>Categoria: {producto.categoria.nombreCategoria}</span>
                        <span>
                          Tipo de empaque:{" "}
                          {producto.empaque_productos_empaqueToempaque
                            ?.nombre_empaque ?? "Sin empaque"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{producto.stock}</td>
                </tr>
                {isOpen ? (
                  <tr className="expiring-lots-row">
                    <td colSpan={2}>
                      <div className="expiring-lots-list">
                        {producto.lotes.length > 0 ? (
                          producto.lotes.map((lote, index) => {
                            const isCloseLot = isCloseToExpiration(
                              lote.fecha_vencimiento,
                              chileToday,
                            );
                            const canDeleteLot = isExpiredOrToday(
                              lote.fecha_vencimiento,
                              chileToday,
                            );
                            const daysRemaining = getExpirationDiffDays(
                              lote.fecha_vencimiento,
                              chileToday,
                            );

                            return (
                              <div
                                className="expiring-lot-item"
                                key={`${producto.id}-${lote.fecha_vencimiento}`}
                              >
                                <strong className="product-name-title">
                                  Lote {index + 1}
                                  {isCloseLot ? (
                                    <span
                                      className="expiration-alert-icon"
                                      aria-label="Lote próximo a vencer"
                                      title="Lote próximo a vencer"
                                    >
                                      !
                                    </span>
                                  ) : null}
                                </strong>
                                <span>Cantidad {lote.cantidad}</span>
                                <span>
                                  Vencen en{" "}
                                  {new Date(lote.fecha_vencimiento).toLocaleDateString(
                                    "es-CL",
                                    { timeZone: "UTC" },
                                  )}
                                  {daysRemaining !== null ? (
                                    <span>
                                      {" · "}
                                      {daysRemaining > 0
                                        ? `Le quedan ${daysRemaining} días`
                                        : daysRemaining === 0
                                          ? "Vence hoy"
                                          : `Vencido hace ${Math.abs(daysRemaining)} días`}
                                    </span>
                                  ) : null}
                                </span>
                                {canDeleteLot ? (
                                  <button
                                    className="expired-lot-delete-button"
                                    type="button"
                                    aria-label={`Eliminar lote ${index + 1}`}
                                    title="Eliminar lote vencido"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRequestDeleteLot({
                                        productId: producto.id,
                                        productName: producto.nombre,
                                        expirationDate: lote.fecha_vencimiento,
                                        quantity: lote.cantidad,
                                      });
                                    }}
                                  >
                                    x
                                  </button>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p className="product-empty">
                            Sin instancias registradas para este producto.
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {products.length === 0 ? (
            <tr>
              <td colSpan={2}>Sin productos con stock para mostrar.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

type DeleteExpiredLotModalProps = {
  lot: PendingLotDeletion;
  message: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteExpiredLotModal({
  lot,
  message,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteExpiredLotModalProps) {
  return (
    <div className="stock-modal-layer" role="presentation">
      <button
        className="stock-modal-backdrop"
        type="button"
        aria-label="Cerrar confirmación"
        onClick={onClose}
        disabled={isDeleting}
      />

      <section
        className="stock-modal delete-expired-lot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-expired-lot-title"
      >
        <h2 id="delete-expired-lot-title">Eliminar lote vencido</h2>
        <p>
          ¿Estas seguro de eliminar este lote de {lot.productName}? Se eliminaran{" "}
          {lot.quantity} producto{lot.quantity === 1 ? "" : "s"} del lote y se
          descontaran del stock.
        </p>
        <p className="delete-expired-lot-date">
          Fecha de vencimiento:{" "}
          {new Date(lot.expirationDate).toLocaleDateString("es-CL")}
        </p>
        {message ? <p className="stock-modal-message">{message}</p> : null}
        <div className="stock-modal-actions">
          <button type="button" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Eliminando..." : "Eliminar lote"}
          </button>
        </div>
      </section>
    </div>
  );
}

type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
};

function SearchableSelect({
  value,
  placeholder,
  searchPlaceholder,
  options,
  onChange,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase("es-CL").includes(
      query.trim().toLocaleLowerCase("es-CL"),
    ),
  );

  return (
    <div
      className="searchable-select"
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (
          nextFocusedElement instanceof Node &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return;
        }

        setIsOpen(false);
      }}
    >
      <button
        type="button"
        className="searchable-select-control"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
          setQuery("");
        }}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true">v</span>
      </button>

      {isOpen ? (
        <div className="searchable-select-menu">
          <input
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              if (isSafeAppInput(event.target.value)) {
                setQuery(event.target.value);
              }
            }}
            onMouseDown={(event) => event.stopPropagation()}
          />
          <div className="searchable-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={option.value === value ? "is-selected" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setQuery("");
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p>Sin opciones</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ProductCreatePanelProps = {
  form: CreateProductForm;
  options: ProductOptions;
  message: string;
  messageType: "error" | "success";
  submitted: boolean;
  image: File | null;
  isCreating: boolean;
  onChange: (field: keyof CreateProductForm, value: string) => void;
  onImageChange: (value: File | null) => void;
  onSubmit: () => void;
};

function ProductCreatePanel({
  form,
  options,
  message,
  messageType,
  submitted,
  image,
  isCreating,
  onChange,
  onImageChange,
  onSubmit,
}: ProductCreatePanelProps) {
  const selectedUnit = options.unidades.find((unit) => unit.id === form.unidadId);
  const selectedMeasure = options.unidadesMedida.find(
    (measure) => measure.id === form.unidadMedidaId,
  );
  const needsMeasure = selectedUnit?.unidad?.toLowerCase() === "por unidad";
  const usesNewBrand = form.marcaId === "new";
  const usesNewCategory = form.categoriaId === "new";
  const usesNewPackaging = form.empaqueId === "new";
  const isMissing = (field: keyof CreateProductForm) => {
    if (!submitted) {
      return false;
    }

    if (field === "marcaNombre") {
      return usesNewBrand && !form.marcaNombre.trim();
    }

    if (field === "categoriaNombre") {
      return usesNewCategory && !form.categoriaNombre.trim();
    }

    if (field === "empaqueNombre") {
      return usesNewPackaging && !form.empaqueNombre.trim();
    }

    if (field === "contenido") {
      return needsMeasure && !isPositiveIntegerText(form.contenido);
    }

    if (field === "unidadMedidaId") {
      return needsMeasure && !form.unidadMedidaId;
    }

    if (field === "precioVenta" || field === "costo") {
      return !isPositiveIntegerText(form[field]);
    }

    return !form[field].trim();
  };

  return (
    <aside className="product-create-panel">
      <div className="product-create-header">
        <h2>Agregar producto</h2>
      </div>

      <div className="product-create-form">
        <label className={isMissing("nombre") ? "is-invalid" : ""}>
          Nombre del producto <span className="required-mark">*</span>
          <input
            type="text"
            value={form.nombre}
            onChange={(event) => onChange("nombre", event.target.value)}
          />
        </label>

        <label>
          Descripcion
          <textarea
            value={form.descripcion}
            onChange={(event) => onChange("descripcion", event.target.value)}
          />
        </label>

        <label className={isMissing("marcaId") ? "is-invalid" : ""}>
          Marca <span className="required-mark">*</span>
          <SearchableSelect
            value={form.marcaId}
            placeholder="Selecciona una marca"
            searchPlaceholder="Buscar marca"
            options={[
              ...options.marcas.map((marca) => ({
                value: marca.id,
                label: marca.nombre ?? "",
              })),
              { value: "new", label: "Agregar marca" },
            ]}
            onChange={(nextValue) => onChange("marcaId", nextValue)}
          />
        </label>

        {usesNewBrand ? (
          <label className={isMissing("marcaNombre") ? "is-invalid" : ""}>
            Nombre de marca <span className="required-mark">*</span>
            <input
              type="text"
              value={form.marcaNombre}
              onChange={(event) => onChange("marcaNombre", event.target.value)}
            />
          </label>
        ) : null}

        <label>
          Codigo de barra
          <input
            type="text"
            value={form.codigoBarra}
            onChange={(event) => onChange("codigoBarra", event.target.value)}
          />
        </label>

        <label>
          Imagen del producto
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              onImageChange(event.target.files?.item(0) ?? null)
            }
          />
          {image ? <span className="product-image-name">{image.name}</span> : null}
        </label>

        <label className={isMissing("categoriaId") ? "is-invalid" : ""}>
          Categoria <span className="required-mark">*</span>
          <SearchableSelect
            value={form.categoriaId}
            placeholder="Selecciona una categoria"
            searchPlaceholder="Buscar categoria"
            options={[
              ...options.categorias.map((categoria) => ({
                value: categoria.id,
                label: categoria.nombreCategoria ?? "",
              })),
              { value: "new", label: "Agregar categoria" },
            ]}
            onChange={(nextValue) => onChange("categoriaId", nextValue)}
          />
        </label>

        {usesNewCategory ? (
          <label className={isMissing("categoriaNombre") ? "is-invalid" : ""}>
            Nombre de categoria <span className="required-mark">*</span>
            <input
              type="text"
              value={form.categoriaNombre}
              onChange={(event) => onChange("categoriaNombre", event.target.value)}
            />
          </label>
        ) : null}

        <label className={isMissing("empaqueId") ? "is-invalid" : ""}>
          Tipo de empaque <span className="required-mark">*</span>
          <SearchableSelect
            value={form.empaqueId}
            placeholder="Selecciona un empaque"
            searchPlaceholder="Buscar empaque"
            options={[
              ...options.empaques.map((empaque) => ({
                value: empaque.id_empaque ?? empaque.id,
                label: empaque.nombre_empaque ?? "",
              })),
              { value: "new", label: "Agregar empaque" },
            ]}
            onChange={(nextValue) => onChange("empaqueId", nextValue)}
          />
        </label>

        {usesNewPackaging ? (
          <label className={isMissing("empaqueNombre") ? "is-invalid" : ""}>
            Nombre de empaque <span className="required-mark">*</span>
            <input
              type="text"
              value={form.empaqueNombre}
              onChange={(event) => onChange("empaqueNombre", event.target.value)}
            />
          </label>
        ) : null}

        <label>
          Proveedor
          <SearchableSelect
            value={form.proveedorId}
            placeholder="Sin proveedor"
            searchPlaceholder="Buscar proveedor"
            options={[
              { value: "", label: "Sin proveedor" },
              ...options.proveedores.map((proveedor) => ({
                value: proveedor.id_proveedor ?? proveedor.id,
                label: proveedor.nombre ?? "",
              })),
            ]}
            onChange={(nextValue) => onChange("proveedorId", nextValue)}
          />
        </label>

        <label className={isMissing("unidadId") ? "is-invalid" : ""}>
          Como se vende? <span className="required-mark">*</span>
          <SearchableSelect
            value={form.unidadId}
            placeholder="Selecciona una opcion"
            searchPlaceholder="Buscar opcion"
            options={options.unidades.map((unidad) => ({
              value: unidad.id,
              label: unidad.unidad ?? "",
            }))}
            onChange={(nextValue) => onChange("unidadId", nextValue)}
          />
        </label>

        {needsMeasure ? (
          <>
            <label className={isMissing("unidadMedidaId") ? "is-invalid" : ""}>
              Unidad de medida <span className="required-mark">*</span>
              <SearchableSelect
                value={form.unidadMedidaId}
                placeholder="Selecciona una unidad"
                searchPlaceholder="Buscar unidad"
                options={options.unidadesMedida.map((unidadMedida) => ({
                  value: unidadMedida.id,
                  label: unidadMedida.nombre ?? "",
                }))}
                onChange={(nextValue) => onChange("unidadMedidaId", nextValue)}
              />
            </label>

            <label className={isMissing("contenido") ? "is-invalid" : ""}>
              Contenido <span className="required-mark">*</span>
              <div className="content-input-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[1-9][0-9]*"
                  value={form.contenido}
                  onChange={(event) => onChange("contenido", event.target.value)}
                />
                <span>{selectedMeasure?.nombre ?? ""}</span>
              </div>
            </label>

            <p className="product-create-hint">
              Por eje: 100 ml de leche, 1kg de azucar, 1 unidad de berlin.
            </p>
          </>
        ) : null}

        <div className="product-create-prices">
          <label className={isMissing("precioVenta") ? "is-invalid" : ""}>
            Precio de venta <span className="required-mark">*</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              value={form.precioVenta}
              onChange={(event) => onChange("precioVenta", event.target.value)}
            />
          </label>
          <label className={isMissing("costo") ? "is-invalid" : ""}>
            Costo <span className="required-mark">*</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              value={form.costo}
              onChange={(event) => onChange("costo", event.target.value)}
            />
          </label>
        </div>

        {message ? (
          <p className={`product-create-message is-${messageType}`}>{message}</p>
        ) : null}

        <button
          className="product-create-submit"
          type="button"
          disabled={isCreating}
          onClick={onSubmit}
        >
          {isCreating ? "Guardando..." : "Guardar producto"}
        </button>
      </div>
    </aside>
  );
}

type ProductEditModalProps = {
  product: Producto;
  form: EditProductForm;
  options: ProductOptions;
  image: File | null;
  isImageRemoved: boolean;
  submitted: boolean;
  message: string;
  isSaving: boolean;
  onChange: (field: keyof EditProductForm, value: string) => void;
  onImageChange: (value: File | null) => void;
  onRemoveImage: () => void;
  onClose: () => void;
  onSave: () => void;
};

function ProductEditModal({
  product,
  form,
  options,
  image,
  isImageRemoved,
  submitted,
  message,
  isSaving,
  onChange,
  onImageChange,
  onRemoveImage,
  onClose,
  onSave,
}: ProductEditModalProps) {
  const selectedUnit = options.unidades.find((unit) => unit.id === form.unidadId);
  const selectedMeasure = options.unidadesMedida.find(
    (measure) => measure.id === form.unidadMedidaId,
  );
  const needsMeasure = selectedUnit?.unidad?.toLowerCase() === "por unidad";
  const previewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image],
  );
  const visibleImage = image
    ? previewUrl
    : isImageRemoved
      ? null
      : product.urlImagen;
  const isMissing = (field: keyof EditProductForm) => {
    if (!submitted) {
      return false;
    }

    if (field === "contenido") {
      return needsMeasure && !isPositiveIntegerText(form.contenido);
    }

    if (field === "unidadMedidaId") {
      return needsMeasure && !form.unidadMedidaId;
    }

    return !form[field].trim();
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="stock-modal-layer" role="presentation">
      <button
        className="stock-modal-backdrop"
        type="button"
        aria-label="Cerrar modal"
        onClick={onClose}
      />
      <section className="product-edit-modal" role="dialog" aria-modal="true">
        <h2>Editar producto</h2>

        <div className="product-create-form">
          <label className={isMissing("nombre") ? "is-invalid" : ""}>
            Nombre del producto <span className="required-mark">*</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(event) => onChange("nombre", event.target.value)}
            />
          </label>

          <label>
            Descripcion
            <textarea
              value={form.descripcion}
              onChange={(event) => onChange("descripcion", event.target.value)}
            />
          </label>

          <label className={isMissing("marcaId") ? "is-invalid" : ""}>
            Marca <span className="required-mark">*</span>
            <SearchableSelect
              value={form.marcaId}
              placeholder="Selecciona una marca"
              searchPlaceholder="Buscar marca"
              options={options.marcas.map((marca) => ({
                value: marca.id,
                label: marca.nombre ?? "",
              }))}
              onChange={(nextValue) => onChange("marcaId", nextValue)}
            />
          </label>

          <label>
            Codigo de barra
            <input
              type="text"
              value={form.codigoBarra}
              onChange={(event) => onChange("codigoBarra", event.target.value)}
            />
          </label>

          <div className="product-edit-image-field">
            <span>Imagen del producto</span>
            {visibleImage ? (
              <div className="product-edit-image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visibleImage} alt={form.nombre || product.nombre} />
                <button type="button" onClick={onRemoveImage}>
                  Eliminar
                </button>
              </div>
            ) : (
              <label>
                Subir imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    onImageChange(event.target.files?.item(0) ?? null)
                  }
                />
                {image ? (
                  <span className="product-image-name">{image.name}</span>
                ) : null}
              </label>
            )}
          </div>

          <label className={isMissing("categoriaId") ? "is-invalid" : ""}>
            Categoria <span className="required-mark">*</span>
            <SearchableSelect
              value={form.categoriaId}
              placeholder="Selecciona una categoria"
              searchPlaceholder="Buscar categoria"
              options={options.categorias.map((categoria) => ({
                value: categoria.id,
                label: categoria.nombreCategoria ?? "",
              }))}
              onChange={(nextValue) => onChange("categoriaId", nextValue)}
            />
          </label>

          <label className={isMissing("empaqueId") ? "is-invalid" : ""}>
            Tipo de empaque <span className="required-mark">*</span>
            <SearchableSelect
              value={form.empaqueId}
              placeholder="Selecciona un empaque"
              searchPlaceholder="Buscar empaque"
              options={options.empaques.map((empaque) => ({
                value: empaque.id_empaque ?? empaque.id,
                label: empaque.nombre_empaque ?? "",
              }))}
              onChange={(nextValue) => onChange("empaqueId", nextValue)}
            />
          </label>

          <label>
            Proveedor
            <SearchableSelect
              value={form.proveedorId}
              placeholder="Sin proveedor"
              searchPlaceholder="Buscar proveedor"
              options={[
                { value: "", label: "Sin proveedor" },
                ...options.proveedores.map((proveedor) => ({
                  value: proveedor.id_proveedor ?? proveedor.id,
                  label: proveedor.nombre ?? "",
                })),
              ]}
              onChange={(nextValue) => onChange("proveedorId", nextValue)}
            />
          </label>

          <label className={isMissing("unidadId") ? "is-invalid" : ""}>
            Como se vende? <span className="required-mark">*</span>
            <SearchableSelect
              value={form.unidadId}
              placeholder="Selecciona una opcion"
              searchPlaceholder="Buscar opcion"
              options={options.unidades.map((unidad) => ({
                value: unidad.id,
                label: unidad.unidad ?? "",
              }))}
              onChange={(nextValue) => onChange("unidadId", nextValue)}
            />
          </label>

          {needsMeasure ? (
            <>
              <label className={isMissing("unidadMedidaId") ? "is-invalid" : ""}>
                Unidad de medida <span className="required-mark">*</span>
                <SearchableSelect
                  value={form.unidadMedidaId}
                  placeholder="Selecciona una unidad"
                  searchPlaceholder="Buscar unidad"
                  options={options.unidadesMedida.map((unidadMedida) => ({
                    value: unidadMedida.id,
                    label: unidadMedida.nombre ?? "",
                  }))}
                  onChange={(nextValue) => onChange("unidadMedidaId", nextValue)}
                />
              </label>

              <label className={isMissing("contenido") ? "is-invalid" : ""}>
                Contenido <span className="required-mark">*</span>
                <div className="content-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[1-9][0-9]*"
                    value={form.contenido}
                    onChange={(event) => onChange("contenido", event.target.value)}
                  />
                  <span>{selectedMeasure?.nombre ?? ""}</span>
                </div>
              </label>
            </>
          ) : null}

          {message ? <p className="product-create-message is-error">{message}</p> : null}

          <div className="stock-modal-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" disabled={isSaving} onClick={onSave}>
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </section>
    </div>
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
  onEdit: (product: Producto) => void;
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
  onEdit,
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
    if (!isSafeAppInput(value) || !/^\d*$/.test(value)) {
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
          <div className="product-detail-title-row">
            <h2>{product.nombre}</h2>
            <button
              className="product-edit-button"
              type="button"
              aria-label="Editar producto"
              title="Editar producto"
              onClick={() => onEdit(product)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          </div>
          <p>{product.descripcion || "Sin descripcion"}</p>
          <span>Marca: {product.marca.nombre}</span>
          <span>Categoria: {product.categoria.nombreCategoria}</span>
          <span>
            Tipo de empaque:{" "}
            {product.empaque_productos_empaqueToempaque?.nombre_empaque ??
              "Sin empaque"}
          </span>
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
  chileToday: string | null;
  timeError: string;
  modal: StockModal;
  quantity: string;
  expirationDate: string;
  comment: string;
  message: string;
  isSaving: boolean;
  movements: StockMovement[];
  isLoadingMovements: boolean;
  selectedComment: string | null;
  showExpirationConfirm: boolean;
  onQuantityChange: (value: string) => void;
  onExpirationDateChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirmAdd: () => void;
  onBackFromExpirationConfirm: () => void;
  onAcceptExpirationConfirm: () => void;
  onConfirmWaste: () => void;
  onShowComment: (value: string | null) => void;
};

function StockModalView({
  product,
  chileToday,
  timeError,
  modal,
  quantity,
  expirationDate,
  comment,
  message,
  isSaving,
  movements,
  isLoadingMovements,
  selectedComment,
  showExpirationConfirm,
  onQuantityChange,
  onExpirationDateChange,
  onCommentChange,
  onClose,
  onConfirmAdd,
  onBackFromExpirationConfirm,
  onAcceptExpirationConfirm,
  onConfirmWaste,
  onShowComment,
}: StockModalViewProps) {
  if (!modal) {
    return null;
  }

  const parsedQuantity = isPositiveIntegerText(quantity) ? Number(quantity) : 0;
  const addedStock = product.stock + parsedQuantity;
  const remainingStock = product.stock - parsedQuantity;
  const canConfirmAdd =
    parsedQuantity > 0 && isFutureExpirationDate(expirationDate, chileToday) && !isSaving;
  const canConfirmWaste = parsedQuantity > 0 && remainingStock >= 0 && !isSaving;
  const expirationSummary = getExpirationSummary(expirationDate, chileToday);
  const minExpirationDate = getTomorrowDateInputValue(chileToday);
  const hasInvalidExpirationDate =
    Boolean(expirationDate) && !isFutureExpirationDate(expirationDate, chileToday);

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
        <button
          className="stock-modal-close-button"
          type="button"
          aria-label="Cerrar modal"
          onClick={onClose}
        >
          x
        </button>
        {modal === "add" ? (
          <>
            <h2>Agregar stock de {product.nombre}</h2>
            <p className="stock-lot-alert">
              se asume que la cantidad ingresada es un lote y comparte fecha de
              vencimiento
            </p>
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
              Fecha de vencimiento
              <span
                className={`date-input-wrap${expirationDate ? " has-value" : ""}`}
              >
                {!expirationDate ? (
                  <span className="date-placeholder">Ej: 31-12-2026</span>
                ) : null}
                <input
                  type="date"
                  min={minExpirationDate}
                  value={expirationDate}
                  onChange={(event) => onExpirationDateChange(event.target.value)}
                  disabled={!chileToday}
                />
              </span>
              {timeError ? <span className="date-error">{timeError}</span> : null}
              {hasInvalidExpirationDate ? (
                <span className="date-error">
                  Debe ser una fecha posterior a hoy.
                </span>
              ) : null}
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
                      <th>Motivo</th>
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
                    {movements.map((movement) => {
                      const reason = getMovementReason(movement.tipo);
                      const quantity = getMovementQuantity(movement);

                      return (
                        <tr key={movement.id}>
                          <td>
                            <span
                              className="movement-reason-icon"
                              aria-label={reason.label}
                              title={reason.label}
                            >
                              {reason.icon}
                            </span>
                          </td>
                          <td>
                            {new Date(movement.fecha).toLocaleString("es-CL", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </td>
                          <td>${movement.costo_sin_iva.toLocaleString("es-CL")}</td>
                          <td>${movement.costo_con_iva.toLocaleString("es-CL")}</td>
                          <td className={quantity < 0 ? "is-negative" : ""}>
                            {quantity}
                          </td>
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
                      );
                    })}
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={8}>Sin movimientos registrados.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
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

        {showExpirationConfirm && modal === "add" ? (
          <div className="comment-modal-layer" role="presentation">
            <button
              className="stock-modal-backdrop"
              type="button"
              aria-label="Volver"
              onClick={onBackFromExpirationConfirm}
            />
            <section className="comment-modal" role="dialog" aria-modal="true">
              <h3>El producto vencerá en:</h3>
              <p>{expirationSummary}</p>
              <div className="stock-modal-actions">
                <button type="button" onClick={onBackFromExpirationConfirm}>
                  Volver
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onAcceptExpirationConfirm}
                >
                  {isSaving ? "Guardando..." : "OK"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
