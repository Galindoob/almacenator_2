INSERT INTO "role" ("id", "role")
VALUES
  (gen_random_uuid(), 'master'),
  (gen_random_uuid(), 'usuario')
ON CONFLICT ("role") DO NOTHING;
