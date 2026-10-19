import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureUserCompany } from "@/lib/company";
import { rutSchema } from "@/lib/rut";

const optionalText = (max: number) =>
  z.string().trim().max(max).refine((value) => !/['"]/.test(value));

const companySchema = z.object({
  rut: rutSchema,
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
  nombre_fantasia: string;
  rut: string;
  nombre: string;
  giro: string | null;
  actividad: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
};

async function getUserId(correo: string) {
  const [user] = await prisma.$queryRaw<UserRow[]>`
    SELECT id::text AS id FROM users WHERE correo = ${correo} LIMIT 1
  `;
  return user?.id;
}

function toCompany(row?: CompanyRow) {
  return {
    rut: row?.rut ?? "",
    nombre: row?.nombre ?? "",
    nombreFantasia: row?.nombre_fantasia ?? "Carpediem",
    giro: row?.giro ?? "",
    actividad: row?.actividad ?? "",
    email: row?.email ?? "",
    telefono: row?.telefono ?? "",
    direccion: row?.direccion ?? "",
    comuna: row?.comuna ?? "",
  };
}

export const GET = withAuth(async (request) => {
  try {
    const userId = await getUserId(request.correo);
    if (!userId) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    const company = await ensureUserCompany(userId);
    const [row] = await prisma.$queryRaw<CompanyRow[]>`
      SELECT nombre_fantasia, rut, nombre, giro, actividad, email,
             telefono, direccion, comuna
      FROM empresa
      WHERE id_empresa = ${company.id}::uuid
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

    const company = await ensureUserCompany(userId);
    const { rut, nombreFantasia, giro, actividad, email, telefono, direccion, comuna } = input.data;
    const [row] = await prisma.$queryRaw<CompanyRow[]>`
      UPDATE empresa SET
        rut = ${rut},
        nombre_fantasia = ${nombreFantasia},
        giro = ${giro || null},
        actividad = ${actividad || null},
        email = ${email || null},
        telefono = ${telefono || null},
        direccion = ${direccion || null},
        comuna = ${comuna || null}
      WHERE id_empresa = ${company.id}::uuid
      RETURNING nombre_fantasia, rut, nombre, giro, actividad, email,
                telefono, direccion, comuna
    `;

    return NextResponse.json({ company: toCompany(row) });
  } catch (error) {
    console.error("Error al guardar datos de empresa:", error);
    return NextResponse.json({ message: "No se pudieron guardar los datos de empresa." }, { status: 500 });
  }
});
