import { z } from "zod";

function compactRut(value: string) {
  return value.replace(/[.\-\s]/g, "").toUpperCase();
}

export function formatRut(value: string) {
  const compact = compactRut(value);
  if (compact.length < 2) return compact;

  const body = compact.slice(0, -1).replace(/\D/g, "");
  const verifier = compact.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${verifier}`;
}

export function hasValidRutVerifier(value: string) {
  const compact = compactRut(value);
  if (!/^\d{7,8}[\dK]$/.test(compact)) return false;

  const body = compact.slice(0, -1);
  const providedVerifier = compact.slice(-1);
  let multiplier = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  const expectedVerifier = result === 11 ? "0" : result === 10 ? "K" : String(result);
  return providedVerifier === expectedVerifier;
}

export const rutSchema = z
  .string()
  .trim()
  .min(9, "El RUT debe tener al menos 9 caracteres.")
  .max(12, "El RUT no puede superar los 12 caracteres.")
  .regex(/^[\d.kK-]+$/, "Usa un RUT como 20.275.335-3.")
  .refine(hasValidRutVerifier, "El dígito verificador del RUT no es válido.")
  .transform(formatRut);
