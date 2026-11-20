"use client";

import { useState, type FormEvent } from "react";
import { readApiJson } from "@/lib/api-response";

export function QuickProviderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (provider: { id: string; nombre: string }) => void }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !nombre.trim()) return;
    setSaving(true); setError("");
    try {
      const form = new FormData();
      form.set("nombre", nombre.trim());
      const response = await fetch("/api/proveedores", { method: "POST", body: form });
      const data = await readApiJson(response) as { status?: string; message?: string; proveedor?: { id_proveedor: string; nombre: string } };
      if (!response.ok || data.status !== "ok" || !data.proveedor) throw new Error(data.message ?? "No se pudo crear el proveedor.");
      onCreated({ id: data.proveedor.id_proveedor, nombre: data.proveedor.nombre });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo conectar con el servidor."); }
    finally { setSaving(false); }
  }

  return <div className="stock-modal-layer">
    <button type="button" className="stock-modal-backdrop" aria-label="Cerrar" disabled={saving} onClick={onClose} />
    <section className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="quick-provider-title">
      <h2 id="quick-provider-title">Agregar proveedor</h2>
      <form onSubmit={submit}>
        <label>Nombre del proveedor *<input autoFocus required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <p>Podrás completar los demás datos en la vista Proveedores.</p>
        {error && <p className="stock-modal-message" role="alert">{error}</p>}
        <div className="stock-modal-actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" disabled={saving || !nombre.trim()}>{saving ? "Guardando..." : "Guardar proveedor"}</button></div>
      </form>
    </section>
  </div>;
}
