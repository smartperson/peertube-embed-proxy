const express = require('express');
const config = require('./config');
const logger = require('./logger');
const { TtlCache } = require('./cache');
const { createRateLimiter } = require('./rateLimiter');
const { fetchVideoMetadata } = require('./peertubeClient');
const { pickFile } = require('./pickFile');
const { resolveThumbnail } = require('./thumbnail');
const { renderPage } = require('./render');

const videoCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);

function buildRealUrl(host, rawId) {
  return `https://${host}/w/${encodeURIComponent(rawId)}`;
}

async function handleEmbed(req, res, host, rawId) {
  const start = Date.now();
  const realUrl = buildRealUrl(host, rawId);
  const id = rawId.split(';')[0]; // strip comment permalink's ;threadId=

  try {
    const cacheKey = `${host}:${id}`;
    let video = videoCache.get(cacheKey);
    const cacheHit = video !== undefined;

    if (!cacheHit) {
      video = await fetchVideoMetadata({ host, id, config });
      videoCache.set(cacheKey, video, video ? config.cacheTtlMs : config.negativeCacheTtlMs);
    }

    // Private, password-protected, missing, or unreachable: bounce to the
    // real page rather than serving a broken card. Never a 500.
    if (!video) {
      logger.info('embed_redirect', { host, id, cacheHit, reason: 'no_metadata', durationMs: Date.now() - start });
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

    logger.info('embed_served', {
      host,
      id,
      cacheHit,
      qOverride,
      budgetBytes: config.defaultBudgetBytes,
      fileResolution: file?.resolution?.id ?? null,
      fileSizeBytes: file?.size ?? null,
      hasThumbnail: Boolean(thumbnail),
      durationMs: Date.now() - start,
    });
    logger.debug('embed_served_file', { host, id, file });

    res.status(200).type('html').send(html);
  } catch (err) {
    logger.error('embed_error', { host, id: rawId, error: err.message, durationMs: Date.now() - start });
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
      logger.info('multi_instance_rejected', { host, id, multiInstanceEnabled: config.multiInstanceEnabled });
      res.status(404).type('text').send('Not found');
      return;
    }
    handleEmbed(req, res, host, id);
  });

  return app;
}

module.exports = { createApp };
