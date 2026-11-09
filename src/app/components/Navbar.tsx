"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAppearance } from "./AppearanceProvider";
import { usePermissions } from "./usePermissions";

type NavbarProps = {
  onLogout?: () => void;
  compact?: boolean;
  showProductTabs?: boolean;
  activeProductTab?: "productos" | "promociones" | "vencimiento";
  onProductTabChange?: (tab: "productos" | "promociones" | "vencimiento") => void;
  showExpiringAlert?: boolean;
  lowStockProducts?: { id: string; nombre: string; stock: number; stockMinimo: number }[];
  onLowStockProductSelect?: (id: string) => void;
  showLogout?: boolean;
};

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16" />
      <path d="M5 10l1-5h12l1 5" />
      <path d="M6 10v9h12v-9" />
      <path d="M9 19v-5h6v5" />
      <path d="M4 10c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4" />
    </svg>
  );
}

export function Navbar({
  onLogout,
  compact = false,
  showProductTabs = false,
  activeProductTab = "productos",
  onProductTabChange,
  showExpiringAlert = false,
  lowStockProducts = [],
  onLowStockProductSelect,
  showLogout = true,
}: NavbarProps) {
  const router = useRouter();
  const menuId = useId();
  const productsSubmenuId = useId();
  const reportsSubmenuId = useId();
  const lowStockPanelId = useId();
  const lowStockRef = useRef<HTMLDivElement>(null);
  const { storeName, resetThemeForLogout } = useAppearance();
  const can = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);

  useEffect(() => {
    if (!isLowStockOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (lowStockRef.current && !lowStockRef.current.contains(event.target as Node)) {
        setIsLowStockOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLowStockOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isLowStockOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMenuOpen]);

  function goToHome() {
    setIsMenuOpen(false);
    router.push("/home");
  }

  function goToProducts() {
    setIsMenuOpen(false);
    if (onProductTabChange) {
      onProductTabChange("productos");
      return;
    }

    router.push("/producto");
  }

  function goToPromotions() {
    setIsMenuOpen(false);
    router.push("/promociones");
  }

  function goToExpiringProducts() {
    setIsMenuOpen(false);
    if (onProductTabChange) {
      onProductTabChange("vencimiento");
      return;
    }

    router.push("/producto?tab=vencimiento");
  }

  function goToProviders() {
    setIsMenuOpen(false);
    router.push("/proveedores");
  }

  function goToPriceLookup() {
    setIsMenuOpen(false);
    router.push("/consultar-precio");
  }

  function goToSettings() {
    setIsMenuOpen(false);
    router.push("/configuracion");
  }

  function goToTransactions() {
    setIsMenuOpen(false);
    router.push("/transacciones");
  }

  function goToInstantReport() {
    setIsMenuOpen(false);
    router.push("/reportes");
  }

  function goToProductReport() {
    setIsMenuOpen(false);
    router.push("/reportes/productos");
  }

  function goToAcademy() {
    setIsMenuOpen(false);
    router.push("/academia-minigest");
  }

  function handleLogout() {
    setIsMenuOpen(false);
    resetThemeForLogout();
    onLogout?.();
  }

  return (
    <>
      <header className={`app-navbar${compact ? " is-compact" : ""}`}>
        <button
          type="button"
          className="hamburger-button"
          aria-label="Abrir menu lateral"
          aria-controls={menuId}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        <button type="button" className="navbar-brand" onClick={goToHome}>
          <span className="navbar-brand-icon">
            <StoreIcon />
          </span>
          <span>
            <strong>{storeName || "nombre_tienda"}</strong>
            <small>Tu negocio, mas simple</small>
          </span>
        </button>

        {showProductTabs ? (
          <nav className="navbar-product-tabs" aria-label="Gestion de producto">
            <button
              type="button"
              className={activeProductTab === "productos" ? "is-active" : ""}
              disabled={!can("productos_ver")}
              onClick={goToProducts}
            >
              Productos
            </button>
            <button type="button" className={activeProductTab === "promociones" ? "is-active" : ""} disabled={!can("promociones_crear")} onClick={goToPromotions}>Promociones</button>
            <button
              type="button"
              className={activeProductTab === "vencimiento" ? "is-active" : ""}
              disabled={!can("productos_ver") || !can("vencimiento_ver")}
              onClick={goToExpiringProducts}
            >
              Productos por vencer
              {showExpiringAlert ? (
                <span
                  className="expiration-alert-icon navbar-expiration-alert"
                  aria-label="Hay productos próximos a vencer"
                  title="Hay productos próximos a vencer"
                >
                  !
                </span>
              ) : null}
            </button>
          </nav>
        ) : (
          <div className="navbar-spacer" />
        )}

        {showProductTabs ? (
          <div className="navbar-low-stock" ref={lowStockRef}>
            <button
              type="button"
              className={`navbar-low-stock-trigger${lowStockProducts.length ? " has-alerts" : ""}`}
              aria-label={`Productos con stock bajo: ${lowStockProducts.length}`}
              aria-expanded={isLowStockOpen}
              aria-controls={lowStockPanelId}
              title="Productos con stock bajo"
              onClick={() => setIsLowStockOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 2 21h20L12 3Z" />
                <path d="M12 9v5" />
                <circle cx="12" cy="18" r=".8" fill="currentColor" stroke="none" />
              </svg>
              {lowStockProducts.length > 0 ? <span className="navbar-low-stock-count">{lowStockProducts.length}</span> : null}
            </button>
            {isLowStockOpen ? (
              <section id={lowStockPanelId} className="navbar-low-stock-panel" aria-label="Productos con stock bajo">
                <div className="navbar-low-stock-heading">
                  <strong>Stock bajo</strong>
                  <button type="button" aria-label="Cerrar lista" onClick={() => setIsLowStockOpen(false)}>×</button>
                </div>
                <p className="navbar-low-stock-hint">Stock igual o inferior al mínimo configurado.</p>
                {lowStockProducts.length > 0 ? (
                  <div className="navbar-low-stock-list">
                    {lowStockProducts.map((product) => (
                      <button key={product.id} type="button" onClick={() => {
                        setIsLowStockOpen(false);
                        onLowStockProductSelect?.(product.id);
                      }}>
                        <span className="navbar-low-stock-name">{product.nombre}</span>
                        <span className="navbar-low-stock-level">Stock: {product.stock} · Mínimo: {product.stockMinimo}</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="navbar-low-stock-empty">No hay productos con stock bajo.</p>}
              </section>
            ) : null}
          </div>
        ) : null}

        {showLogout && onLogout ? (
          <button type="button" className="navbar-logout" onClick={handleLogout}>
            <LogoutIcon />
            Cerrar sesion
          </button>
        ) : null}
      </header>

      {isMenuOpen ? (
        <div className="side-menu-layer">
          <button
            type="button"
            className="side-menu-backdrop"
            aria-label="Cerrar menu lateral"
            onClick={() => setIsMenuOpen(false)}
          />

          <aside
            id={menuId}
            className="side-menu"
            role="dialog"
            aria-label="Menu lateral"
            aria-modal="true"
          >
            <div className="side-menu-header">
              <strong>Mini Gest</strong>
              <button
                type="button"
                className="side-menu-close"
                aria-label="Cerrar menu lateral"
                onClick={() => setIsMenuOpen(false)}
              >
                x
              </button>
            </div>

            <nav className="side-menu-nav" aria-label="Opciones principales">
              <button type="button" onClick={goToHome}>
                Caja registradora
              </button>
              {can("productos_ver") || can("promociones_crear") ? <button
                type="button"
                aria-controls={productsSubmenuId}
                aria-expanded={isProductsOpen}
                onClick={() => setIsProductsOpen((value) => !value)}
              >
                Gestion de producto
              </button> : null}

              {isProductsOpen ? (
                <div id={productsSubmenuId} className="side-submenu">
                  {can("productos_ver") ? <button type="button" onClick={goToProducts}>
                    Productos
                  </button> : null}
                  {can("promociones_crear") ? <button type="button" onClick={goToPromotions}>Promociones</button> : null}
                  {can("productos_ver") && can("vencimiento_ver") ? <button type="button" onClick={goToExpiringProducts}>
                    Producto por vencer
                  </button> : null}
                </div>
              ) : null}
              {can("proveedores_ver") ? <button type="button" onClick={goToProviders}>
                Proveedores
              </button> : null}
              {can("precios_ver") ? <button type="button" onClick={goToPriceLookup}>
                Consultar precio
              </button> : null}
              {can("transacciones_ver") ? <button type="button" onClick={goToTransactions}>Transacciones</button> : null}
              {can("reportes_ver") ? <button
                type="button"
                aria-controls={reportsSubmenuId}
                aria-expanded={isReportsOpen}
                onClick={() => setIsReportsOpen((value) => !value)}
              >
                Reportes
              </button> : null}
              {isReportsOpen ? (
                <div id={reportsSubmenuId} className="side-submenu">
                  <button type="button" onClick={goToInstantReport}>
                    Reporte instantáneo
                  </button>
                  <button type="button" onClick={goToProductReport}>
                    Reporte por productos
                  </button>
                </div>
              ) : null}
              {can("academia_ver") ? <button type="button" onClick={goToAcademy}>Academia MiniGest</button> : null}
              <button type="button" onClick={goToSettings}>
                Configuración
              </button>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
