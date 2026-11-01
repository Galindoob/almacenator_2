ALTER TABLE "detalle" ADD COLUMN "precio_lista_actual" INTEGER;
UPDATE "detalle" SET "precio_lista_actual" = "precio_actual";
ALTER TABLE "detalle" ALTER COLUMN "precio_lista_actual" SET NOT NULL;
ALTER TABLE "detalle" ADD COLUMN "promocion_nombre" VARCHAR(150);
ALTER TABLE "detalle" ADD COLUMN "promocion_condicion" VARCHAR(200);
