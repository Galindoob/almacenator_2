import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_BYTES = 72;

export function passwordCharacterCount(value: string) {
  return Array.from(value).length;
}

export function passwordByteCount(value: string) {
  return new TextEncoder().encode(value).length;
}

export const authEmailSchema = z
  .string()
  .trim()
  .max(255, "El correo no puede superar los 255 caracteres.")
  .refine((value) => !/['"]/.test(value), "El correo no puede incluir comillas.")
  .pipe(z.email("Ingresa un correo válido, por ejemplo nombre@dominio.cl."));

export const registrationPasswordSchema = z
  .string()
  .refine(
    (value) => passwordCharacterCount(value) >= MIN_PASSWORD_LENGTH,
    `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  )
  .refine(
    (value) => passwordByteCount(value) <= MAX_PASSWORD_BYTES,
    `La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes.`,
  );
