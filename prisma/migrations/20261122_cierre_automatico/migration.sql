-- El cierre automático no representa un conteo físico de efectivo.
ALTER TABLE "apertura_caja"
  ADD COLUMN IF NOT EXISTS "cierre_automatico" BOOLEAN NOT NULL DEFAULT false;
