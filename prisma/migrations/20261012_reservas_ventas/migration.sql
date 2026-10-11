ALTER TABLE venta ADD COLUMN clave_cliente UUID UNIQUE,
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN clave_operacion UUID UNIQUE;
ALTER TABLE detalle ADD CONSTRAINT detalle_id_venta_id_producto_key UNIQUE (id_venta, id_producto);
ALTER TABLE instancia_producto ADD COLUMN id_detalle_reserva UUID,
  ADD CONSTRAINT instancia_producto_id_detalle_reserva_fkey
  FOREIGN KEY (id_detalle_reserva) REFERENCES detalle(id_detalle) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX instancia_producto_id_detalle_reserva_idx ON instancia_producto(id_detalle_reserva);
CREATE INDEX venta_pendiente_vendedor_idx ON venta(id_vendedor) WHERE estado = 'pendiente';
