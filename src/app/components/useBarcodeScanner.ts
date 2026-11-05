"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

type ScanBuffer = { value: string; lastKeyAt: number; fastKeys: number };
const emptyBuffer = (): ScanBuffer => ({ value: "", lastKeyAt: 0, fastKeys: 0 });

/** Readers in keyboard mode send characters, often followed by Enter or Tab. */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  const globalBuffer = useRef<ScanBuffer>(emptyBuffer());
  const inputBuffer = useRef<ScanBuffer>(emptyBuffer());
  const globalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing ||
        (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']")))) {
        globalBuffer.current = emptyBuffer();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const code = globalBuffer.current.value;
        globalBuffer.current = emptyBuffer();
        if (globalTimer.current) clearTimeout(globalTimer.current);
        if (code.length >= 4) { event.preventDefault(); event.stopPropagation(); onScanRef.current(code); }
        return;
      }
      if (event.key.length !== 1 || /['"]/.test(event.key)) return;
      const now = performance.now();
      const previous = globalBuffer.current;
      const value = now - previous.lastKeyAt < 250 ? previous.value + event.key : event.key;
      globalBuffer.current = { value: value.slice(-60), lastKeyAt: now,
        fastKeys: now - previous.lastKeyAt < 90 ? previous.fastKeys + 1 : 1 };
      if (globalTimer.current) clearTimeout(globalTimer.current);
      globalTimer.current = setTimeout(() => {
        const scanned = globalBuffer.current;
        globalBuffer.current = emptyBuffer();
        if (scanned.fastKeys >= 6) onScanRef.current(scanned.value);
      }, 300);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (globalTimer.current) clearTimeout(globalTimer.current);
      globalBuffer.current = emptyBuffer();
    };
  }, [enabled]);

  useEffect(() => () => { if (inputTimer.current) clearTimeout(inputTimer.current); }, []);

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!enabled) return;
    if (event.key === "Enter" || event.key === "Tab") {
      const code = event.currentTarget.value.trim();
      const fast = inputBuffer.current.fastKeys >= 4;
      inputBuffer.current = emptyBuffer();
      if (inputTimer.current) clearTimeout(inputTimer.current);
      if (code && (event.key === "Enter" || fast)) {
        event.preventDefault();
        onScanRef.current(code);
        event.currentTarget.select();
      }
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey || /['"]/.test(event.key)) return;
    const input = event.currentTarget;
    const now = performance.now();
    const previous = inputBuffer.current;
    const fast = now - previous.lastKeyAt < 90;
    inputBuffer.current = { value: fast ? previous.value + event.key : event.key,
      lastKeyAt: now, fastKeys: fast ? previous.fastKeys + 1 : 1 };
    if (inputTimer.current) clearTimeout(inputTimer.current);
    inputTimer.current = setTimeout(() => {
      const scanned = inputBuffer.current;
      inputBuffer.current = emptyBuffer();
      if (scanned.fastKeys >= 6 && input.value.trim() === scanned.value) {
        onScanRef.current(scanned.value);
        input.select();
      }
    }, 160);
  }

  return { onSearchKeyDown };
}
