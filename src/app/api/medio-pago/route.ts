import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = withAuth(async () => {
  try {
    const paymentMethods = await prisma.medio_pago.findMany({
      select: { id_medio: true, medio_de_pago: true },
      orderBy: { medio_de_pago: "asc" },
    });

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error("Error al consultar medios de pago:", error);
    return NextResponse.json({ message: "No se pudieron cargar los medios de pago." }, { status: 500 });
  }
});
