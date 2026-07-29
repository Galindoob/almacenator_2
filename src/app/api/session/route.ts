import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/auth";

export const GET = withAuth((request: AuthenticatedRequest) => {
  return NextResponse.json({
    status: "ok",
    user: {
      nombre: request.nombre,
      apellido: request.apellido,
      correo: request.correo,
      rol: request.rol,
      role: request.role,
    },
  });
});
