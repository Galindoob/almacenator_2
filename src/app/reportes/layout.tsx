"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Navbar } from "../components/Navbar";

export default function ReportesLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isSessionVerified, setIsSessionVerified] = useState(false);

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem("jwt");

    if (!token) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!isActive) return;
        if (response.ok) {
          setIsSessionVerified(true);
          return;
        }
        if (response.status === 401) localStorage.removeItem("jwt");
        router.replace("/login");
      })
      .catch(() => {
        if (isActive) router.replace("/login");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  if (!isSessionVerified) {
    return (
      <main className="reports-shell">
        <p className="reports-verifying" role="status">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="reports-shell">
      <Navbar onLogout={handleLogout} compact />
      {children}
    </main>
  );
}
