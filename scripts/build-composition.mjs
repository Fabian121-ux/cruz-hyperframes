import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const videoArg = process.argv[2];
if (!videoArg) {
  console.error("Usage: node scripts/build-composition.mjs <video.mp4>");
  process.exit(1);
}

const videoPath = path.resolve(videoArg);
const videoFile = path.basename(videoPath);

function ffprobeJson() {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      videoPath,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(out);
}

function detectSceneCuts() {
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-i", videoPath, "-filter:v",
    "select=gt(scene\\,0.34),showinfo", "-f", "null", "-"
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error("Scene detection failed: " + (result.error?.message || result.stderr));
  }
  return [...new Set([...String(result.stderr).matchAll(/pts_time:([0-9.]+)/g)]
    .map((m) => Number(Number(m[1]).toFixed(3))).filter((t) => t > 0.15))];
}

function extractWords() {
  if (!existsSync("transcript.json")) return [];
  try {
    const raw = JSON.parse(readFileSync("transcript.json", "utf8"));
    const words = [];
    // HyperFrames emits normalized word timestamps in seconds.
    for (const word of raw.words ?? []) {
      const text = String(word.text ?? word.word ?? "").trim();
      const start = Number(word.start);
      const end = Number(word.end);
      if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
        words.push({ text, start, end });
      }
    }
    if (words.length) return words;
    // Also accept the native whisper.cpp token format.
    for (const seg of raw.transcription ?? []) {
      for (const token of seg.tokens ?? []) {
        const text = String(token.text ?? "").trim();
        const from = Number(token.offsets?.from);
        const to = Number(token.offsets?.to);
        if (!text || text.startsWith("[_") || text.startsWith("[BLANK")) continue;
        if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
        words.push({ text, start: from / 1000, end: to / 1000 });
      }
    }
    return words;
  } catch {
    return [];
  }
}

function cueWords(words) {
  const cues = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    const text = current.map((w) => w.text).join(" ").replace(/\s+([,.!?;:])/g, "$1");
    const span = current[current.length - 1].end - current[0].start;
    const punctuationBreak = /[.!?]$/.test(word.text);
    if (current.length >= 4 || span >= 1.35 || punctuationBreak) {
      cues.push({
        text,
        start: current[0].start,
        end: Math.max(current[current.length - 1].end, current[0].start + 0.38),
      });
      current = [];
    }
  }
  if (current.length) {
    cues.push({
      text: current.map((w) => w.text).join(" ").replace(/\s+([,.!?;:])/g, "$1"),
      start: current[0].start,
      end: Math.max(current[current.length - 1].end, current[0].start + 0.38),
    });
  }
  return cues;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const meta = ffprobeJson();
const videoStream = (meta.streams ?? []).find((s) => s.codec_type === "video");
if (!videoStream) throw new Error("No video stream found.");

const width = Number(videoStream.width) || 1080;
const height = Number(videoStream.height) || 1920;
const duration = Number(meta.format?.duration) || Number(videoStream.duration);
if (!Number.isFinite(duration) || duration <= 0) {
  throw new Error("Could not determine video duration.");
}

const fpsText = String(videoStream.avg_frame_rate || videoStream.r_frame_rate || "30/1");
const [fpsN, fpsD] = fpsText.split("/").map(Number);
const fps = fpsD ? fpsN / fpsD : Number(fpsText);
const renderFps = Number.isFinite(fps) && fps >= 1 ? Math.min(60, Math.max(24, Math.round(fps))) : 30;

const words = extractWords();
const cues = cueWords(words);
if (!cues.length) throw new Error("No captions generated; inspect transcript.json.");
const zoomCues = cues.filter((cue, i) => /[!?]$/.test(cue.text) || i % 3 === 0);
const sceneCuts = detectSceneCuts().filter((t) => t < duration - 0.15);

const captionsHtml = cues
  .map((cue, i) => {
    const d = Math.max(0.24, cue.end - cue.start);
    return `<div id="caption-${i}" class="clip caption" data-start="${cue.start.toFixed(3)}" data-duration="${d.toFixed(3)}" data-track-index="5">${esc(cue.text)}</div>`;
  })
  .join("\n");

