DO $$
DECLARE
  master_role_id UUID;
BEGIN
  SELECT id INTO master_role_id FROM "role" WHERE "role" = 'master';
  IF master_role_id IS NULL THEN
    RAISE EXCEPTION 'El rol master no existe.';
  END IF;

  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS "users_one_master_idx" ON "users" ("roleid") WHERE "roleid" = %L::uuid',
    master_role_id
  );
END $$;

CREATE OR REPLACE FUNCTION prevent_master_role_move()
RETURNS trigger AS $$
BEGIN
  IF OLD."roleid" = (SELECT "id" FROM "role" WHERE "role" = 'master')
     AND NEW."roleid" IS DISTINCT FROM OLD."roleid" THEN
    RAISE EXCEPTION 'El rol master no se puede mover.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "users_prevent_master_role_move" ON "users";
CREATE TRIGGER "users_prevent_master_role_move"
BEFORE UPDATE OF "roleid" ON "users"
FOR EACH ROW EXECUTE FUNCTION prevent_master_role_move();
