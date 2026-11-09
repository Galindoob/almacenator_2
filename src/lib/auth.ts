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
  return async (request: NextRequest) => {
    const token = request.cookies.get("minigest_login")?.value;

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

    const path = request.nextUrl.pathname;
    const method = request.method;
    let required: string[] = [];
    if (path === "/api/producto") required = method === "GET" ? ["productos_ver", "ventas_crear", "proveedores_ver", "promociones_crear", "precios_ver"] : method === "POST" ? ["productos_crear"] : ["productos_editar"];
    else if (path === "/api/movimiento-stock") {
      if (method === "GET") required = ["productos_ver"];
      else {
        const body = await request.clone().json().catch(() => null) as { tipo?: number | string } | null;
        const type = Number(body?.tipo);
        if (type !== 1 && type !== 2) return NextResponse.json({ message: "Tipo de movimiento inválido." }, { status: 400 });
        required = type === 2 ? ["productos_stock"] : ["productos_merma"];
      }
    } else if (path === "/api/producto-vencimiento") required = method === "GET" ? ["vencimiento_ver"] : ["productos_merma"];
    else if (path.startsWith("/api/proveedores")) required = method === "GET" ? ["proveedores_ver"] : ["proveedores_editar"];
    else if (path === "/api/ventas") required = ["ventas_crear"];
    else if (path.startsWith("/api/reportes")) required = ["reportes_ver"];
    else if (path === "/api/transacciones") required = ["transacciones_ver"];
    else if (path === "/api/consultar-precio") required = ["precios_ver"];
    else if (path === "/api/promociones") required = method === "GET" ? ["promociones_crear", "ventas_crear"] : ["promociones_crear"];
    else if (path === "/api/caja" && method !== "GET") required = ["caja_abrir_cerrar"];
    else if (path === "/api/caja/voucher") required = ["caja_abrir_cerrar"];
    else if (path === "/api/movimiento-caja") required = ["caja_ingreso_egreso"];
    else if (path === "/api/configuracion/finanzas") required = ["caja_sacar_dinero"];
    else if (path === "/api/configuracion/empresa" || (path === "/api/configuracion/usuarios" && method === "GET")) required = ["empresa_usuarios_ver"];
    if (required.length) {
      try {
        const { getUserPermissions } = await import("@/lib/permissions");
        const access = await getUserPermissions(payload.correo);
        if (!access) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 401 });
        if (path === "/api/producto" && method === "DELETE" && access.role !== "master") return NextResponse.json({ message: "No tienes permiso para eliminar productos." }, { status: 403 });
        if (!required.some((permission) => access.has(permission))) return NextResponse.json({ message: "No tienes permiso para realizar esta acción." }, { status: 403 });
        if (path === "/api/producto-vencimiento" && method !== "GET" && !access.has("vencimiento_ver")) return NextResponse.json({ message: "No tienes permiso para ver productos por vencer." }, { status: 403 });
      } catch (error) {
        console.error("Error verificando permisos:", error);
        return NextResponse.json({ message: "No se pudieron verificar los permisos." }, { status: 503 });
      }
    }

    return handler(authenticatedRequest);
  };
}
