import { NextResponse } from "next/server";

export function POST() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete("minigest_login");
  response.cookies.delete("minigest_session_hint");
  return response;
}
