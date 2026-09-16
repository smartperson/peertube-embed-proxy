function resolveApiBase(host, config) {
  if (!host || host === config.defaultHost) return config.localApiBase;
  return `https://${host}`;
}

// Returns the video object, or null for any non-200 (private, password
// protected, missing, or unreachable). Callers must treat null as
// "fall back to the real page" — never throw this up as a 500.
async function fetchVideoMetadata({ host, id, config }) {
  const apiBase = resolveApiBase(host, config);
  const url = `${apiBase}/api/v1/videos/${encodeURIComponent(id)}`;

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    return null;
  }

  if (!res.ok) return null;

  try {
    return await res.json();
  } catch (err) {
    return null;
  }
}

module.exports = { fetchVideoMetadata, resolveApiBase };
