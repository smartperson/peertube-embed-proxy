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
//
// Multiple files can share the same resolution.id at different bitrates
// (e.g. a live-transcoded 2Mbps 720p rendition alongside an 8Mbps
// source-quality 720p one) -- resolution.id alone can't tell them apart,
// so within a resolution tier the smallest file is tried first. That way
// the cheaper rendition wins whenever it's available and fits, instead of
// whichever bitrate the API happened to list first.
function pickFile(video, { budgetBytes, qOverride } = {}) {
  const candidates = candidatePool(video);
  if (!candidates.length) return null;

  if (qOverride != null) {
    const atResolution = candidates.filter((f) => f.resolution.id === qOverride);
    if (atResolution.length) {
      return [...atResolution].sort((a, b) => a.size - b.size)[0];
    }
  }

  const byResolutionThenSize = [...candidates].sort(
    (a, b) => b.resolution.id - a.resolution.id || a.size - b.size,
  );
  return byResolutionThenSize.find((f) => f.size <= budgetBytes) ?? null;
}

module.exports = { pickFile };
