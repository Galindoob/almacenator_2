"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

type NavbarProps = {
  onLogout: () => void;
  showProductTabs?: boolean;
  activeProductTab?: "productos" | "promociones" | "vencimiento";
  showLogout?: boolean;
};

export function Navbar({
  onLogout,
  showProductTabs = false,
  activeProductTab = "productos",
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
    router.push("/producto");
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
            <button type="button">Productos por vencer</button>
          </nav>
        ) : (
          <div className="navbar-spacer" />
        )}

        {showLogout ? (
          <button type="button" className="navbar-logout" onClick={handleLogout}>
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
                  <button type="button">Producto por vencer</button>
                </div>
              ) : null}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
