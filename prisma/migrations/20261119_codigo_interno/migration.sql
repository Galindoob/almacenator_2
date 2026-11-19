ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_interno VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_interno_key ON productos (codigo_interno);
CREATE OR REPLACE FUNCTION minigest_validar_codigos_producto() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(79104002);
  IF NEW.codigo_interno IS NOT NULL AND NEW.codigo_interno !~ '^[0-9]{4,30}$' THEN
    RAISE EXCEPTION 'Código interno inválido' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM productos p WHERE p.id_productos <> NEW.id_productos AND
    ((NEW.codigo_interno IS NOT NULL AND (p.codigo_interno = NEW.codigo_interno OR p.codigo_barra = NEW.codigo_interno)) OR
     (NEW.codigo_barra IS NOT NULL AND p.codigo_interno = NEW.codigo_barra))) THEN
    RAISE EXCEPTION 'El código ya pertenece a otro producto' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS minigest_codigos_producto ON productos;
CREATE TRIGGER minigest_codigos_producto BEFORE INSERT OR UPDATE OF codigo_interno, codigo_barra ON productos
FOR EACH ROW EXECUTE FUNCTION minigest_validar_codigos_producto();
