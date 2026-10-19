import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSafeAppInput } from "@/lib/input-validation";
import { ensureUserCompany } from "@/lib/company";

const preferencesSchema = z.object({
  colorTheme: z.enum(["green", "blue", "orange", "sky"]),
  fontScale: z.number().finite().min(0.85).max(1.2),
  interfaceScale: z.number().finite().min(0.8).max(1.2).optional(),
  storeName: z.string().trim().min(1).max(25).refine(isSafeAppInput).optional(),
  highContrast: z.boolean().optional(),
  darkMode: z.boolean().optional(),
});

type UserRow = { id: string };
type PreferencesRow = {
  tema: "green" | "blue" | "orange" | "sky";
  escala_fuente: number;
  escala_interfaz: number;
  alto_contraste: boolean;
  modo_oscuro: boolean;
};

async function getUserId(correo: string) {
  const [user] = await prisma.$queryRaw<UserRow[]>`
    SELECT id::text AS id FROM users WHERE correo = ${correo} LIMIT 1
  `;
  return user?.id;
}

export const GET = withAuth(async (request) => {
  try {
    const userId = await getUserId(request.correo);
    if (!userId) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const company = await ensureUserCompany(userId);
    const [row] = await prisma.$queryRaw<PreferencesRow[]>`
      SELECT tema, escala_fuente, escala_interfaz, alto_contraste, modo_oscuro
      FROM configuracion_usuario
      WHERE id_usuario = ${userId}::uuid
      LIMIT 1
    `;

    return NextResponse.json({
      saved: Boolean(row),
      preferences: row
        ? {
            colorTheme: row.tema,
            fontScale: row.escala_fuente,
            interfaceScale: row.escala_interfaz,
            storeName: company.name,
            highContrast: row.alto_contraste,
            darkMode: row.modo_oscuro,
          }
        : { colorTheme: "green", fontScale: 1, interfaceScale: 1, storeName: company.name, highContrast: false, darkMode: false },
    });
  } catch (error) {
    console.error("Error al consultar configuración:", error);
    return NextResponse.json({ message: "No se pudo cargar la configuración." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  const input = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(
      { message: "Revisa el tema, tamaño de letra, tamaño de interfaz y nombre de tienda." },
      { status: 400 },
    );
  }

  try {
    const userId = await getUserId(request.correo);
    if (!userId) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const company = await ensureUserCompany(userId);
    const { colorTheme, fontScale, interfaceScale, highContrast, darkMode } = input.data;
    const [row] = await prisma.$queryRaw<PreferencesRow[]>`
      INSERT INTO configuracion_usuario (id_usuario, empresa, tema, escala_fuente, escala_interfaz, alto_contraste, modo_oscuro, actualizado)
      VALUES (${userId}::uuid, ${company.id}::uuid, ${colorTheme}, ${fontScale}, ${interfaceScale ?? 1}, ${highContrast ?? false}, ${darkMode ?? false}, CURRENT_TIMESTAMP)
      ON CONFLICT (id_usuario) DO UPDATE SET
        tema = EXCLUDED.tema,
        escala_fuente = EXCLUDED.escala_fuente,
        escala_interfaz = COALESCE(${interfaceScale ?? null}, configuracion_usuario.escala_interfaz),
        alto_contraste = COALESCE(${highContrast ?? null}, configuracion_usuario.alto_contraste),
        modo_oscuro = COALESCE(${darkMode ?? null}, configuracion_usuario.modo_oscuro),
        actualizado = CURRENT_TIMESTAMP
      RETURNING tema, escala_fuente, escala_interfaz, alto_contraste, modo_oscuro
    `;

    return NextResponse.json({
      saved: true,
      preferences: {
        colorTheme: row.tema,
        fontScale: row.escala_fuente,
        interfaceScale: row.escala_interfaz,
        storeName: company.name,
        highContrast: row.alto_contraste,
        darkMode: row.modo_oscuro,
      },
    });
  } catch (error) {
    console.error("Error al guardar configuración:", error);
    return NextResponse.json({ message: "No se pudo guardar la configuración." }, { status: 500 });
  }
});
