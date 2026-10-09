"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Navbar } from "./Navbar";

export function PlaceholderModulePage({ title }: { title: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("jwt")) router.replace("/login");
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("jwt");
    router.replace("/login");
  }

  return (
    <main className="placeholder-module-shell">
      <Navbar onLogout={handleLogout} />
      <section className="placeholder-module-content">
        <h1>{title}</h1>
        <p>Este módulo estará disponible próximamente.</p>
      </section>
    </main>
  );
}
