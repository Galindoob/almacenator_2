ALTER TABLE "productos" ADD COLUMN "stock_minimo" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "productos" ADD CONSTRAINT "productos_stock_minimo_check" CHECK ("stock_minimo" >= 0 AND "stock_minimo" <= 1000000);
