CREATE TABLE "empresa" (
    "id_empresa" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_fantasia" VARCHAR(25) NOT NULL,
    "rut" VARCHAR(12) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "giro" VARCHAR(120),
    "actividad" VARCHAR(120),
    "email" VARCHAR(255),
    "telefono" VARCHAR(50),
    "direccion" VARCHAR(200),
    "comuna" VARCHAR(100),

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id_empresa"),
    CONSTRAINT "empresa_rut_key" UNIQUE ("rut")
);

INSERT INTO "empresa" (
    "nombre_fantasia",
    "rut",
    "nombre",
    "giro",
    "actividad",
    "email",
    "telefono",
    "direccion",
    "comuna"
) VALUES (
    'Carpediem',
    '12345-6',
    'galindo incorporation',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
);

ALTER TABLE "configuracion_usuario" ADD COLUMN "empresa" UUID;

UPDATE "configuracion_usuario"
SET "empresa" = (SELECT "id_empresa" FROM "empresa" LIMIT 1);

INSERT INTO "configuracion_usuario" ("id_usuario", "empresa")
SELECT "users"."id", "empresa"."id_empresa"
FROM "users"
CROSS JOIN "empresa"
ON CONFLICT ("id_usuario") DO UPDATE
SET "empresa" = EXCLUDED."empresa";

ALTER TABLE "configuracion_usuario" ALTER COLUMN "empresa" SET NOT NULL;

ALTER TABLE "configuracion_usuario"
    ADD CONSTRAINT "fk_configuracion_usuario_empresa"
    FOREIGN KEY ("empresa") REFERENCES "empresa"("id_empresa")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "configuracion_usuario"
    DROP COLUMN "nombre_tienda",
    DROP COLUMN "empresa_rut",
    DROP COLUMN "empresa_nombre",
    DROP COLUMN "empresa_giro",
    DROP COLUMN "empresa_actividad",
    DROP COLUMN "empresa_email",
    DROP COLUMN "empresa_telefono",
    DROP COLUMN "empresa_direccion",
    DROP COLUMN "empresa_comuna";
