import { prisma } from "@/lib/db";

export type UserCompany = {
  id: string;
  name: string;
};

export async function ensureUserCompany(userId: string): Promise<UserCompany> {
  const [company] = await prisma.$queryRaw<UserCompany[]>`
    WITH company_to_assign AS (
      SELECT COALESCE(
        (SELECT empresa FROM configuracion_usuario WHERE id_usuario = ${userId}::uuid),
        (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
      ) AS id_empresa
    ), assigned AS (
      INSERT INTO configuracion_usuario (id_usuario, empresa)
      SELECT ${userId}::uuid, id_empresa
      FROM company_to_assign
      WHERE id_empresa IS NOT NULL
      ON CONFLICT (id_usuario) DO UPDATE SET
        empresa = configuracion_usuario.empresa
      RETURNING empresa
    )
    SELECT e.id_empresa::text AS id, e.nombre_fantasia AS name
    FROM empresa e
    JOIN assigned a ON a.empresa = e.id_empresa
    LIMIT 1
  `;

  if (!company) {
    throw new Error("No existe una empresa configurada.");
  }

  return company;
}