const flashesHtml = sceneCuts
  .map(
    (t, i) =>
      `<div id="cut-${i}" class="clip cut-flash" data-start="${Math.max(0, t - 0.055).toFixed(3)}" data-duration="0.18" data-track-index="6"></div>`,
  )
  .join("\n");

const cueData = JSON.stringify(cues);
const cutData = JSON.stringify(sceneCuts);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${width}, height=${height}" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #000;
      font-family: Arial, Helvetica, sans-serif;
    }
    #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; }
    #a-roll {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform-origin: center center;
    }
    .caption {
      position: absolute;
      left: 7%;
      right: 7%;
      bottom: 14%;
      text-align: center;
      color: #fff;
      font-size: ${Math.max(44, Math.round(width * 0.066))}px;
      line-height: 1.02;
      font-weight: 900;
      letter-spacing: -0.02em;
      text-transform: none;
      -webkit-text-stroke: ${Math.max(2, Math.round(width * 0.004))}px #000;
      text-shadow:
        0 ${Math.max(4, Math.round(width * 0.006))}px 0 #000,
        0 0 ${Math.max(10, Math.round(width * 0.014))}px rgba(0,0,0,.9);
      opacity: 0;
      transform: translateY(30px) scale(.78);
      z-index: 20;
    }
    .cut-flash {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,.55);
      opacity: 0;
      z-index: 30;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div
    id="root"
    data-composition-id="main"
    data-start="0"
    data-duration="${duration.toFixed(3)}"
    data-width="${width}"
    data-height="${height}"
    data-fps="${renderFps}"
  >
    <video
      id="a-roll"
      class="clip"
      src="${esc(videoFile)}"
      muted
      playsinline
      data-start="0"
      data-duration="${duration.toFixed(3)}"
      data-track-index="0"
    ></video>

    <audio
      id="a-roll-audio"
      src="${esc(videoFile)}"
      data-start="0"
      data-duration="${duration.toFixed(3)}"
      data-track-index="1"
      data-volume="1"
    ></audio>

    ${captionsHtml}
    ${flashesHtml}
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    const cues = ${cueData};
    const cuts = ${cutData};

    cues.forEach((cue, i) => {
      const el = "#caption-" + i;
      const start = cue.start;
      const end = Math.max(cue.end, start + 0.38);
      tl.fromTo(
        el,
        { opacity: 0, y: 34, scale: 0.72 },
        { opacity: 1, y: 0, scale: 1.08, duration: 0.11, ease: "back.out(2.4)" },
        start
      );
      tl.to(el, { scale: 1, duration: 0.08, ease: "power2.out" }, start + 0.11);
      tl.to(
        el,
        { opacity: 0, y: -16, scale: 0.96, duration: 0.09, ease: "power1.in" },
        Math.max(start + 0.28, end - 0.09)
      );

      if (/[!?]$/.test(cue.text) || i % 3 === 0) {
        tl.to("#a-roll", { scale: 1.045, duration: 0.10, ease: "power2.out" }, start);
        tl.to("#a-roll", { scale: 1, duration: 0.16, ease: "power2.out" }, start + 0.10);
      }
    });

    cuts.forEach((t, i) => {
      const el = "#cut-" + i;
      tl.fromTo(el, { opacity: 0 }, { opacity: 0.42, duration: 0.045, ease: "power1.out" }, Math.max(0, t - 0.045));
      tl.to(el, { opacity: 0, duration: 0.11, ease: "power1.in" }, t);
      tl.to("#a-roll", { scale: 1.025, duration: 0.08, ease: "power1.out" }, t);
      tl.to("#a-roll", { scale: 1, duration: 0.16, ease: "power1.out" }, t + 0.08);
    });

    window.__timelines["main"] = tl;
  </script>
</body>
</html>`;

writeFileSync("index.html", html);
writeFileSync("edit-report.json", JSON.stringify({ captions: cues.length, zooms: zoomCues.length, sceneCuts: sceneCuts.length, duration, width, height, fps: renderFps }, null, 2));
console.log(
  JSON.stringify(
    {
      video: videoFile,
      width,
      height,
      duration,
      fps: renderFps,
      captions: cues.length,
      sceneCuts: sceneCuts.length,
      zooms: zoomCues.length,
    },
    null,
    2,
  ),
);
