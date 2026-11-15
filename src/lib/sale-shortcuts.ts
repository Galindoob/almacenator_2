import { z } from "zod";

export const shortcutKeys = ["F2", "F3", "F4", "F6", "F7", "F8", "F9"] as const;
export const defaultSaleShortcuts = { buscar: "F2", efectivo: "F4", debito: "F8" } as const;
export const saleShortcutsSchema = z.object({
  buscar: z.enum(shortcutKeys),
  efectivo: z.enum(shortcutKeys),
  debito: z.enum(shortcutKeys),
}).refine((value) => new Set(Object.values(value)).size === 3, {
  message: "Cada acción debe tener una tecla diferente.",
});
export type SaleShortcuts = z.infer<typeof saleShortcutsSchema>;
