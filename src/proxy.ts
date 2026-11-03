import { NextRequest, NextResponse } from "next/server";
import { validateJwtToken } from "@/lib/auth";
import { readResetIntent, RESET_COOKIE } from "@/lib/password-reset";

export function proxy(request: NextRequest) {
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
  const response = NextResponse.next();
  response.cookies.set("minigest_session_hint", "1", {
    secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
  });
  return response;
}

export const config = {
  matcher: ["/", "/home/:path*", "/login", "/register", "/reestablecer_contrasena", "/producto/:path*", "/ventas/:path*", "/proveedores/:path*", "/promociones/:path*", "/crear_promocion/:path*", "/consultar-precio/:path*", "/configuracion/:path*", "/cierreCaja/:path*", "/transacciones/:path*", "/reportes/:path*", "/academia-minigest/:path*"],
};
