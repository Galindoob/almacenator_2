ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "productos_stock_minimo_check";
ALTER TABLE "productos" DROP COLUMN IF EXISTS "stock_minimo";
