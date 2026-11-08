ALTER TABLE "movimiento_caja"
  ADD COLUMN "fecha_movimiento" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();
