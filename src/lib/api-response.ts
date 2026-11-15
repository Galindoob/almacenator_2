export async function readApiJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    if (response.status === 404) {
      throw new Error("No se encontró el servicio solicitado. Si ejecutas la aplicación en desarrollo, reinicia el servidor e inténtalo nuevamente.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("La sesión expiró o no tienes permiso para realizar esta acción.");
    }
    throw new Error(`El servidor devolvió una respuesta inesperada (${response.status}). Revisa el servidor e inténtalo nuevamente.`);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("No se pudo leer la respuesta del servidor. Inténtalo nuevamente.");
  }
}
