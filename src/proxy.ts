import { NextRequest, NextResponse } from "next/server";
import { validateJwtToken } from "@/lib/auth";
import { readResetIntent, RESET_COOKIE } from "@/lib/password-reset";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get("minigest_login")?.value;
  const valid = token ? Boolean(validateJwtToken(token)) : false;

  if (path === "/reestablecer_contrasena") {
    return readResetIntent(request.cookies.get(RESET_COOKIE)?.value)
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  if (path === "/login" || path === "/register") {
    if (!valid) return NextResponse.next();
    const response = NextResponse.redirect(new URL("/home", request.url));
    response.cookies.set("minigest_session_hint", "1", {
      secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    });
    return response;
  }
  if (!valid) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete("minigest_login");
    response.cookies.delete("minigest_session_hint");
    return response;
  }
  const required = path === "/producto" ? "productos_ver"
    : path.startsWith("/proveedores") ? "proveedores_ver"
    : path.startsWith("/ventas") ? "ventas_crear"
    : path.startsWith("/reportes") ? "reportes_ver"
    : path.startsWith("/transacciones") ? "transacciones_ver"
    : path.startsWith("/consultar-precio") ? "precios_ver"
    : path.startsWith("/academia-minigest") ? "academia_ver"
    : path.startsWith("/promociones") || path.startsWith("/crear_promocion") ? "promociones_crear"
    : path.startsWith("/cierreCaja") ? "caja_abrir_cerrar"
    : path.startsWith("/registrar_ingreso") || path.startsWith("/registrar_egreso") ? "caja_ingreso_egreso"
    : null;
  if (required && token) {
    try {
      const payload = validateJwtToken(token);
      const { getUserPermissions } = await import("@/lib/permissions");
      const access = payload ? await getUserPermissions(payload.correo) : null;
      if (!access?.has(required) || (path === "/producto" && request.nextUrl.searchParams.get("tab") === "vencimiento" && !access.has("vencimiento_ver"))) return NextResponse.redirect(new URL("/home", request.url));
    } catch {
      return new NextResponse("No se pudieron verificar los permisos.", { status: 503 });
    }
  }
  const response = NextResponse.next();
  response.cookies.set("minigest_session_hint", "1", {
    secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
  });
  return response;
}

export const config = {
  matcher: ["/", "/home/:path*", "/login", "/register", "/reestablecer_contrasena", "/producto/:path*", "/ventas/:path*", "/proveedores/:path*", "/promociones/:path*", "/crear_promocion/:path*", "/consultar-precio/:path*", "/configuracion/:path*", "/cierreCaja/:path*", "/registrar_ingreso/:path*", "/registrar_egreso/:path*", "/transacciones/:path*", "/reportes/:path*", "/academia-minigest/:path*"],
};
