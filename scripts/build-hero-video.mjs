import { spawnSync } from "node:child_process"
import { mkdir, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Run with Node 22+ and FFmpeg on PATH (or set FFMPEG_PATH).
// Sources and intermediate files stay outside the project.
const root = fileURLToPath(new URL("../", import.meta.url))
const cache = path.join(tmpdir(), "vibe-sport-hero")
const output = path.join(root, "public", "videos")
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg"
const clips = [
  ["badminton", 8053493, "8053493-hd_1920_1080_25fps.mp4", 1],
  ["table-tennis", "mixkit-101288", null, 0.5, "https://assets.mixkit.co/xfi790iaiwf1y7m1tw9hoep7py0h"],
  ["pickleball", 37165624, "15744452_3840_2160_24fps.mp4", 1],
  ["basketball", 8337077, "8337077-hd_1920_1080_30fps.mp4", 2],
  ["volleyball", 6217124, "6217124-hd_1920_1080_30fps.mp4", 0.3],
  ["archery", 6603042, "6603042-hd_1920_1080_25fps.mp4", 2],
  ["swimming", 8686073, "8686073-hd_1920_1080_30fps.mp4", 0.5],
  ["football", 6077690, "6077690-hd_1920_1080_25fps.mp4", 2.5],
  ["tennis", 10378830, "10378830-hd_1920_1080_30fps.mp4", 3.5],
]

function run(args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    cwd: cache,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr)
}

await mkdir(cache, { recursive: true })
await mkdir(output, { recursive: true })

for (const [sport, id, filename, start, sourceUrl] of clips) {
  const source = path.join(cache, `${sport}-${id}.mp4`)
  const cached = await stat(source).catch(() => null)
  if (!cached?.size) {
    const response = await fetch(sourceUrl || `https://videos.pexels.com/video-files/${id}/${filename}`)
    if (!response.ok) throw new Error(`${sport}: HTTP ${response.status}`)
    await writeFile(source, Buffer.from(await response.arrayBuffer()))
  }
  run([
    "-ss", String(start), "-i", source,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30,format=yuv420p",
    "-frames:v", "90", "-an", "-c:v", "libx264", "-preset", "fast",
    "-crf", "25", "-profile:v", "high", "-level:v", "4.1",
    "-g", "30", "-threads", "2", path.join(cache, `${sport}-segment.mp4`),
  ])
  console.log(`Prepared ${sport}: 3 seconds, 1920×1080, 30 fps`)
}

const concatFile = path.join(cache, "concat.txt")
await writeFile(concatFile, clips.map(([sport]) => `file '${sport}-segment.mp4'`).join("\n"))
const montage = path.join(output, "vibe-sport-montage-1080p.mp4")
run([
  "-f", "concat", "-safe", "0", "-i", concatFile,
  "-c", "copy", "-an", "-movflags", "+faststart", montage,
])
run([
  "-ss", "0.5", "-i", montage, "-frames:v", "1", "-q:v", "3",
  path.join(output, "vibe-sport-poster.jpg"),
])
console.log(`Created 27-second montage: ${montage}`)
