# embed.video.nyc — PeerTube OG metadata proxy

## Goal

PeerTube watch pages emit Open Graph tags whose `og:video` points at an iframe
embed page (`og:video:type: text/html`). Discord only renders iframe players for
a hardcoded provider whitelist, so PeerTube links degrade to a small thumbnail
card with no player.

This service serves an alternative HTML page for the same video, with `og:video`
pointing at a **direct media file**, which Discord (and other consumers that
won't render third-party iframes) plays inline.

Users paste `https://embed.video.nyc/w/UUID` instead of
`https://video.nyc/w/UUID`. Bots read the meta tags; humans are bounced to the
real watch page by JavaScript.

## Verified facts (tested, not assumed)

- Direct-file embeds work from **arbitrary domains**. The Discord whitelist
  applies only to `og:video:type: text/html` iframe players, not to media files.
  Confirmed with a hand-written static page on an unrelated domain.
- **Fragmented MP4 from HLS works.** The successful test used a
  `-fragmented.mp4` file from `streamingPlaylists[0].files`, not a web video
  file. No need for web video output to be enabled.
- Discord's player showed correct duration and seeked mid-file, implying range
  requests rather than a full download. Not yet confirmed from server logs.
- The existing PHP tool `spikehidden/TubeFix` emits an **empty** `og:video` on
  HLS-only instances — it only reads `.files` and doesn't fall back to
  `.streamingPlaylists[0].files`. Worth a bug report upstream.

## Architecture

Single small service, own Caddy site block, same box as PeerTube.

- Metadata fetch goes to `http://127.0.0.1:9000` (skips TLS round trip).
- `fileUrl` values returned by the API are absolute and public
  (`https://video.nyc/...`). **Do not rewrite them** — Discord's media proxy
  must be able to reach them.
- No database, no state. Pure function from URL to HTML.

Node preferred (PeerTube already requires the runtime; avoids adding php-fpm).

## Routes

- `GET /w/:id` — default host is `video.nyc`
- `GET /w/:host/:id` — optional multi-instance form, **host allowlist required**
  if enabled (otherwise it's an open outbound proxy)

The id may be a short UUID, a full UUID, or a numeric id. The API accepts all
three, so don't canonicalize. Strip matrix params: `id.split(';')[0]` —
comment permalinks carry `;threadId=`.

## Fetching metadata

```
GET http://127.0.0.1:9000/api/v1/videos/:id
```

Non-200 means private, password-protected, or missing → serve a minimal card or
redirect to the real page. Never 500.

Cache responses in memory keyed on `host:id`, short TTL (~1h).

## Picking the file

```js
const pool = video.files?.length
  ? video.files
  : (video.streamingPlaylists?.[0]?.files ?? [])

const candidates = pool.filter(f => f.resolution.id > 0)  // 0 = audio only
```

Rules:

- Use `fileUrl`, **not** `fileDownloadUrl` (the latter sets
  `Content-Disposition: attachment` and goes through PeerTube's controller).
- Never use `/download/videos/generate/:id` — remuxes on the fly, no
  `Content-Length`, no seeking, burns CPU per request.
- Filter out `resolution.id === 0` (audio-only tracks appear in HLS output).
- Select by **byte budget**, not resolution: each file object has `size`, so
  pick the highest resolution that fits the budget. A 30s 1080p clip is smaller
  than a 20min 480p one.
- If nothing fits the budget, **omit the video tags entirely** and serve an
  image-only card (title + description + `og:image`). A clean thumbnail beats a
  player that times out.
- Support `?q=720` to override the budget for specific links.

## Thumbnail

`previewPath` (~1280x720) for `og:image`; `thumbnailPath` is the small grid
image and looks soft when scaled. Both are relative — prefix the instance URL.
Both are deprecated as of PeerTube 8.1 in favour of a `thumbnails` array;
prefer the array when present, fall back to the flat fields.

## Output HTML

Status **200**. Never a 301/302 and never `<meta http-equiv="refresh">` —
crawlers follow those, landing back on the iframe tags.

```html
<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta property="og:site_name" content="..." />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:url" content="https://video.nyc/w/UUID" />
<meta property="og:image" content="https://video.nyc/lazy-static/previews/....jpg" />
<meta property="og:image:width" content="1280" />
<meta property="og:image:height" content="720" />

<meta property="og:type" content="video.other" />
<meta property="og:video" content="<fileUrl>" />
<meta property="og:video:url" content="<fileUrl>" />
<meta property="og:video:secure_url" content="<fileUrl>" />
<meta property="og:video:type" content="video/mp4" />
<meta property="og:video:width" content="1280" />
<meta property="og:video:height" content="720" />

<meta name="twitter:card" content="summary_large_image" />
<script>location.replace("https://video.nyc/w/UUID")</script>
</head><body></body></html>
```

Notes:

- `og:type` must be `video.other`. PeerTube uses `video`, which isn't a valid
  OGP type.
- JS redirect only. Discordbot doesn't execute JavaScript, so the tags are read
  and the script ignored. This is the fxtwitter pattern.
- Escape all interpolated values (`& < > "`). PeerTube had a real bug here —
  PR #6206 — where descriptions containing a double quote truncated the embed.
- Use real dimensions from `aspectRatio` (PeerTube 6+) rather than assuming
  16:9, or vertical clips letterbox badly.

## Deployment

- Own Caddy site block for `embed.video.nyc`, own log file, JSON format.
- Rate limit — every hit triggers an outbound request.
- Caddy's `rate_limit` needs a plugin; an in-process limiter is fine instead.

## Testing

```bash
# what the crawler sees
curl -s -A 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' \
  https://embed.video.nyc/w/UUID

# must be 200, not a redirect
curl -sI -A 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' \
  https://embed.video.nyc/w/UUID
```

Then `discord.com/developers/embeds`, then a real message in a test server.
The debugger can show a valid embed while the client renders nothing, so the
real message is the authoritative check.

**Discord caches embeds per URL, hard.** Every retry after a change needs a
fresh URL (`?v=2`, `?v=3`) or you'll be looking at a stale result.

## Open questions

- Does Discord range-read or pull whole files? Check the Caddy log: `206` with
  a `Range` header and small sizes means partial; a single `200` with full
  `Content-Length` means whole-file. Determines whether the byte budget should
  be generous or tight, and whether bandwidth cost is per-video or per-viewer.
- Does Discord cache the file on their CDN? One fetch total across many viewers
  means cached; one per viewer means proxied only.
- Practical size ceiling for long videos. May need a generated 30s preview clip
  (ffmpeg, cached on disk) for multi-hour content.
- `.m3u8` in `og:video` almost certainly doesn't work (Chromium has no native
  HLS; the proxy fetches single files, not manifests) — untested.

## Later: PeerTube client plugin

A client plugin adding a "Copy embed link" button to the watch page, producing
the `embed.video.nyc` URL from the current video. Pure client-side string
manipulation, no server component. Make the proxy base URL a plugin setting so
other admins can point at their own deployment.

Check which watch-page registration slots exist in the target PeerTube version —
they've changed across majors, and the share modal may not be extensible.

## Context that explains why this exists outside PeerTube

- The only HTML-related server plugin hooks are
  `filter:html.client.json-ld.result` and two `filter:html.embed.video.allowed.result`.
  **No hook touches the OG meta tags**, so this cannot be a server plugin.
- Upstream generates these tags in `server/core/lib/html/shared/video-html.ts`
  (`buildVideoHTML`) and `tags-html.ts` (`TagsHtml.addTags`), injected per
  request into placeholder comments in the built `index.html`
  (`CUSTOM_HTML_TAG_COMMENTS` in `server/core/initializers/constants.ts`).
  Watch pages are not cached; embeds are memoized with `MEMOIZE_TTL.EMBED_HTML`.
- `video-html.ts` already computes a direct file URL for schema.org
  `contentUrl`, with a comment about crawlers preferring something they can
  fetch and probe. The idea is accepted upstream — just not wired to OG tags.
- Issue #5040 requested this in 2022; closed as discussion. The maintainer has
  separately said he doesn't want to make exceptions or change behaviour for
  Discord specifically. The P2P leech concern (inline playback means nobody
  loads the player or seeds) is a real objection raised by the original
  reporter.
