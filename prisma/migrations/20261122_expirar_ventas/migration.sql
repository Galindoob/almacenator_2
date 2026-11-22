ALTER TABLE venta ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS venta_pendiente_actividad_idx ON venta (ultima_actividad) WHERE estado = 'pendiente';
