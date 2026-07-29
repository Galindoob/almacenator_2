import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

export type JwtPayload = {
  nombre: string;
  apellido: string;
  correo: string;
  rol: string;
};

export type AuthenticatedRequest = NextRequest & JwtPayload & { role: string };

export function validateJwtToken(token: string): JwtPayload | null {
  const secretKey = process.env.SECRET_KEY;

  if (!secretKey) {
    throw new Error("SECRET_KEY no está configurado.");
  }

  try {
    return jwt.verify(token, secretKey) as JwtPayload;
  } catch {
    return null;
  }
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<Response> | Response,
) {
  return (request: NextRequest) => {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : request.headers.get("token");

    if (!token) {
      return NextResponse.json(
        { status: "error", message: "Token no enviado." },
        { status: 401 },
      );
    }

    const payload = validateJwtToken(token);

    if (!payload) {
      return NextResponse.json(
        { status: "error", message: "Token inválido o expirado." },
        { status: 401 },
      );
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.nombre = payload.nombre;
    authenticatedRequest.apellido = payload.apellido;
    authenticatedRequest.correo = payload.correo;
    authenticatedRequest.rol = payload.rol;
    authenticatedRequest.role = payload.rol;

    return handler(authenticatedRequest);
  };
}
