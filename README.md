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

There is also a `docker-compose.yml` that gets the proxy installed after you've pulled the git repo. 

## Testing against Discord

```bash
curl -s -A 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' \
  https://embed.video.nyc/w/<video-id>
```

Then check https://discord.com/developers/embeds. Also encourage you to send a real message in
a test server -- Discord caches embeds per URL, so retest with a fresh query
string (`?v=2`, `?v=3`, ...) after any change.

## Disclaimers and Disclosures

### This bypasses the 'peer' part of Peertube

I developed this proxy specifically to deal with my desire to share short peertube clips from the peertube instance that I maintain into a few of the small niche Discord communities that I'm a part of. However, to make this proxy work, anyone who uses the inline player will either get the video from Discord's cache, or else hit the peertube instance's server/CDN directly. The torrent-based peering part of Peertube is bypassed. That is one reason (among many) that I haven't yet enabled support for every Peertube instance to run through this proxy by default.

### AI code gen

I developed this proxy using Claude Code to write most of the codebase. I have reviewed the code and poked at it where I saw the opportunities for security issues to crop up, and also to improve the functionality. My one request is if you make any PRs, please be an actual person filing issues and responding to question, even if you use an LLM of some kind to write the code.
