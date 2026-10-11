import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSafeAppInput } from "@/lib/input-validation";

const preferencesSchema = z.object({
  colorTheme: z.enum(["green", "blue", "orange", "sky"]),
  fontScale: z.number().finite().min(0.85).max(1.2),
  storeName: z.string().trim().min(1).max(25).refine(isSafeAppInput),
  highContrast: z.boolean().optional(),
  darkMode: z.boolean().optional(),
});

type UserRow = { id: string };
type PreferencesRow = {
  tema: "green" | "blue" | "orange" | "sky";
  escala_fuente: number;
  nombre_tienda: string;
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

    const [row] = await prisma.$queryRaw<PreferencesRow[]>`
      SELECT tema, escala_fuente, nombre_tienda, alto_contraste, modo_oscuro
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
            storeName: row.nombre_tienda,
            highContrast: row.alto_contraste,
            darkMode: row.modo_oscuro,
          }
        : { colorTheme: "green", fontScale: 1, storeName: "nombre_tienda", highContrast: false, darkMode: false },
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
      { message: "Revisa el tema, tamaño de letra y nombre de tienda." },
      { status: 400 },
    );
  }

  try {
    const userId = await getUserId(request.correo);
    if (!userId) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const { colorTheme, fontScale, storeName, highContrast, darkMode } = input.data;
    const [row] = await prisma.$queryRaw<PreferencesRow[]>`
      INSERT INTO configuracion_usuario (id_usuario, tema, escala_fuente, nombre_tienda, alto_contraste, modo_oscuro, actualizado)
      VALUES (${userId}::uuid, ${colorTheme}, ${fontScale}, ${storeName}, ${highContrast ?? false}, ${darkMode ?? false}, CURRENT_TIMESTAMP)
      ON CONFLICT (id_usuario) DO UPDATE SET
        tema = EXCLUDED.tema,
        escala_fuente = EXCLUDED.escala_fuente,
        nombre_tienda = EXCLUDED.nombre_tienda,
        alto_contraste = COALESCE(${highContrast ?? null}, configuracion_usuario.alto_contraste),
        modo_oscuro = COALESCE(${darkMode ?? null}, configuracion_usuario.modo_oscuro),
        actualizado = CURRENT_TIMESTAMP
      RETURNING tema, escala_fuente, nombre_tienda, alto_contraste, modo_oscuro
    `;

    return NextResponse.json({
      saved: true,
      preferences: {
        colorTheme: row.tema,
        fontScale: row.escala_fuente,
        storeName: row.nombre_tienda,
        highContrast: row.alto_contraste,
        darkMode: row.modo_oscuro,
      },
    });
  } catch (error) {
    console.error("Error al guardar configuración:", error);
    return NextResponse.json({ message: "No se pudo guardar la configuración." }, { status: 500 });
  }
});
