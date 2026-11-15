export type AcademyVideo = { title: string; description: string; url: string };

// Agrega aquí los enlaces y descripciones de los tutoriales de la academia.
export const academyVideos: AcademyVideo[] = [
  { title: "Video de prueba", description: "Prueba del reproductor de YouTube en MiniGest.", url: "https://www.youtube.com/watch?v=yLkI_9LV2hM" },
];

export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] ?? null : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
