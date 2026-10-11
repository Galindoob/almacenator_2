import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const optionalText = (max: number) =>
  z.string().trim().max(max).refine((value) => !/['"]/.test(value));

const companySchema = z.object({
  rut: optionalText(12).refine(
    (value) => !value || /^(?:\d{1,8}|\d{1,2}(?:\.\d{3}){2})-[\dkK]$/.test(value),
    "Ingresa un RUT con formato 12345678-9.",
  ),
  nombre: optionalText(120),
  nombreFantasia: z.string().trim().min(1).max(25).refine((value) => !/['"]/.test(value)),
  giro: optionalText(120),
  actividad: optionalText(120),
  email: optionalText(255).refine(
    (value) => !value || z.email().safeParse(value).success,
    "Ingresa un correo válido.",
  ),
  telefono: optionalText(50),
  direccion: optionalText(200),
  comuna: optionalText(100),
});

type UserRow = { id: string };
type CompanyRow = {
  nombre_tienda: string;
  empresa_rut: string | null;
  empresa_nombre: string | null;
  empresa_giro: string | null;
  empresa_actividad: string | null;
  empresa_email: string | null;
  empresa_telefono: string | null;
  empresa_direccion: string | null;
  empresa_comuna: string | null;
};

async function getUserId(correo: string) {
  const [user] = await prisma.$queryRaw<UserRow[]>`
    SELECT id::text AS id FROM users WHERE correo = ${correo} LIMIT 1
  `;
  return user?.id;
}

function toCompany(row?: CompanyRow) {
  return {
    rut: row?.empresa_rut ?? "",
    nombre: row?.empresa_nombre ?? "",
    nombreFantasia: row?.nombre_tienda ?? "nombre_tienda",
    giro: row?.empresa_giro ?? "",
    actividad: row?.empresa_actividad ?? "",
    email: row?.empresa_email ?? "",
    telefono: row?.empresa_telefono ?? "",
    direccion: row?.empresa_direccion ?? "",
    comuna: row?.empresa_comuna ?? "",
  };
}

export const GET = withAuth(async (request) => {
  try {
    const userId = await getUserId(request.correo);
    if (!userId) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const [row] = await prisma.$queryRaw<CompanyRow[]>`
      SELECT nombre_tienda, empresa_rut, empresa_nombre, empresa_giro,
             empresa_actividad, empresa_email, empresa_telefono,
             empresa_direccion, empresa_comuna
      FROM configuracion_usuario
      WHERE id_usuario = ${userId}::uuid
      LIMIT 1
    `;
    return NextResponse.json({ company: toCompany(row) });
  } catch (error) {
    console.error("Error al cargar datos de empresa:", error);
    return NextResponse.json({ message: "No se pudieron cargar los datos de empresa." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  const input = companySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(
      { message: input.error.issues[0]?.message ?? "Revisa los datos de empresa." },
      { status: 400 },
    );
  }

  try {
    const userId = await getUserId(request.correo);
    if (!userId) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const { rut, nombre, nombreFantasia, giro, actividad, email, telefono, direccion, comuna } = input.data;
    const [row] = await prisma.$queryRaw<CompanyRow[]>`
      INSERT INTO configuracion_usuario (
        id_usuario, nombre_tienda, empresa_rut, empresa_nombre, empresa_giro,
        empresa_actividad, empresa_email, empresa_telefono, empresa_direccion,
        empresa_comuna, actualizado
      ) VALUES (
        ${userId}::uuid, ${nombreFantasia}, ${rut.replaceAll(".", "").toUpperCase() || null},
        ${nombre || null}, ${giro || null}, ${actividad || null}, ${email || null},
        ${telefono || null}, ${direccion || null}, ${comuna || null}, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id_usuario) DO UPDATE SET
        nombre_tienda = EXCLUDED.nombre_tienda,
        empresa_rut = EXCLUDED.empresa_rut,
        empresa_nombre = EXCLUDED.empresa_nombre,
        empresa_giro = EXCLUDED.empresa_giro,
        empresa_actividad = EXCLUDED.empresa_actividad,
        empresa_email = EXCLUDED.empresa_email,
        empresa_telefono = EXCLUDED.empresa_telefono,
        empresa_direccion = EXCLUDED.empresa_direccion,
        empresa_comuna = EXCLUDED.empresa_comuna,
        actualizado = CURRENT_TIMESTAMP
      RETURNING nombre_tienda, empresa_rut, empresa_nombre, empresa_giro,
                empresa_actividad, empresa_email, empresa_telefono,
                empresa_direccion, empresa_comuna
    `;

    return NextResponse.json({ company: toCompany(row) });
  } catch (error) {
    console.error("Error al guardar datos de empresa:", error);
    return NextResponse.json({ message: "No se pudieron guardar los datos de empresa." }, { status: 500 });
  }
});
