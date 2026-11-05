import { z } from "zod";
import { appTextInputSchema } from "@/lib/input-validation";
import { MAX_PASSWORD_BYTES, passwordByteCount, registrationPasswordSchema } from "@/lib/auth-validation";

export const accountChangeSchema = z.object({
  nombre: appTextInputSchema.trim().min(1, "Ingresa tu nombre.").max(25, "El nombre no puede superar los 25 caracteres."),
  contrasenaActual: z.string().min(1, "Ingresa tu contraseña actual.").refine(
    (value) => passwordByteCount(value) <= MAX_PASSWORD_BYTES,
    `La contraseña actual no puede superar ${MAX_PASSWORD_BYTES} bytes.`,
  ),
  nuevaContrasena: z.string(),
  repetirContrasena: z.string(),
}).superRefine((value, context) => {
  if (!value.nuevaContrasena && !value.repetirContrasena) return;
  const password = registrationPasswordSchema.safeParse(value.nuevaContrasena);
  if (!password.success) {
    for (const issue of password.error.issues) {
      context.addIssue({ code: "custom", path: ["nuevaContrasena"], message: issue.message });
    }
  }
  if (value.nuevaContrasena !== value.repetirContrasena) {
    context.addIssue({ code: "custom", path: ["repetirContrasena"], message: "Las contraseñas no coinciden." });
  }
});
