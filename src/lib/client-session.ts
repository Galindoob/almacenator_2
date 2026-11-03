// Este indicador solo evita solicitudes innecesarias en el cliente.
// La autorización real siempre valida el JWT HttpOnly en el servidor.
export function hasSessionHint() {
  return document.cookie.split("; ").some((part) => part === "minigest_session_hint=1");
}

export async function endSession() {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    localStorage.removeItem("jwt");
    window.dispatchEvent(new Event("mini-gest-auth-change"));
    window.location.replace("/login");
  }
}
