import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, interopDefault: false });
const { youtubeVideoId, academyVideos } = await jiti.import("../src/lib/academy-videos.ts");

test("reconoce enlaces de YouTube y el video de prueba", () => {
  assert.equal(youtubeVideoId(academyVideos[0].url), "yLkI_9LV2hM");
  assert.equal(youtubeVideoId("https://youtu.be/yLkI_9LV2hM?t=3"), "yLkI_9LV2hM");
  assert.equal(youtubeVideoId("https://www.youtube.com/shorts/yLkI_9LV2hM"), "yLkI_9LV2hM");
});

test("no acepta dominios ajenos, protocolos inseguros ni identificadores inválidos", () => {
  assert.equal(youtubeVideoId("https://youtube.com.example.com/watch?v=yLkI_9LV2hM"), null);
  assert.equal(youtubeVideoId("http://youtube.com/watch?v=yLkI_9LV2hM"), null);
  assert.equal(youtubeVideoId("https://youtube.com/watch?v=abc"), null);
});
