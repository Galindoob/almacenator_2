-- Keep the original unit price in precio_actual. The amount actually charged is subtotal_venta.
UPDATE "detalle" SET "precio_actual" = "precio_lista_actual";
ALTER TABLE "detalle" DROP COLUMN "precio_lista_actual";

-- A product may participate in only one promotion.
CREATE UNIQUE INDEX "promociones_id_productos_key" ON "promociones"("id_productos");
