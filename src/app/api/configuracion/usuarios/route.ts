import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = withAuth(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        role: { select: { role: true } },
      },
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.role.role,
      })),
    });
  } catch (error) {
    console.error("Error al consultar usuarios:", error);
    return NextResponse.json({ message: "No se pudieron cargar los usuarios." }, { status: 500 });
  }
});
