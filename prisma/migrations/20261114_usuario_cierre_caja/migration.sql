ALTER TABLE "apertura_caja" ADD COLUMN IF NOT EXISTS "id_usuario_cierre" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_caja_usuario_cierre' AND conrelid = 'apertura_caja'::regclass) THEN
    ALTER TABLE "apertura_caja" ADD CONSTRAINT "fk_caja_usuario_cierre"
      FOREIGN KEY ("id_usuario_cierre") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
