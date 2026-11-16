export type AcademyVideo = { title: string; description: string; url: string };

// Agrega aquí los enlaces y descripciones de los tutoriales de la academia.
export const academyVideos: AcademyVideo[] = [
  { title: "Conoce MiniGest: recorrido por la aplicación", description: "Conoce la aplicación y recorre sus secciones principales.", url: "https://www.youtube.com/watch?v=OQ9-L32tEQ8" },
  { title: "Cómo iniciar sesión y cerrar sesión", description: "Aprende a ingresar a MiniGest y cerrar tu sesión.", url: "https://www.youtube.com/watch?v=6yH6JLl9SU4" },
  { title: "Cómo crear un producto desde cero", description: "Aprende a registrar un producto nuevo en MiniGest.", url: "https://www.youtube.com/watch?v=b9AaBIZmaw4" },
  { title: "Cómo editar un producto y actualizar su precio", description: "Aprende a modificar los datos y el precio de un producto.", url: "https://www.youtube.com/watch?v=LxNqxqhWGQw" },
  { title: "Cómo registrar una entrada o ajuste de stock", description: "Aprende a registrar entradas y ajustes de inventario.", url: "https://www.youtube.com/watch?v=-ThgJXbkHFY" },
  { title: "Cómo crear un proveedor", description: "Aprende a registrar un proveedor en MiniGest.", url: "https://www.youtube.com/watch?v=IYktat3Vef4" },
  { title: "Conoce los tres tipos de promociones de MiniGest", description: "Conoce las promociones de descuento, yapa y combo.", url: "https://www.youtube.com/watch?v=vr3E6a3C_lE" },
  { title: "Cómo crear una promoción por descuento", description: "Aprende a crear una promoción con descuento porcentual.", url: "https://www.youtube.com/watch?v=UtQMVf6Qog0" },
  { title: "Cómo crear una promoción de yapa", description: "Aprende a crear una promoción que incluye unidades de regalo.", url: "https://www.youtube.com/watch?v=iWX8HST04b8" },
  { title: "Cómo crear una promoción de combo", description: "Aprende a crear una promoción con precio especial por cantidad.", url: "https://www.youtube.com/watch?v=8gxuqkc9T34" },
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
