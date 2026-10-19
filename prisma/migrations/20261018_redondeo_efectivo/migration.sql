ALTER TABLE venta ADD COLUMN redondeo INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT venta_redondeo_check CHECK (redondeo BETWEEN -5 AND 4);

-- A positive balance of $1-$5 can be settled with $0 after cash rounding.
ALTER TABLE pagos DROP CONSTRAINT pagos_pago_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_pago_check CHECK (pago >= 0);
