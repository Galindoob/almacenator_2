"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, PlayCircle, Search } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { endSession } from "@/lib/client-session";
import { academyVideos, youtubeVideoId } from "@/lib/academy-videos";

const videos = academyVideos.flatMap((video) => {
  const id = youtubeVideoId(video.url);
  return id ? [{ ...video, id }] : [];
});

export default function AcademiaMiniGestPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(videos[0]?.id ?? null);
  const selected = videos.find((video) => video.id === selectedId);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-CL");
    return videos.filter((video) => `${video.title} ${video.description}`.toLocaleLowerCase("es-CL").includes(query));
  }, [search]);

  function logout() { void endSession(); router.replace("/login"); }

  return <main className="academy-shell">
    <Navbar onLogout={logout} />
    <section className="academy-content" aria-labelledby="academy-title">
      <header className="academy-heading"><span><BookOpen aria-hidden="true" /></span><div><h1 id="academy-title">Ayuda MiniGest</h1><p>Encuentra tutoriales para aprender a utilizar la aplicación.</p></div></header>
      <div className="academy-layout">
        <aside className="academy-sidebar" aria-label="Videos de ayuda">
          <label className="academy-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Buscar video</span><input type="search" placeholder="Buscar video" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="academy-video-list">
            {filtered.map((video) => <article className={`academy-video-card${selectedId === video.id ? " is-selected" : ""}`} key={video.id}>
              <h2>{video.title}</h2><p>{video.description}</p>
              <button type="button" aria-pressed={selectedId === video.id} onClick={() => setSelectedId(video.id)}><PlayCircle size={17} aria-hidden="true" /> Ver ahora</button>
            </article>)}
            {!filtered.length ? <p className="academy-list-empty">{videos.length ? "No encontramos videos para esa búsqueda." : "Todavía no hay videos disponibles."}</p> : null}
          </div>
        </aside>
        <section className="academy-player" aria-label="Reproductor de video">
          {selected ? <><div className="academy-player-frame"><iframe key={selected.id} src={`https://www.youtube-nocookie.com/embed/${selected.id}`} title={`Video: ${selected.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
            <div className="academy-player-info"><div><h2>{selected.title}</h2><p>{selected.description}</p></div><a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noopener noreferrer"><PlayCircle size={19} aria-hidden="true" /> Ver en YouTube <ExternalLink size={15} aria-hidden="true" /></a></div>
          </> : <div className="academy-player-empty"><span><PlayCircle aria-hidden="true" /></span><h2>Videos de ayuda</h2><p>Los tutoriales aparecerán aquí cuando estén disponibles.</p></div>}
        </section>
      </div>
    </section>
  </main>;
}
