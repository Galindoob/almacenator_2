"use client";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

export function ProductInternalCode({ id, name, code, canEdit, onSaved }: { id: string; name: string; code: string | null; canEdit: boolean; onSaved: (code: string | null) => void }) {
  const [value, setValue] = useState(code ?? "");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { if (modal && code && svg.current) JsBarcode(svg.current, code, { format: "CODE128", displayValue: true, margin: 12, width: 2, height: 70 }); }, [modal, code]);
  async function save() {
    if (value && !/^\d{4,30}$/.test(value)) { setMessage("Ingresa entre 4 y 30 dígitos."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/producto/codigo-interno", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, codigo: value }) });
      const result = await response.json() as { message?: string; producto?: { codigoInterno: string | null } };
      if (!response.ok || !result.producto) throw new Error(result.message || "No se pudo guardar el código.");
      onSaved(result.producto.codigoInterno); setMessage("Código interno guardado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el código."); }
    finally { setSaving(false); }
  }
  function print() {
    if (!svg.current) return;
    const win = window.open("", "_blank", "width=500,height=400");
    if (!win) { setMessage("Permite ventanas emergentes para imprimir."); return; }
    win.document.title = "Etiqueta de producto";
    const title = win.document.createElement("p"); title.textContent = name; win.document.body.append(title);
    win.document.body.append(win.document.importNode(svg.current, true));
    win.document.body.style.cssText = "text-align:center;font-family:Arial,sans-serif;color:black;background:white";
    win.focus(); win.print();
  }
  return <div className="internal-code-panel">
    <label>Código interno <input type="text" inputMode="numeric" value={value} maxLength={30} disabled={!canEdit || saving} onChange={(event) => { if (/^\d*$/.test(event.target.value)) { setValue(event.target.value); setMessage(""); } }} placeholder="Ej.: 1000006" /></label>
    <button type="button" disabled={!canEdit || saving || value === (code ?? "")} onClick={() => void save()}>Guardar código</button>
    <button type="button" disabled={!code} onClick={() => setModal(true)}>▣ Ver e imprimir</button>
    {message && <p role="status">{message}</p>}
    {modal && <div className="stock-modal-layer"><button className="stock-modal-backdrop" aria-label="Cerrar" onClick={() => setModal(false)} /><section className="stock-modal" role="dialog" aria-modal="true" aria-label="Imprimir código interno"><h2>Imprimir código de barras</h2><p>{name}</p><div style={{ background: "white", textAlign: "center", overflowX: "auto" }}><svg ref={svg} aria-label={`Código ${code}`} /></div><div className="stock-modal-actions"><button type="button" onClick={() => setModal(false)}>Cerrar</button><button type="button" onClick={print}>Imprimir</button></div></section></div>}
  </div>;
}
