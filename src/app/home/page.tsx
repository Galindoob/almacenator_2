"use client";
import { endSession, hasSessionHint } from "@/lib/client-session";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { useAppearance } from "../components/AppearanceProvider";
import { usePermissions } from "../components/usePermissions";
import { useSyncRevision } from "../components/SyncProvider";

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
  const { storeName } = useAppearance();
  const can = usePermissions();
  const syncRevision = useSyncRevision();
  const [payload, setPayload] = useState<TokenPayload | null>(null);
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState<boolean | null>(null);
  const [canCloseCashRegister, setCanCloseCashRegister] = useState(false);
  const [availableOpeningBalance, setAvailableOpeningBalance] = useState<number | null>(null);
  const [isOpenCashModalVisible, setIsOpenCashModalVisible] = useState(false);
  const [isNoCapitalAlertVisible, setIsNoCapitalAlertVisible] = useState(false);
  const [cashMessage, setCashMessage] = useState("");
  const [isSavingCashRegister, setIsSavingCashRegister] = useState(false);

  useEffect(() => {
    if (!isNoCapitalAlertVisible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNoCapitalAlertVisible(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNoCapitalAlertVisible]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) void endSession();
          return;
        }
        const data = await response.json() as { user: TokenPayload };
        setPayload(data.user);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    async function loadCashRegisterState() {
      const token = hasSessionHint();

      if (!token) {
        return;
      }

      try {
        const response = await fetch("/api/caja", { cache: "no-store" });
        const data = (await response.json()) as {
          status?: "ok" | "error";
          abierta?: boolean;
          puedeCerrar?: boolean;
          saldoDisponible?: number | null;
          message?: string;
        };

        if (!response.ok || data.status !== "ok") {
          setCashMessage(data.message ?? "No se pudo consultar la caja.");
          return;
        }

        setIsCashRegisterOpen(Boolean(data.abierta));
        setCanCloseCashRegister(Boolean(data.puedeCerrar));
        setAvailableOpeningBalance(data.saldoDisponible ?? null);
      } catch {
        setCashMessage("No se pudo conectar con el servidor de caja.");
      }
    }

    if (payload) {
      loadCashRegisterState();
    }
  }, [payload, syncRevision]);

  function handleLogout() {
    void endSession();
    router.replace("/login");
  }

  async function handleAction(action: HomeAction["action"]) {
    if (action === "sale") {
      router.push("/ventas");
      return;
    }

    if (action === "income" || action === "expense") {
      router.push(action === "income" ? "/registrar_ingreso" : "/registrar_egreso");
      return;
    }

    if (action === "close") {
      try {
        const response = await fetch("/api/caja", { cache: "no-store" });
        const data = await response.json() as { abierta?: boolean; puedeCerrar?: boolean; ventasPendientes?: number; message?: string };
        if (!response.ok || !data.abierta || !data.puedeCerrar) {
          window.alert(data.message ?? "No puedes cerrar esta caja.");
          return;
        }
        if (data.ventasPendientes) {
          window.alert(`Hay ${data.ventasPendientes} ${data.ventasPendientes === 1 ? "venta pendiente" : "ventas pendientes"}. Termínalas o elimínalas antes de cerrar la caja.`);
          return;
        }
      } catch {
        window.alert("No se pudo verificar el estado de la caja.");
        return;
      }
      router.push("/cierreCaja");
    }
  }

  async function openCashRegister() {
    const token = hasSessionHint();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (availableOpeningBalance === null || availableOpeningBalance <= 0) {
      setIsOpenCashModalVisible(false);
      setIsNoCapitalAlertVisible(true);
      return;
    }

    setIsSavingCashRegister(true);
    setCashMessage("");

    try {
      const response = await fetch("/api/caja", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        if (data.message?.startsWith("No hay capital en caja")) {
          setIsOpenCashModalVisible(false);
          setIsNoCapitalAlertVisible(true);
          return;
        }
        setCashMessage(data.message ?? "No se pudo abrir la caja.");
        return;
      }

      setIsCashRegisterOpen(true);
      setCanCloseCashRegister(true);
      setAvailableOpeningBalance(null);
      setIsOpenCashModalVisible(false);
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
        <h1>{storeName || "nombre_tienda"}</h1>
        <p>
          Bienvenido, {payload.nombre} {payload.apellido}
        </p>
        <span className="home-subtitle">Que tengas un gran dia. Hagamos crecer tu negocio.</span>

        <nav className="home-actions" aria-label="Acciones principales">
          {cashMessage && !isOpenCashModalVisible ? <p className="cash-modal-message" role="alert">{cashMessage}</p> : null}
          {isCashRegisterOpen ? (
            homeActions.filter((action) => can(action.action === "sale" ? "ventas_crear" : action.action === "close" ? "caja_abrir_cerrar" : "caja_ingreso_egreso")).map((action) => (
              <button
                type="button"
                className={`home-action-${action.tone}`}
                key={action.label}
                disabled={action.action === "close" && !canCloseCashRegister}
                title={action.action === "close" && !canCloseCashRegister ? "Solo quien abrió la caja puede cerrarla" : undefined}
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
          ) : can("caja_abrir_cerrar") ? (
            <button
              type="button"
              className="home-action-cash"
              disabled={isCashRegisterOpen === null}
              onClick={() => {
                if (availableOpeningBalance === null || availableOpeningBalance <= 0) setIsNoCapitalAlertVisible(true);
                else setIsOpenCashModalVisible(true);
              }}
            >
              <span className="home-action-icon">
                <HomeActionIcon name="register" />
              </span>
              <span>Abrir caja</span>
              <svg className="home-action-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
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
            <p>Saldo disponible para la apertura: <strong>$ {availableOpeningBalance?.toLocaleString("es-CL")}</strong></p>
            {cashMessage ? <p className="cash-modal-message">{cashMessage}</p> : null}
            <div className="cash-modal-actions">
              <button type="button" className="cash-modal-cancel" disabled={isSavingCashRegister} onClick={() => { setIsOpenCashModalVisible(false); setCashMessage(""); }}>Cancelar</button>
              <button type="button" disabled={isSavingCashRegister} onClick={openCashRegister}>
                {isSavingCashRegister ? "Abriendo..." : "Abrir caja"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isNoCapitalAlertVisible ? (
        <div className="cash-modal-layer" role="presentation">
          <button className="cash-modal-backdrop" type="button" aria-label="Cerrar alerta" onClick={() => setIsNoCapitalAlertVisible(false)} />
          <section className="cash-modal" role="alertdialog" aria-modal="true" aria-labelledby="no-capital-title" aria-describedby="no-capital-description">
            <h2 id="no-capital-title">Caja sin capital</h2>
            <p id="no-capital-description">No hay capital en caja. Comunícate con administración.</p>
            <button type="button" autoFocus onClick={() => setIsNoCapitalAlertVisible(false)}>Entendido</button>
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
