"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

type NavbarProps = {
  onLogout: () => void;
  showProductTabs?: boolean;
  activeProductTab?: "productos" | "promociones" | "vencimiento";
  onProductTabChange?: (tab: "productos" | "promociones" | "vencimiento") => void;
  showExpiringAlert?: boolean;
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
  showProductTabs = false,
  activeProductTab = "productos",
  onProductTabChange,
  showExpiringAlert = false,
  showLogout = true,
}: NavbarProps) {
  const router = useRouter();
  const menuId = useId();
  const productsSubmenuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);

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

  function goToExpiringProducts() {
    setIsMenuOpen(false);
    if (onProductTabChange) {
      onProductTabChange("vencimiento");
      return;
    }

    router.push("/producto");
  }

  function goToSales() {
    setIsMenuOpen(false);
    router.push("/ventas");
  }

  function goToProviders() {
    setIsMenuOpen(false);
    router.push("/proveedores");
  }

  function handleLogout() {
    setIsMenuOpen(false);
    onLogout();
  }

  return (
    <>
      <header className="app-navbar">
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
            <strong>nombre_tienda</strong>
            <small>Tu negocio, mas simple</small>
          </span>
        </button>

        {showProductTabs ? (
          <nav className="navbar-product-tabs" aria-label="Gestion de producto">
            <button
              type="button"
              className={activeProductTab === "productos" ? "is-active" : ""}
              onClick={goToProducts}
            >
              Productos
            </button>
            <button type="button">Promociones</button>
            <button
              type="button"
              className={activeProductTab === "vencimiento" ? "is-active" : ""}
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

        {showLogout ? (
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
              <strong>Almacenator 2.0</strong>
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
              <button type="button" onClick={goToSales}>
                Ventas
              </button>
              <button
                type="button"
                aria-controls={productsSubmenuId}
                aria-expanded={isProductsOpen}
                onClick={() => setIsProductsOpen((value) => !value)}
              >
                Gestion de producto
              </button>

              {isProductsOpen ? (
                <div id={productsSubmenuId} className="side-submenu">
                  <button type="button" onClick={goToProducts}>
                    Productos
                  </button>
                  <button type="button">Promociones</button>
                  <button type="button" onClick={goToExpiringProducts}>
                    Producto por vencer
                  </button>
                </div>
              ) : null}
              <button type="button" onClick={goToProviders}>
                Proveedores
              </button>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
