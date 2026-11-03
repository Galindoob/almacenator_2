"use client";
import { endSession, hasSessionHint } from "@/lib/client-session";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Navbar } from "./Navbar";

export function PlaceholderModulePage({ title }: { title: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasSessionHint()) router.replace("/login");
  }, [router]);

  function handleLogout() {
    void endSession();
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
