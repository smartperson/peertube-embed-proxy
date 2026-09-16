const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

// Guards against a title/description/URL containing "</script>" from
// breaking out of the inline redirect script.
function toScriptSafeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003C');
}

// Renders the OG-tag page. `file` is a PeerTube file object (or null, if
// nothing fit the byte budget) — when null, video tags are omitted entirely
// and this degrades to an image-only card, which beats a player that times out.
function renderPage({ siteName, title, description, canonicalUrl, thumbnail, file, aspectRatio }) {
  const width = 1280;
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const height = Math.round(width / ratio);

  const imageTags = thumbnail
    ? `<meta property="og:image" content="${escapeHtml(thumbnail.url)}" />
<meta property="og:image:width" content="${thumbnail.width}" />
<meta property="og:image:height" content="${thumbnail.height}" />`
    : '';

  // og:type must be video.other -- PeerTube itself emits "video", which
  // isn't a valid OGP type.
  const videoTags = file
    ? `<meta property="og:type" content="video.other" />
<meta property="og:video" content="${escapeHtml(file.fileUrl)}" />
<meta property="og:video:url" content="${escapeHtml(file.fileUrl)}" />
<meta property="og:video:secure_url" content="${escapeHtml(file.fileUrl)}" />
<meta property="og:video:type" content="video/mp4" />
<meta property="og:video:width" content="${width}" />
<meta property="og:video:height" content="${height}" />`
    : `<meta property="og:type" content="website" />`;

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta property="og:site_name" content="${escapeHtml(siteName)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
${imageTags}
${videoTags}
<meta name="twitter:card" content="summary_large_image" />
<script>location.replace(${toScriptSafeJson(canonicalUrl)})</script>
</head><body></body></html>`;
}

module.exports = { renderPage, escapeHtml };
