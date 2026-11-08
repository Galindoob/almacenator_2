CREATE UNIQUE INDEX "apertura_caja_solo_una_abierta_idx"
ON "apertura_caja" ((true))
WHERE "horario_cierre" IS NULL;
