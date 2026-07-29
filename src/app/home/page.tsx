"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TokenPayload = {
  nombre?: string;
  apellido?: string;
  correo?: string;
  rol?: string;
  exp?: number;
};

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
    router.push("/login");
  }

  if (!payload) {
    return null;
  }

  return (
    <main className="home-shell">
      <section className="home-content">
        <h1>nombre_tienda</h1>
        <p>
          Bienvenido, {payload.nombre} {payload.apellido}
        </p>

        <nav className="home-actions" aria-label="Acciones principales">
          <button type="button">Crear nueva venta</button>
          <button type="button">Registrar ingreso</button>
          <button type="button">Registrar egreso</button>
          <button type="button">Cerrar caja</button>
        </nav>
      </section>

      <button className="logout-button" type="button" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </main>
  );
}
