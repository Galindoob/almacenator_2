"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type DialogOptions = { title: string; message: string; tone?: "info" | "success" | "warning" | "error"; confirm?: boolean; confirmLabel?: string };
type ShowDialog = (options: DialogOptions) => Promise<boolean>;
const DialogContext = createContext<ShowDialog | null>(null);

export function useAppDialog() {
  const show = useContext(DialogContext);
  if (!show) throw new Error("AppDialogProvider no está disponible.");
  return show;
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<{ resolve: (accepted: boolean) => void; promise: Promise<boolean>; options: DialogOptions } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const show = useCallback<ShowDialog>(function show(next: DialogOptions): Promise<boolean> {
    if (pending.current) {
      if (!next.confirm && !pending.current.options.confirm && next.title === pending.current.options.title && next.message === pending.current.options.message) return pending.current.promise;
      if (!next.confirm) return pending.current.promise.then(() => show(next));
      return Promise.resolve(false);
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let resolve!: (accepted: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    pending.current = { resolve, promise, options: next };
    setOptions(next);
    return promise;
  }, []);

  const finish = useCallback((accepted: boolean) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    dialog.current?.close();
    setOptions(null);
    current.resolve(accepted);
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    previousFocus.current = null;
  }, []);

  useEffect(() => {
    if (options && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [options]);
  useEffect(() => () => { pending.current?.resolve(false); pending.current = null; }, []);

  const Icon = options?.tone === "error" ? AlertCircle : options?.tone === "success" ? CheckCircle2 : options?.tone === "info" ? Info : AlertTriangle;
  return <DialogContext.Provider value={show}>
    {children}
    {options ? <dialog ref={dialog} className="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" onCancel={(event) => { event.preventDefault(); finish(false); }}>
      <div className={`app-dialog-icon is-${options.tone ?? "warning"}`}><Icon aria-hidden="true" /></div>
      <h2 id="app-dialog-title">{options.title}</h2>
      <p id="app-dialog-message">{options.message}</p>
      <div className="app-dialog-actions">
        {options.confirm ? <button type="button" className="app-dialog-cancel" autoFocus onClick={() => finish(false)}>Cancelar</button> : null}
        <button type="button" className="app-dialog-confirm" autoFocus={!options.confirm} onClick={() => finish(true)}>{options.confirmLabel ?? (options.confirm ? "Confirmar" : "Entendido")}</button>
      </div>
    </dialog> : null}
  </DialogContext.Provider>;
}
