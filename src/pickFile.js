// Web-video `files` are preferred when present; HLS-only instances only
// populate streamingPlaylists[0].files (fragmented mp4s work fine as a
// direct-file embed — no need to enable web video output).
function candidatePool(video) {
  const pool = video.files?.length ? video.files : (video.streamingPlaylists?.[0]?.files ?? []);
  // resolution.id === 0 is an audio-only track in HLS output.
  return pool.filter((f) => f.resolution && f.resolution.id > 0);
}

// Picks the highest-resolution file that fits budgetBytes. `qOverride`
// (the ?q= param) bypasses the budget entirely for a specific resolution,
// so a link can be forced to a larger file on request.
function pickFile(video, { budgetBytes, qOverride } = {}) {
  const candidates = candidatePool(video);
  if (!candidates.length) return null;

  if (qOverride != null) {
    const exact = candidates.find((f) => f.resolution.id === qOverride);
    if (exact) return exact;
  }

  const byResolutionDesc = [...candidates].sort((a, b) => b.resolution.id - a.resolution.id);
  return byResolutionDesc.find((f) => f.size <= budgetBytes) ?? null;
}

module.exports = { pickFile };
