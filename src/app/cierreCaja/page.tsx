"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isSafeAppInput } from "@/lib/input-validation";

type CashRegister = {
  id_apertura: string;
  horario_apertura: string;
  saldo_apertura: number;
  saldo_esperado: number;
  total_debito: number;
  total_credito: number;
  total_transferencia: number;
  usuario: {
    nombre: string;
    apellido: string;
  };
};

function formatCurrency(value: number) {
  return `$ ${Math.abs(value).toLocaleString("es-CL")}`;
}

function formatOpeningDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CierreCajaPage() {
  const router = useRouter();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [cashOnHand, setCashOnHand] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    async function loadCashRegister() {
      const token = localStorage.getItem("jwt");

      if (!token) {
        router.replace("/login");
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
          caja?: CashRegister | null;
          message?: string;
        };

        if (!response.ok || data.status !== "ok") {
          setMessage(data.message ?? "No se pudo cargar la caja.");
          return;
        }

        if (!data.abierta || !data.caja) {
          router.replace("/home");
          return;
        }

        setCashRegister(data.caja);
      } catch {
        setMessage("No se pudo conectar con el servidor.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCashRegister();
  }, [router]);

  const parsedCashOnHand = cashOnHand ? Number(cashOnHand) : 0;
  const difference = useMemo(() => {
    if (!cashRegister) {
      return 0;
    }

    return parsedCashOnHand - cashRegister.saldo_apertura;
  }, [cashRegister, parsedCashOnHand]);
  const differenceTitle = difference >= 0 ? "Sobran" : "Faltan";

  function updateCashOnHand(value: string) {
    if (isSafeAppInput(value) && /^\d*$/.test(value)) {
      setCashOnHand(value);
      setMessage("");
    }
  }

  async function closeCashRegister() {
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!cashOnHand) {
      setMessage("Ingresa el monto en caja antes de cerrar.");
      return;
    }

    setIsClosing(true);
    setMessage("");

    try {
      const response = await fetch("/api/caja", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ saldo_cierre: Number(cashOnHand) }),
      });
      const data = (await response.json()) as {
        status?: "ok" | "error";
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        setMessage(data.message ?? "No se pudo cerrar la caja.");
        return;
      }

      router.replace("/home");
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsClosing(false);
    }
  }

  if (isLoading) {
    return (
      <main className="cash-close-shell">
        <p className="cash-close-status">Cargando cierre de caja...</p>
      </main>
    );
  }

  if (!cashRegister) {
    return (
      <main className="cash-close-shell">
        <p className="cash-close-status">{message || "No hay caja abierta."}</p>
      </main>
    );
  }

  return (
    <main className="cash-close-shell">
      <header className="cash-close-topbar">
        <button type="button" aria-label="Volver" onClick={() => router.push("/home")}>
          {"<"}
        </button>
        <h1>Cierre de caja</h1>
      </header>

      <section className="cash-close-content">
        <p className="cash-close-opening-message">
          Caja abierta por {cashRegister.usuario.nombre}{" "}
          {cashRegister.usuario.apellido} a las{" "}
          {formatOpeningDate(cashRegister.horario_apertura)}
        </p>

        <div className="cash-close-summary">
          <section className="cash-close-column">
            <h2>Efectivo Total</h2>
            <label>
              En caja
              <input
                type="text"
                inputMode="numeric"
                value={cashOnHand}
                onChange={(event) => updateCashOnHand(event.target.value)}
              />
            </label>
            <label>
              Esperado
              <input
                type="text"
                readOnly
                value={formatCurrency(cashRegister.saldo_apertura)}
              />
            </label>
            <label>
              {differenceTitle}
              <input type="text" readOnly value={formatCurrency(difference)} />
            </label>
          </section>

          <section className="cash-close-column">
            <h2>Otros medios de pago</h2>
            <div className="cash-payment-grid">
              <label>
                Debito
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(cashRegister.total_debito)}
                />
              </label>
              <label>
                Credito
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(cashRegister.total_credito)}
                />
              </label>
              <label>
                Transferencia
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(cashRegister.total_transferencia)}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="cash-close-footer">
          {message ? <p>{message}</p> : null}
          <button
            type="button"
            disabled={!cashOnHand || isClosing}
            onClick={closeCashRegister}
          >
            {isClosing ? "Cerrando..." : "Cerrar caja"}
          </button>
        </div>
      </section>
    </main>
  );
}
