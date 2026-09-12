"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";

type TokenPayload = {
  nombre?: string;
  apellido?: string;
  correo?: string;
  rol?: string;
  exp?: number;
};

type HomeAction = {
  label: string;
  tone: "sale" | "income" | "expense" | "cash";
  icon: "cart" | "up" | "down" | "register";
};

const homeActions: HomeAction[] = [
  { label: "Crear nueva venta", tone: "sale", icon: "cart" },
  { label: "Registrar ingreso", tone: "income", icon: "up" },
  { label: "Registrar egreso", tone: "expense", icon: "down" },
  { label: "Cerrar caja", tone: "cash", icon: "register" },
];

function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalizedPayload);

    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
}

function StoreHeroIcon() {
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

function HomeActionIcon({ name }: { name: HomeAction["icon"] }) {
  if (name === "cart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h2l2 10h8l2-7H8" />
        <path d="M9 20h.01" />
        <path d="M17 20h.01" />
      </svg>
    );
  }

  if (name === "up") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </svg>
    );
  }

  if (name === "down") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M18 13l-6 6-6-6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9h14v10H5z" />
      <path d="M7 5h10v4H7z" />
      <path d="M8 13h8" />
      <path d="M8 16h3" />
      <path d="M15 16h1" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<TokenPayload | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    const decodedPayload = decodeJwtPayload(token);

    if (!decodedPayload) {
      localStorage.clear();
      router.replace("/login");
      return;
    }

    queueMicrotask(() => setPayload(decodedPayload));
  }, [router]);

  function handleLogout() {
    localStorage.clear();
    router.replace("/login");
  }

  if (!payload) {
    return null;
  }

  return (
    <main className="home-shell">
      <Navbar onLogout={handleLogout} />

      <section className="home-content">
        <div className="home-store-badge">
          <StoreHeroIcon />
        </div>
        <h1>nombre_tienda</h1>
        <p>
          Bienvenido, {payload.nombre} {payload.apellido}
        </p>
        <span className="home-subtitle">Que tengas un gran dia. Hagamos crecer tu negocio.</span>

        <nav className="home-actions" aria-label="Acciones principales">
          {homeActions.map((action) => (
            <button type="button" className={`home-action-${action.tone}`} key={action.label}>
              <span className="home-action-icon">
                <HomeActionIcon name={action.icon} />
              </span>
              <span>{action.label}</span>
              <svg className="home-action-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </nav>
      </section>

      <aside className="home-note home-note-left" aria-hidden="true">
        <strong>Pequenas ventas grandes historias</strong>
        <span />
        <p>Tu esfuerzo tambien hace comunidad</p>
      </aside>
      <aside className="home-note home-note-right" aria-hidden="true">
        <strong>Buenas ventas!</strong>
        <span />
      </aside>
    </main>
  );
}
