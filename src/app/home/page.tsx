"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { isSafeAppInput } from "@/lib/input-validation";

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
  action: "sale" | "income" | "expense" | "close";
};

const homeActions: HomeAction[] = [
  { label: "Crear nueva venta", tone: "sale", icon: "cart", action: "sale" },
  { label: "Registrar ingreso", tone: "income", icon: "up", action: "income" },
  { label: "Registrar egreso", tone: "expense", icon: "down", action: "expense" },
  { label: "Cerrar caja", tone: "cash", icon: "register", action: "close" },
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
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState<boolean | null>(null);
  const [isOpenCashModalVisible, setIsOpenCashModalVisible] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [cashMessage, setCashMessage] = useState("");
  const [isSavingCashRegister, setIsSavingCashRegister] = useState(false);

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

  useEffect(() => {
    async function loadCashRegisterState() {
      const token = localStorage.getItem("jwt");

      if (!token) {
        return;
      }

      try {
        const response = await fetch("/api/caja", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json()) as {
          status?: "ok" | "error";
          abierta?: boolean;
        };

        if (!response.ok || data.status !== "ok") {
          setIsCashRegisterOpen(false);
          return;
        }

        setIsCashRegisterOpen(Boolean(data.abierta));
      } catch {
        setIsCashRegisterOpen(false);
      }
    }

    if (payload) {
      loadCashRegisterState();
    }
  }, [payload]);

  function handleLogout() {
    localStorage.clear();
    router.replace("/login");
  }

  function updateOpeningAmount(value: string) {
    if (isSafeAppInput(value) && /^\d*$/.test(value)) {
      setOpeningAmount(value);
      setCashMessage("");
    }
  }

  function handleAction(action: HomeAction["action"]) {
    if (action === "close") {
      router.push("/cierreCaja");
    }
  }

  async function openCashRegister() {
    const amount = Number(openingAmount);
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!openingAmount || !Number.isFinite(amount) || amount < 0) {
      return;
    }

    setIsSavingCashRegister(true);
    setCashMessage("");

    try {
      const response = await fetch("/api/caja", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monto: amount }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        setCashMessage(data.message ?? "No se pudo abrir la caja.");
        return;
      }

      setIsCashRegisterOpen(true);
      setIsOpenCashModalVisible(false);
      setOpeningAmount("");
    } catch {
      setCashMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSavingCashRegister(false);
    }
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
          {isCashRegisterOpen ? (
            homeActions.map((action) => (
              <button
                type="button"
                className={`home-action-${action.tone}`}
                key={action.label}
                onClick={() => handleAction(action.action)}
              >
                <span className="home-action-icon">
                  <HomeActionIcon name={action.icon} />
                </span>
                <span>{action.label}</span>
                <svg className="home-action-arrow" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          ) : (
            <button
              type="button"
              className="home-action-cash"
              disabled={isCashRegisterOpen === null}
              onClick={() => setIsOpenCashModalVisible(true)}
            >
              <span className="home-action-icon">
                <HomeActionIcon name="register" />
              </span>
              <span>Abrir caja</span>
              <svg className="home-action-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </nav>
      </section>

      {isOpenCashModalVisible ? (
        <div className="cash-modal-layer" role="presentation">
          <button
            className="cash-modal-backdrop"
            type="button"
            aria-label="Cerrar modal"
            onClick={() => {
              if (!isSavingCashRegister) {
                setIsOpenCashModalVisible(false);
                setCashMessage("");
              }
            }}
          />
          <section className="cash-modal" role="dialog" aria-modal="true">
            <h2>Abrir caja</h2>
            <label>
              Ingrese monto de apertura de caja
              <input
                type="text"
                inputMode="numeric"
                value={openingAmount}
                onChange={(event) => updateOpeningAmount(event.target.value)}
              />
            </label>
            {cashMessage ? <p className="cash-modal-message">{cashMessage}</p> : null}
            <button
              type="button"
              disabled={!openingAmount || isSavingCashRegister}
              onClick={openCashRegister}
            >
              {isSavingCashRegister ? "Abriendo..." : "Abrir caja"}
            </button>
          </section>
        </div>
      ) : null}

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
