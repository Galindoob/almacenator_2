"use client";

import { useEffect, useState } from "react";

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    function refresh() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { setPermissions([]); return null; }
        return response.ok ? response.json() as Promise<{ user?: { permisos?: string[] } }> : null;
      })
      .then((data) => { if (data) setPermissions(data.user?.permisos ?? []); })
      .catch(() => {});
    }
    refresh();
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  return (id: string) => permissions.includes(id);
}
