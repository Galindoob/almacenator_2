"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const SyncContext = createContext(0);
export function useSyncRevision() { return useContext(SyncContext); }

export function SyncProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let last: string | null = null;
    let pending = false;
    const controller = new AbortController();
    async function check() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const response = await fetch("/api/sincronizacion", { cache: "no-store", signal: controller.signal });
        if (!response.ok) { if (response.status === 401) last = null; return; }
        const data = await response.json() as { revision?: string };
        if (!data.revision) return;
        if (last !== null && last !== data.revision) setRevision((value) => value + 1);
        last = data.revision;
      } catch { /* Se reintenta en la siguiente consulta. */ }
      finally { pending = false; }
    }
    void check();
    const timer = window.setInterval(check, 12000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, []);
  return <SyncContext.Provider value={revision}>{children}</SyncContext.Provider>;
}
