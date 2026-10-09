"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../components/Navbar";
import { isSafeAppInput } from "@/lib/input-validation";

type ProviderProduct = {
  id: string;
  nombre: string;
  stock: number;
  costoConIva: number;
  contenido: number | null;
  nombreEmpaque: string | null;
  unidadMedida: string | null;
};

type CatalogProduct = ProviderProduct & {
  id_proveedor: string | null;
};

type Provider = {
  id_proveedor: string;
  nombre: string;
  nombre_vendedor: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  url_imagen: string | null;
  productos: ProviderProduct[];
};

type ProviderForm = {
  nombre: string;
  telefono: string;
  correo_contacto: string;
  nombre_vendedor: string;
};

type FieldIconName = "provider" | "phone" | "email" | "seller";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyProviderForm: ProviderForm = {
  nombre: "",
  telefono: "",
  correo_contacto: "",
  nombre_vendedor: "",
};

function buildProviderForm(provider: Provider): ProviderForm {
  return {
    nombre: provider.nombre,
    telefono: provider.telefono ?? "",
    correo_contacto: provider.correo_contacto ?? "",
    nombre_vendedor: provider.nombre_vendedor ?? "",
  };
}

function FieldIcon({ name }: { name: FieldIconName }) {
  if (name === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 3a15 15 0 0 1-8-8l3-2z" />
      </svg>
    );
  }

  if (name === "email") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18v14H3z" />
        <path d="m3 6 9 7 9-7" />
      </svg>
    );
  }

  if (name === "seller") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16" />
      <path d="M5 10l1-5h12l1 5" />
      <path d="M6 10v9h12v-9" />
      <path d="M9 19v-5h6v5" />
    </svg>
  );
}

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ProviderForm>(emptyProviderForm);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [createSubmitted, setCreateSubmitted] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [providerImage, setProviderImage] = useState<File | null>(null);
  const [isProviderImageRemoved, setIsProviderImageRemoved] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState(false);
  const [managedProductIds, setManagedProductIds] = useState<string[]>([]);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [productManagerMessage, setProductManagerMessage] = useState("");
  const [isSavingProducts, setIsSavingProducts] = useState(false);

  useEffect(() => {
    async function loadProviders() {
      const token = localStorage.getItem("jwt");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch("/api/proveedores", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          status?: "ok" | "error";
          message?: string;
          proveedores?: Provider[];
          productos?: CatalogProduct[];
        };

        if (!response.ok || data.status !== "ok") {
          if (response.status === 401) {
            localStorage.removeItem("jwt");
            router.replace("/login");
            return;
          }

          setError(data.message ?? "No se pudieron cargar los proveedores.");
          return;
        }

        setProviders(data.proveedores ?? []);
        setCatalogProducts(data.productos ?? []);
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProviders();
  }, [router]);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-CL");

    if (!query) {
      return providers;
    }

    return providers.filter((provider) =>
      provider.nombre.toLocaleLowerCase("es-CL").includes(query),
    );
  }, [providers, search]);

  const selectedProvider = useMemo(
    () =>
      providers.find((provider) => provider.id_proveedor === selectedProviderId) ??
      null,
    [providers, selectedProviderId],
  );
  const createImagePreview = useMemo(
    () => (createImage ? URL.createObjectURL(createImage) : null),
    [createImage],
  );
  const providerImagePreview = useMemo(
    () => (providerImage ? URL.createObjectURL(providerImage) : null),
    [providerImage],
  );
  const managedProducts = useMemo(() => {
    const managedSet = new Set(managedProductIds);

    return {
      assigned: catalogProducts.filter((product) => managedSet.has(product.id)),
      available: catalogProducts.filter((product) => !managedSet.has(product.id)),
    };
  }, [catalogProducts, managedProductIds]);

  useEffect(() => {
    return () => {
      if (createImagePreview) {
        URL.revokeObjectURL(createImagePreview);
      }
    };
  }, [createImagePreview]);

  useEffect(() => {
    return () => {
      if (providerImagePreview) {
        URL.revokeObjectURL(providerImagePreview);
      }
    };
  }, [providerImagePreview]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  function selectProvider(provider: Provider) {
    setSelectedProviderId(provider.id_proveedor);
    setOpenProviderId((current) =>
      current === provider.id_proveedor ? null : provider.id_proveedor,
    );
    setForm(buildProviderForm(provider));
    setSubmitted(false);
    setMessage("");
  }

  function updateForm(field: keyof ProviderForm, value: string) {
    if (!isSafeAppInput(value)) {
      return;
    }

    setForm((current) => (current ? { ...current, [field]: value } : current));
    setMessage("");
  }

  function openCreateProviderModal() {
    setCreateForm(emptyProviderForm);
    setCreateImage(null);
    setCreateSubmitted(false);
    setCreateMessage("");
    setIsCreateModalOpen(true);
  }

  function closeCreateProviderModal() {
    if (isCreating) {
      return;
    }

    setIsCreateModalOpen(false);
    setCreateForm(emptyProviderForm);
    setCreateImage(null);
    setCreateSubmitted(false);
    setCreateMessage("");
  }

  function updateCreateForm(field: keyof ProviderForm, value: string) {
    if (!isSafeAppInput(value)) {
      return;
    }

    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateMessage("");
  }

  async function createProvider() {
    const email = createForm.correo_contacto.trim();
    setCreateSubmitted(true);

    if (!createForm.nombre.trim()) {
      setCreateMessage("El nombre del proveedor es obligatorio.");
      return;
    }

    if (email && !emailPattern.test(email)) {
      setCreateMessage("Ingresa un correo con formato valido.");
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsCreating(true);
    setCreateMessage("");

    try {
      const formData = new FormData();
      formData.append("nombre", createForm.nombre.trim());
      formData.append("telefono", createForm.telefono.trim());
      formData.append("correo_contacto", email);
      formData.append("nombre_vendedor", createForm.nombre_vendedor.trim());
      if (createImage) {
        formData.append("imagen", createImage);
      }

      const response = await fetch("/api/proveedores", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        proveedor?: Provider;
      };

      if (!response.ok || data.status !== "ok" || !data.proveedor) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setCreateMessage(data.message ?? "No se pudo crear el proveedor.");
        return;
      }

      setProviders((current) =>
        [...current, data.proveedor as Provider].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es-CL"),
        ),
      );
      setSelectedProviderId(data.proveedor.id_proveedor);
      setOpenProviderId(data.proveedor.id_proveedor);
      setForm(buildProviderForm(data.proveedor));
      setIsCreateModalOpen(false);
      setCreateForm(emptyProviderForm);
      setCreateImage(null);
      setCreateSubmitted(false);
      setCreateMessage("");
    } catch {
      setCreateMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsCreating(false);
    }
  }

  function openProviderImageModal() {
    setProviderImage(null);
    setIsProviderImageRemoved(false);
    setImageMessage("");
    setIsImageModalOpen(true);
  }

  function closeProviderImageModal() {
    if (isSavingImage) {
      return;
    }

    setIsImageModalOpen(false);
    setProviderImage(null);
    setIsProviderImageRemoved(false);
    setImageMessage("");
  }

  async function saveProviderImage() {
    if (!selectedProvider) {
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSavingImage(true);
    setImageMessage("");

    try {
      const formData = new FormData();
      formData.append("id_proveedor", selectedProvider.id_proveedor);
      formData.append("removeImage", String(isProviderImageRemoved));
      if (providerImage) {
        formData.append("imagen", providerImage);
      }

      const response = await fetch("/api/proveedores/imagen", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        url_imagen?: string | null;
      };

      if (!response.ok || data.status !== "ok") {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setImageMessage(data.message ?? "No se pudo actualizar la imagen.");
        return;
      }

      setProviders((current) =>
        current.map((provider) =>
          provider.id_proveedor === selectedProvider.id_proveedor
            ? { ...provider, url_imagen: data.url_imagen ?? null }
            : provider,
        ),
      );
      setIsImageModalOpen(false);
      setProviderImage(null);
      setIsProviderImageRemoved(false);
      setImageMessage("");
    } catch {
      setImageMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingImage(false);
    }
  }

  function openProductManager(provider: Provider) {
    setSelectedProviderId(provider.id_proveedor);
    setForm(buildProviderForm(provider));
    setManagedProductIds(
      catalogProducts
        .filter((product) => product.id_proveedor === provider.id_proveedor)
        .map((product) => product.id),
    );
    setDraggedProductId(null);
    setProductManagerMessage("");
    setIsProductManagerOpen(true);
  }

  function moveManagedProduct(productId: string, target: "assigned" | "available") {
    setManagedProductIds((current) => {
      if (target === "assigned") {
        return current.includes(productId) ? current : [...current, productId];
      }

      return current.filter((currentId) => currentId !== productId);
    });
    setProductManagerMessage("");
  }

  function dropManagedProduct(target: "assigned" | "available") {
    if (!draggedProductId) {
      return;
    }

    moveManagedProduct(draggedProductId, target);
    setDraggedProductId(null);
  }

  async function saveManagedProducts() {
    if (!selectedProvider) {
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSavingProducts(true);
    setProductManagerMessage("");

    try {
      const response = await fetch("/api/proveedores", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_proveedor: selectedProvider.id_proveedor,
          productos_asignados: managedProductIds,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setProductManagerMessage(
          data.message ?? "No se pudieron actualizar los productos.",
        );
        return;
      }

      const assignedSet = new Set(managedProductIds);
      const nextCatalog = catalogProducts.map((product) => {
        if (assignedSet.has(product.id)) {
          return { ...product, id_proveedor: selectedProvider.id_proveedor };
        }

        if (product.id_proveedor === selectedProvider.id_proveedor) {
          return { ...product, id_proveedor: null };
        }

        return product;
      });
      setCatalogProducts(nextCatalog);
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          productos: nextCatalog
            .filter((product) => product.id_proveedor === provider.id_proveedor)
            .map(
              ({
                id,
                nombre,
                stock,
                costoConIva,
                contenido,
                nombreEmpaque,
                unidadMedida,
              }) => ({
              id,
              nombre,
              stock,
              costoConIva,
                contenido,
                nombreEmpaque,
                unidadMedida,
              }),
            ),
        })),
      );
      setIsProductManagerOpen(false);
    } catch {
      setProductManagerMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingProducts(false);
    }
  }

  async function saveProvider() {
    if (!selectedProvider || !form) {
      return;
    }

    const email = form.correo_contacto.trim();
    setSubmitted(true);

    if (!form.nombre.trim()) {
      setMessage("El nombre del proveedor es obligatorio.");
      return;
    }

    if (email && !emailPattern.test(email)) {
      setMessage("Ingresa un correo con formato valido.");
      return;
    }

    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/proveedores", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_proveedor: selectedProvider.id_proveedor,
          ...form,
        }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
        proveedor?: Omit<Provider, "productos">;
      };

      if (!response.ok || data.status !== "ok" || !data.proveedor) {
        if (response.status === 401) {
          localStorage.removeItem("jwt");
          router.replace("/login");
          return;
        }

        setMessage(data.message ?? "No se pudo actualizar el proveedor.");
        return;
      }

      const updatedProvider: Provider = {
        ...data.proveedor,
        productos: selectedProvider.productos,
      };
      setProviders((current) =>
        current
          .map((provider) =>
            provider.id_proveedor === updatedProvider.id_proveedor
              ? updatedProvider
              : provider,
          )
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CL")),
      );
      setForm(buildProviderForm(updatedProvider));
      setSubmitted(false);
      setMessage("Proveedor actualizado correctamente.");
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSaving(false);
    }
  }

  const emailIsInvalid =
    Boolean(form?.correo_contacto.trim()) &&
    !emailPattern.test(form?.correo_contacto.trim() ?? "");
  const createEmailIsInvalid =
    Boolean(createForm.correo_contacto.trim()) &&
    !emailPattern.test(createForm.correo_contacto.trim());
  const visibleProviderImage = providerImagePreview
    ? providerImagePreview
    : isProviderImageRemoved
      ? null
      : selectedProvider?.url_imagen;

  return (
    <main className="provider-view-shell">
      <Navbar onLogout={handleLogout} />

      <section className="provider-view-layout">
        <section className="provider-list-panel">
          <div className="provider-list-heading">
            <div>
              <span>Directorio</span>
              <h1>Proveedores</h1>
            </div>
            <div className="provider-heading-actions">
              <strong>{providers.length}</strong>
              <button
                type="button"
                aria-label="Agregar proveedor"
                title="Agregar proveedor"
                onClick={openCreateProviderModal}
              >
                +
              </button>
            </div>
          </div>

          <input
            className="product-search"
            type="search"
            placeholder="Buscar proveedor"
            value={search}
            onChange={(event) => {
              if (isSafeAppInput(event.target.value)) {
                setSearch(event.target.value);
              }
            }}
          />

          {isLoading ? <p className="product-empty">Cargando proveedores...</p> : null}
          {error ? <p className="product-error">{error}</p> : null}

          {!isLoading && !error ? (
            <div className="provider-table-wrap">
              <table className="provider-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map((provider) => {
                    const isOpen = openProviderId === provider.id_proveedor;
                    const imageUrl = provider.url_imagen || "/generic-provider.svg";

                    return (
                      <Fragment key={provider.id_proveedor}>
                        <tr
                          className={
                            selectedProviderId === provider.id_proveedor
                              ? "is-selected"
                              : ""
                          }
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          onClick={() => selectProvider(provider)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectProvider(provider);
                            }
                          }}
                        >
                          <td>
                            <div className="provider-name-cell">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={imageUrl} alt={provider.nombre} />
                              <div>
                                <strong>{provider.nombre}</strong>
                              </div>
                              <span
                                className={`provider-row-chevron${isOpen ? " is-open" : ""}`}
                                aria-hidden="true"
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="m7 9 5 5 5-5" />
                                </svg>
                              </span>
                            </div>
                          </td>
                          <td>{provider.productos.length}</td>
                        </tr>

                        {isOpen ? (
                          <tr className="provider-products-row">
                            <td colSpan={2}>
                              {provider.productos.length > 0 ? (
                                <div className="provider-products-list">
                                  <div className="provider-product-head">
                                    <span>Producto</span>
                                    <div className="provider-product-stock-head">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openProductManager(provider);
                                        }}
                                      >
                                        Administrar productos
                                      </button>
                                      <span>Stock</span>
                                    </div>
                                    <span>Costo con IVA</span>
                                  </div>
                                  {provider.productos.map((product) => (
                                    <div className="provider-product-item" key={product.id}>
                                      <div className="provider-product-name">
                                        <strong>{product.nombre}</strong>
                                        <span>
                                          {product.nombreEmpaque ?? "Sin empaque"}
                                          {" · "}
                                          {product.contenido !== null
                                            ? `${product.contenido.toLocaleString("es-CL")} ${product.unidadMedida ?? ""}`.trim()
                                            : "Sin contenido"}
                                        </span>
                                      </div>
                                      <span>{product.stock}</span>
                                      <span>
                                        ${product.costoConIva.toLocaleString("es-CL")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="provider-products-empty">
                                  <p>Este proveedor no tiene productos asociados.</p>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openProductManager(provider);
                                    }}
                                  >
                                    Administrar productos
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}

                  {filteredProviders.length === 0 ? (
                    <tr>
                      <td colSpan={2}>No hay proveedores para mostrar.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {selectedProvider && form ? (
          <aside className="provider-detail-panel">
            <div className="provider-detail-header">
              <button
                className="provider-image-edit-button"
                type="button"
                aria-label="Editar imagen del proveedor"
                title="Editar imagen"
                onClick={openProviderImageModal}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedProvider.url_imagen || "/generic-provider.svg"}
                  alt={selectedProvider.nombre}
                />
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </span>
              </button>
              <div>
                <span>Ficha del proveedor</span>
                <h2>{selectedProvider.nombre}</h2>
              </div>
            </div>

            <div className="provider-form">
              <label className={submitted && !form.nombre.trim() ? "is-invalid" : ""}>
                <span className="provider-field-label">
                  <FieldIcon name="provider" />
                  Nombre <b>*</b>
                </span>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => updateForm("nombre", event.target.value)}
                />
              </label>

              <label>
                <span className="provider-field-label">
                  <FieldIcon name="seller" />
                  Nombre del vendedor
                </span>
                <input
                  type="text"
                  value={form.nombre_vendedor}
                  onChange={(event) =>
                    updateForm("nombre_vendedor", event.target.value)
                  }
                />
              </label>

              <label>
                <span className="provider-field-label">
                  <FieldIcon name="phone" />
                  Telefono
                </span>
                <input
                  type="text"
                  inputMode="tel"
                  placeholder="+569 1234 5678"
                  value={form.telefono}
                  onChange={(event) => updateForm("telefono", event.target.value)}
                />
              </label>

              <label className={submitted && emailIsInvalid ? "is-invalid" : ""}>
                <span className="provider-field-label">
                  <FieldIcon name="email" />
                  Correo
                </span>
                <input
                  type="email"
                  value={form.correo_contacto}
                  onChange={(event) =>
                    updateForm("correo_contacto", event.target.value)
                  }
                />
                {submitted && emailIsInvalid ? (
                  <small>Ingresa un correo con formato valido.</small>
                ) : null}
              </label>

              {message ? (
                <p
                  className={
                    message.includes("correctamente")
                      ? "provider-form-message is-success"
                      : "provider-form-message is-error"
                  }
                >
                  {message}
                </p>
              ) : null}

              <button
                className="provider-save-button"
                type="button"
                disabled={isSaving}
                onClick={saveProvider}
              >
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </aside>
        ) : (
          <aside className="provider-detail-empty">
            <FieldIcon name="provider" />
            <p>Selecciona un proveedor para revisar y editar sus datos.</p>
          </aside>
        )}
      </section>

      {isCreateModalOpen ? (
        <div className="stock-modal-layer" role="presentation">
          <button
            className="stock-modal-backdrop"
            type="button"
            aria-label="Cerrar modal"
            onClick={closeCreateProviderModal}
          />
          <section className="provider-modal" role="dialog" aria-modal="true">
            <button
              className="stock-modal-close-button"
              type="button"
              aria-label="Cerrar modal"
              onClick={closeCreateProviderModal}
            >
              x
            </button>
            <h2>Registrar proveedor</h2>

            <div className="provider-form">
              <label
                className={
                  createSubmitted && !createForm.nombre.trim() ? "is-invalid" : ""
                }
              >
                <span className="provider-field-label">
                  <FieldIcon name="provider" />
                  Nombre <b>*</b>
                </span>
                <input
                  type="text"
                  value={createForm.nombre}
                  onChange={(event) =>
                    updateCreateForm("nombre", event.target.value)
                  }
                />
              </label>

              <label>
                <span className="provider-field-label">Imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setCreateImage(event.target.files?.item(0) ?? null)
                  }
                />
              </label>

              {createImagePreview ? (
                <div className="provider-upload-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={createImagePreview} alt="Vista previa del proveedor" />
                  <button
                    type="button"
                    aria-label="Quitar imagen seleccionada"
                    onClick={() => setCreateImage(null)}
                  >
                    x
                  </button>
                </div>
              ) : null}

              <label>
                <span className="provider-field-label">
                  <FieldIcon name="phone" />
                  Telefono
                </span>
                <input
                  type="text"
                  inputMode="tel"
                  placeholder="+569 1234 5678"
                  value={createForm.telefono}
                  onChange={(event) =>
                    updateCreateForm("telefono", event.target.value)
                  }
                />
              </label>

              <label
                className={
                  createSubmitted && createEmailIsInvalid ? "is-invalid" : ""
                }
              >
                <span className="provider-field-label">
                  <FieldIcon name="email" />
                  Correo
                </span>
                <input
                  type="email"
                  value={createForm.correo_contacto}
                  onChange={(event) =>
                    updateCreateForm("correo_contacto", event.target.value)
                  }
                />
                {createSubmitted && createEmailIsInvalid ? (
                  <small>Ingresa un correo con formato valido.</small>
                ) : null}
              </label>

              <label>
                <span className="provider-field-label">
                  <FieldIcon name="seller" />
                  Nombre del vendedor
                </span>
                <input
                  type="text"
                  value={createForm.nombre_vendedor}
                  onChange={(event) =>
                    updateCreateForm("nombre_vendedor", event.target.value)
                  }
                />
              </label>

              {createMessage ? (
                <p className="provider-form-message is-error">{createMessage}</p>
              ) : null}

              <div className="stock-modal-actions">
                <button type="button" onClick={closeCreateProviderModal}>
                  Cancelar
                </button>
                <button type="button" disabled={isCreating} onClick={createProvider}>
                  {isCreating ? "Guardando..." : "Guardar proveedor"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isImageModalOpen && selectedProvider ? (
        <div className="stock-modal-layer" role="presentation">
          <button
            className="stock-modal-backdrop"
            type="button"
            aria-label="Cerrar modal"
            onClick={closeProviderImageModal}
          />
          <section className="provider-modal is-image" role="dialog" aria-modal="true">
            <button
              className="stock-modal-close-button"
              type="button"
              aria-label="Cerrar modal"
              onClick={closeProviderImageModal}
            >
              x
            </button>
            <h2>Imagen de {selectedProvider.nombre}</h2>

            {visibleProviderImage ? (
              <div className="provider-image-modal-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visibleProviderImage} alt={selectedProvider.nombre} />
                <button
                  type="button"
                  aria-label="Eliminar imagen"
                  title="Eliminar imagen"
                  onClick={() => {
                    setProviderImage(null);
                    setIsProviderImageRemoved(true);
                    setImageMessage("");
                  }}
                >
                  x
                </button>
              </div>
            ) : (
              <p className="provider-image-empty">Sin imagen seleccionada.</p>
            )}

            <label className="provider-image-file-field">
              Subir nueva imagen
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const nextImage = event.target.files?.item(0) ?? null;
                  setProviderImage(nextImage);
                  if (nextImage) {
                    setIsProviderImageRemoved(false);
                  }
                  setImageMessage("");
                }}
              />
            </label>

            {imageMessage ? (
              <p className="provider-form-message is-error">{imageMessage}</p>
            ) : null}

            <div className="stock-modal-actions">
              <button type="button" onClick={closeProviderImageModal}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isSavingImage ||
                  (!providerImage && !isProviderImageRemoved)
                }
                onClick={saveProviderImage}
              >
                {isSavingImage ? "Guardando..." : "Guardar imagen"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isProductManagerOpen && selectedProvider ? (
        <div className="stock-modal-layer" role="presentation">
          <button
            className="stock-modal-backdrop"
            type="button"
            aria-label="Cerrar modal"
            onClick={() => {
              if (!isSavingProducts) {
                setIsProductManagerOpen(false);
              }
            }}
          />
          <section
            className="provider-product-manager"
            role="dialog"
            aria-modal="true"
          >
            <button
              className="stock-modal-close-button"
              type="button"
              aria-label="Cerrar modal"
              onClick={() => setIsProductManagerOpen(false)}
            >
              x
            </button>
            <h2>Administrar productos de {selectedProvider.nombre}</h2>
            <p>Arrastra los productos entre ambas listas.</p>

            <div className="provider-product-manager-grid">
              <section
                className="provider-drop-zone is-assigned"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropManagedProduct("assigned")}
              >
                <header>
                  <strong>Productos del proveedor</strong>
                  <span>{managedProducts.assigned.length}</span>
                </header>
                <div className="provider-draggable-list">
                  {managedProducts.assigned.map((product) => (
                    <div
                      className="provider-draggable-product"
                      draggable
                      key={product.id}
                      onDragStart={() => setDraggedProductId(product.id)}
                      onDragEnd={() => setDraggedProductId(null)}
                    >
                      <div>
                        <strong>{product.nombre}</strong>
                        <span>Stock: {product.stock}</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Quitar ${product.nombre} del proveedor`}
                        title="Mover a productos disponibles"
                        onClick={() => moveManagedProduct(product.id, "available")}
                      >
                        &gt;
                      </button>
                    </div>
                  ))}
                  {managedProducts.assigned.length === 0 ? (
                    <p>Suelta productos aqui.</p>
                  ) : null}
                </div>
              </section>

              <section
                className="provider-drop-zone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropManagedProduct("available")}
              >
                <header>
                  <strong>Otros productos</strong>
                  <span>{managedProducts.available.length}</span>
                </header>
                <div className="provider-draggable-list">
                  {managedProducts.available.map((product) => (
                    <div
                      className="provider-draggable-product"
                      draggable
                      key={product.id}
                      onDragStart={() => setDraggedProductId(product.id)}
                      onDragEnd={() => setDraggedProductId(null)}
                    >
                      <button
                        type="button"
                        aria-label={`Asignar ${product.nombre} al proveedor`}
                        title="Asignar al proveedor"
                        onClick={() => moveManagedProduct(product.id, "assigned")}
                      >
                        &lt;
                      </button>
                      <div>
                        <strong>{product.nombre}</strong>
                        <span>
                          {product.id_proveedor ? "Otro proveedor" : "Sin proveedor"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {managedProducts.available.length === 0 ? (
                    <p>No quedan productos disponibles.</p>
                  ) : null}
                </div>
              </section>
            </div>

            {productManagerMessage ? (
              <p className="provider-form-message is-error">
                {productManagerMessage}
              </p>
            ) : null}

            <div className="stock-modal-actions">
              <button
                type="button"
                disabled={isSavingProducts}
                onClick={() => setIsProductManagerOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingProducts}
                onClick={saveManagedProducts}
              >
                {isSavingProducts ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
