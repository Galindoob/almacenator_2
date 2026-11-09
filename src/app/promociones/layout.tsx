"use client";
import { endSession, hasSessionHint } from "@/lib/client-session";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Navbar } from "../components/Navbar";

export default function PromotionsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState(false);
  const [showExpiringAlert, setShowExpiringAlert] = useState(false);

  useEffect(() => {
    const token = hasSessionHint();
    if (!token) { router.replace("/login"); return; }
    const controller = new AbortController();
    let active = true;
    fetch("/api/session", { headers: {}, cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!active) return;
        if (response.ok) setVerified(true);
        else if (response.status === 401) {
          void endSession();
          router.replace("/login");
        } else setVerificationError(true);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setVerificationError(true);
      });
    return () => { active = false; controller.abort(); };
  }, [router]);

  useEffect(() => {
    if (!verified) return;
    const controller = new AbortController();

    async function refreshExpiringAlert() {
      try {
        const [dateResponse, productsResponse] = await Promise.all([
          fetch("/api/hora-chile", { cache: "no-store", signal: controller.signal }),
          fetch("/api/producto-vencimiento", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!dateResponse.ok || !productsResponse.ok) throw new Error("No se pudo consultar los vencimientos.");
        const dateData = await dateResponse.json() as { fecha?: string };
        const productsData = await productsResponse.json() as { productos?: { lotes: { fecha_vencimiento: string }[] }[] };
        if (!dateData.fecha || !productsData.productos) throw new Error("Datos de vencimiento incompletos.");

        const today = Date.parse(`${dateData.fecha}T00:00:00.000Z`);
        const hasCloseLot = productsData.productos.some((product) => product.lotes.some((lot) => {
          const expiration = Date.parse(`${lot.fecha_vencimiento.slice(0, 10)}T00:00:00.000Z`);
          const days = Math.ceil((expiration - today) / 86_400_000);
          return days > 0 && days <= 5;
        }));
        if (!controller.signal.aborted) setShowExpiringAlert(hasCloseLot);
      } catch {
        if (!controller.signal.aborted) setShowExpiringAlert(false);
      }
    }

    void refreshExpiringAlert();
    const timer = window.setInterval(() => void refreshExpiringAlert(), 60_000);
    window.addEventListener("focus", refreshExpiringAlert);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshExpiringAlert);
    };
  }, [verified]);

  function logout() {
    void endSession();
    router.replace("/login");
  }

  if (!verified) return <main className="promotions-shell"><p role="status">{verificationError ? "No se pudo verificar la sesión. Recarga la página para reintentar." : "Verificando sesión..."}</p></main>;
  return <main className="promotions-shell"><Navbar onLogout={logout} compact showProductTabs activeProductTab="promociones" showExpiringAlert={showExpiringAlert} showLogout={false} />{children}</main>;
}
