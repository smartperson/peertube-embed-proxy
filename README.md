# peertube-embed-proxy

See `ABOUT.md` for what this is and `CONTEXT.md` for the full design (routes,
file-selection rules, HTML output, deployment, testing).

## Quick start

```bash
npm install
cp .env.example .env   # edit DEFAULT_HOST / LOCAL_API_BASE for your instance
npm start
```

```bash
curl -s http://localhost:3000/w/<video-id>
```

## Testing against Discord

```bash
curl -s -A 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' \
  https://embed.video.nyc/w/<video-id>
```

Then check https://discord.com/developers/embeds, then send a real message in
a test server -- Discord caches embeds per URL, so retest with a fresh query
string (`?v=2`, `?v=3`, ...) after any change.
