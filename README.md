# Kindred Companion Sciences — Landing Page

The marketing site for Kindred Companion Sciences, live at **https://www.kindredcompanion.com**.

It's a lightweight, hand-built static site — plain HTML, CSS, and JavaScript with **no build
step**. The files in this repository are exactly what gets served, which keeps it fast and simple.
 
This README is a map of how the site is set up and where to go to change things. 
 
---
 
## How the site is hosted and updated

| Piece | Service | What it does |
|---|---|---|
| Code | **GitHub** (this repo) | The source of truth for the site |
| Hosting | **Vercel** | Serves the site and **auto-deploys every time a change is committed** to the repo |
| Domain / DNS | **GoDaddy** | Registrar and DNS for kindredcompanion.com |

**The update loop:** any change committed to this repository — whether edited through the CMS or
directly in the code — is automatically built and published by Vercel within about a minute.
There is nothing to deploy manually.

---

## Editing content

There are two ways to change what's on the page, depending on what you're changing.

### 1. The CMS — no code required

Two areas are set up for self-service editing through **Pages CMS**
(**https://app.pagescms.org** — sign in with a GitHub account that has access to this repo):

- **"Read the paper" link** (in the Science section) — show or hide it, and set the link URL.
- **News section** — show or hide the whole section, and add / edit / remove articles
  (each has an uploaded image, a headline, and a link).

Saving in Pages CMS commits the change to this repo, which then auto-deploys. Nothing else needed.

*Tip:* the news layout is a 3-across grid, so it looks most balanced with articles in
**multiples of three** (3, 6, 9…). Other counts still work, they just leave a partial last row.

### 2. Direct code edit — for everything else

All other page copy (the hero, mission, science stages, "where we are today" timeline, FAQ, etc.)
lives directly in **`index.html`** on GitHub. Changing that text means editing the file and committing it —
a developer task. The file map below shows where things are.

---

## Project structure

```
index.html        The whole page, top to bottom — all fixed copy and the <head> SEO tags live here
privacy.html      Privacy policy page
styles.css        All styling
script.js         Interactions: animations, the signup form, and loading the CMS content
.pages.yml        Pages CMS configuration (defines the editable fields)
content/          CMS-editable content — paper.json and news.json
assets/images/    Photos, logo, icons (news uploads land in assets/images/news/)
assets/fonts/     Season Sans web fonts
robots.txt        Tells search engines they may crawl the site; points to the sitemap
sitemap.xml       Lists the pages for search engines
```

---

## Services & where to manage them

Everything the site relies on, and where you'd go to change each one.

### Domain & DNS
- **kindredcompanion.com** is registered at **GoDaddy**; the domain is connected to the site in
  **Vercel → Settings → Domains**.
- **www is the primary address** — the bare `kindredcompanion.com` redirects to
  `https://www.kindredcompanion.com`.
- The old **can9bio.com** domain forwards to the new site (configured in GoDaddy's forwarding).
- *To change the domain wiring:* Vercel Domains (to add or redirect a domain) plus GoDaddy
  (for the underlying DNS records).

### Analytics — Plausible
- Privacy-friendly analytics (no cookie banner needed). Dashboard at **plausible.io**.
- Tracks page visits and signup-form submissions. The tracking snippet sits in the `<head>` of
  `index.html`.
- *To view stats or change settings:* the Plausible dashboard.

### Signup form — Basin
- The "Join the list" form sends submissions to **Basin** (usebasin.com) — that's where entries are
  collected, exported, and where you'd set up email notifications.
- It's a two-step form: name + email first, then a couple of optional questions.
- *To change where submissions go, add notifications, or adjust spam rules:* the Basin dashboard.

### Spam protection — Cloudflare Turnstile
- An **invisible** anti-spam check on the signup form (no puzzle for real visitors), verified by Basin.
- Managed in the **Cloudflare → Turnstile** dashboard. The public "site key" is in `index.html`; the
  secret key lives in Basin and is never stored in this repo.
- If a new domain or subdomain is ever added, add it to the widget's **Hostname Management** in
  Cloudflare, or the form's spam check will fail there.

### Search visibility / SEO
- **Google Search Console** is where you monitor indexing and can request a re-crawl after changes.
- `sitemap.xml` and `robots.txt` (in the repo root) help search engines find and crawl the site.
- The page title, description, social-share (Open Graph) tags, and company information (structured
  data) all live in the `<head>` of `index.html`.
- *After changing any of those:* commit and let it deploy, then request re-indexing in Search
  Console so Google picks the change up sooner (otherwise it can take a while on its own).

---

## Fonts

**Season Sans** (the primary typeface) is bundled locally in `assets/fonts/`. The handwritten accent
uses **Caveat**, and **Hanken Grotesk** is the fallback — both loaded from Google Fonts.
