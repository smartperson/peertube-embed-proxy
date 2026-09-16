function absoluteUrl(path, instanceBaseUrl) {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, instanceBaseUrl).toString();
}

// thumbnails[] (PeerTube 8.1+) is preferred; previewPath/thumbnailPath are
// deprecated fallbacks for older instances. previewPath (~1280x720) beats
// thumbnailPath, which is the small grid image and looks soft when scaled up.
function resolveThumbnail(video, instanceBaseUrl) {
  if (Array.isArray(video.thumbnails) && video.thumbnails.length) {
    const best = [...video.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    return {
      url: absoluteUrl(best.path, instanceBaseUrl),
      width: best.width || 1280,
      height: best.height || 720,
    };
  }

  if (video.previewPath) {
    return { url: absoluteUrl(video.previewPath, instanceBaseUrl), width: 1280, height: 720 };
  }

  if (video.thumbnailPath) {
    return {
      url: absoluteUrl(video.thumbnailPath, instanceBaseUrl),
      width: video.thumbnailWidth || 280,
      height: video.thumbnailHeight || 157,
    };
  }

  return null;
}

module.exports = { resolveThumbnail };
