ALTER TABLE "apertura_caja"
  ALTER COLUMN "horario_apertura" TYPE TIMESTAMPTZ(6) USING "horario_apertura" AT TIME ZONE 'UTC',
  ALTER COLUMN "horario_cierre" TYPE TIMESTAMPTZ(6) USING "horario_cierre" AT TIME ZONE 'UTC';
