export async function getChileCurrentDate() {
  const response = await fetch(
    "https://timeapi.io/api/Time/current/zone?timeZone=America/Santiago",
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  );

  if (!response.ok) {
    throw new Error("No se pudo consultar la hora de Chile.");
  }

  const data = (await response.json()) as { dateTime?: unknown };
  const dateTime = typeof data.dateTime === "string" ? data.dateTime : "";
  const currentDate = dateTime.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
    throw new Error("La API devolvió una fecha de Chile inválida.");
  }

  return currentDate;
}
