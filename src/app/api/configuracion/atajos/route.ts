import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { ensureUserCompany } from "@/lib/company";
import { getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { saleShortcutsSchema } from "@/lib/sale-shortcuts";

export const GET = withAuth(async (request) => {
  try {
    const access = await getUserPermissions(request.correo);
    if (!access) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    const company = await ensureUserCompany(access.user.id);
    const [row] = await prisma.$queryRaw<{ buscar: string; efectivo: string; debito: string }[]>`
      SELECT atajo_buscar AS buscar, atajo_efectivo AS efectivo, atajo_debito AS debito
      FROM empresa WHERE id_empresa = ${company.id}::uuid
    `;
    const parsed = saleShortcutsSchema.safeParse(row);
    if (!parsed.success) throw new Error("La configuración de atajos no es válida.");
    return NextResponse.json({ shortcuts: parsed.data, canEdit: ["admin", "master"].includes(access.role) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error consultando atajos:", error);
    return NextResponse.json({ message: "No se pudieron cargar los atajos." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  const parsed = saleShortcutsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Atajos inválidos." }, { status: 400 });
  try {
    const access = await getUserPermissions(request.correo);
    if (!access) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
    if (!["admin", "master"].includes(access.role)) return NextResponse.json({ message: "Solo administradores y master pueden modificar los atajos." }, { status: 403 });
    const company = await ensureUserCompany(access.user.id);
    const { buscar, efectivo, debito } = parsed.data;
    const count = await prisma.$executeRaw`
      UPDATE empresa SET atajo_buscar = ${buscar}, atajo_efectivo = ${efectivo}, atajo_debito = ${debito}
      WHERE id_empresa = ${company.id}::uuid
    `;
    if (count !== 1) return NextResponse.json({ message: "No se encontró la empresa." }, { status: 404 });
    return NextResponse.json({ shortcuts: parsed.data, message: "Atajos guardados correctamente." });
  } catch (error) {
    console.error("Error guardando atajos:", error);
    return NextResponse.json({ message: "No se pudieron guardar los atajos." }, { status: 500 });
  }
});
