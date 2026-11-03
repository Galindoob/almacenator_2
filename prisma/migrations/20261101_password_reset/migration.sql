CREATE TABLE "password_reset" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified_at" TIMESTAMPTZ(6),
  "used_at" TIMESTAMPTZ(6),
  CONSTRAINT "password_reset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "password_reset_user_id_created_at_idx" ON "password_reset"("user_id", "created_at");
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
