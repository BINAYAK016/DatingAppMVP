# Original synthetic demo media

`trail.mp4` and `trail.jpg` are original geometric illustrations generated for this private beta on 2 October 2026. They contain no real person, photograph, precise location, recording, scraped content, external media, AI output, or provider data. The scenery is an invented mountain composition, visibly marked **FICTIONAL DEMO · GENERATED ARTWORK**.

The still was rendered with the `demoMedia.ts` scene generator using persona 1, role `feed`, slot 1, and the display name `Sangai`. Sharp rasterized that code-native SVG. The project's existing local Docker FFmpeg encoded a gentle four-second pan/zoom; FFmpeg then extracted the first frame at 480×640. No API/database row or service configuration was changed to make these assets.

Encoding recipe, using an owned temporary `source.jpg`:

```sh
ffmpeg -nostdin -y -loop 1 -i source.jpg -t 4 \
  -vf "zoompan=z='min(zoom+0.0012,1.07)':d=64:s=720x960:fps=16" \
  -an -c:v libx264 -threads 1 -filter_threads 1 -preset veryfast \
  -crf 29 -pix_fmt yuv420p -map_metadata -1 -movflags +faststart trail.mp4
ffmpeg -nostdin -y -i trail.mp4 -frames:v 1 -vf scale=480:640 \
  -threads 1 trail.jpg
```

Actual FFprobe check: H.264, 720×960, 16 frames/second, no audio, 4.000 seconds, 45,045 bytes. SHA-256:

- `trail.mp4`: `03f38a23aaae4c84cbbca4b092097a948ac3a32b53a009278b54bf2f49ddd3c4`
- `trail.jpg`: `69c33de54f8063a956a0fdf264b170b8b50656c5cc0aa6f4257e7c17a6f9c6a7`

Runtime needs no host FFmpeg: the demo helper copies these small committed files into generation-specific, owner-scoped private storage and returns ordinary media metadata. Authorization remains the existing authenticated media endpoint, including the video poster. Stable media UUIDs do not share physical paths across resets; old deletion jobs cannot remove a new generation's file. The seed coordinator owns metadata, attachment and superseded-generation cleanup. Do not serve these private copies as public dating-media URLs.

Each avatar and additional profile/feed/story illustration is independently rasterized from the catalog and code-native shapes by `demoMedia.ts`; no real profile photo is substituted or labeled as verified identity.
