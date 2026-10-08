import { z } from "zod";

export const unsafeInputMessage =
  "Los campos no pueden incluir comillas ni superar los 25 caracteres.";
export const unsafeDescriptionMessage =
  "Las descripciones no pueden incluir comillas ni superar los 200 caracteres.";

export class AppInputValidationError extends Error {
  constructor(message = unsafeInputMessage) {
    super(message);
    this.name = "AppInputValidationError";
  }
}

export const appTextInputSchema = z
  .string()
  .max(60, unsafeInputMessage)
  .refine((value) => !/['"]/.test(value), unsafeInputMessage);

export const appDescriptionInputSchema = z
  .string()
  .max(200, unsafeDescriptionMessage)
  .refine((value) => !/['"]/.test(value), unsafeDescriptionMessage);

export function isSafeAppInput(value: string) {
  return appTextInputSchema.safeParse(value).success;
}

export function isSafeDescriptionInput(value: string) {
  return appDescriptionInputSchema.safeParse(value).success;
}

export function assertSafeAppInput(value: string) {
  if (!isSafeAppInput(value)) {
    throw new AppInputValidationError();
  }
}

export function assertSafeDescriptionInput(value: string) {
  if (!isSafeDescriptionInput(value)) {
    throw new AppInputValidationError(unsafeDescriptionMessage);
  }
}

function isDescriptionKey(key: string) {
  return ["descripcion", "description"].includes(key);
}

export function assertSafePayloadText(value: unknown, key = "") {
  if (typeof value === "string") {
    if (isDescriptionKey(key)) {
      assertSafeDescriptionInput(value);
    } else {
      assertSafeAppInput(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafePayloadText(item, key);
    }
    return;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [entryKey, item] of Object.entries(value)) {
      assertSafePayloadText(item, entryKey);
    }
  }
}

export function getSafeFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  if (isDescriptionKey(key)) {
    assertSafeDescriptionInput(value);
  } else {
    assertSafeAppInput(value);
  }

  return value;
}
