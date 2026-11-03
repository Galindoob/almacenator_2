"use client";
import { endSession, hasSessionHint } from "@/lib/client-session";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Navbar } from "../components/Navbar";

export default function PromotionsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState(false);

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

  function logout() {
    void endSession();
    router.replace("/login");
  }

  if (!verified) return <main className="promotions-shell"><p role="status">{verificationError ? "No se pudo verificar la sesión. Recarga la página para reintentar." : "Verificando sesión..."}</p></main>;
  return <main className="promotions-shell"><Navbar onLogout={logout} compact />{children}</main>;
}
