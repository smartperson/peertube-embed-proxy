const express = require('express');
const config = require('./config');
const { TtlCache } = require('./cache');
const { createRateLimiter } = require('./rateLimiter');
const { fetchVideoMetadata } = require('./peertubeClient');
const { pickFile } = require('./pickFile');
const { resolveThumbnail } = require('./thumbnail');
const { renderPage } = require('./render');

const videoCache = new TtlCache(config.cacheTtlMs);

function buildRealUrl(host, rawId) {
  return `https://${host}/w/${encodeURIComponent(rawId)}`;
}

async function handleEmbed(req, res, host, rawId) {
  const realUrl = buildRealUrl(host, rawId);
  const id = rawId.split(';')[0]; // strip comment permalink's ;threadId=

  try {
    const cacheKey = `${host}:${id}`;
    let video = videoCache.get(cacheKey);

    if (video === undefined) {
      video = await fetchVideoMetadata({ host, id, config });
      videoCache.set(cacheKey, video, video ? config.cacheTtlMs : config.negativeCacheTtlMs);
    }

    // Private, password-protected, missing, or unreachable: bounce to the
    // real page rather than serving a broken card. Never a 500.
    if (!video) {
      res.redirect(302, realUrl);
      return;
    }

    const qParam = req.query.q != null ? Number(req.query.q) : null;
    const qOverride = Number.isFinite(qParam) ? qParam : null;

    const file = pickFile(video, { budgetBytes: config.defaultBudgetBytes, qOverride });
    const thumbnail = resolveThumbnail(video, `https://${host}`);

    const html = renderPage({
      siteName: host,
      title: video.name,
      description: video.description || '',
      canonicalUrl: realUrl,
      thumbnail,
      file,
      aspectRatio: video.aspectRatio,
    });

    res.status(200).type('html').send(html);
  } catch (err) {
    console.error(JSON.stringify({ msg: 'embed_error', host, id: rawId, error: err.message }));
    res.redirect(302, realUrl);
  }
}

function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(createRateLimiter({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }));

  app.get('/healthz', (req, res) => res.status(200).type('text').send('ok'));

  app.get('/w/:id', (req, res) => {
    handleEmbed(req, res, config.defaultHost, req.params.id);
  });

  // Multi-instance form is a 404 unless explicitly enabled + allowlisted --
  // otherwise this is an open outbound proxy.
  app.get('/w/:host/:id', (req, res) => {
    const { host, id } = req.params;
    if (!config.multiInstanceEnabled || !config.allowedHosts.includes(host)) {
      res.status(404).type('text').send('Not found');
      return;
    }
    handleEmbed(req, res, host, id);
  });

  return app;
}

module.exports = { createApp };
