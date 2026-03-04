# Free Stock Photos Dashboard

A serverless, single-page dashboard for searching, browsing, and downloading free stock photos. Built with plain HTML, CSS, and vanilla JavaScript — no frameworks, no build step.

---

## What the App Does

- **Landing grid** — On load, searches for Nature photos via your configured provider (Pexels by default).
- **Search** — Type any keyword and get results from Pexels, Pixabay, Unsplash, or Wikimedia Commons.
- **Category chips** — One-click browsing for Nature, Entertainment, Hollywood Celebrity, People, and Animals.
- **Hollywood Celebrity** — Uses Wikimedia Commons (MediaWiki API) for freely licensed celebrity portrait images with proper CC attribution.
- **Filters** — Orientation, color, sort order, safe search, and provider selection.
- **Image cards** — Thumbnail, photographer credit, provider badge, View and Download actions.
- **Modal viewer** — Full-size image, complete attribution, Download and Open Source Page buttons.
- **Infinite scroll** — Automatically loads more results via `IntersectionObserver`.
- **Dark mode** — Respects `prefers-color-scheme`.
- **Accessibility** — All images have `alt` text; keyboard navigable; WCAG AA contrast.

---

## How to Run Locally

No server, no install, no build step required.

1. **Clone or download** this repository.
2. **Open `index.html`** directly in any modern browser (Chrome, Edge, Firefox, Safari).
3. **Add API keys** via the ⚙ Settings panel (see below).

> Tip: If your browser blocks `file://` CORS requests, serve with a simple local server:
> ```
> npx serve .
> # or
> python -m http.server 8080
> ```
> Then open `http://localhost:8080`.

---

## How to Configure API Keys

All API keys are entered at runtime through the in-app **Settings panel** (click the ⚙ gear icon in the header). Keys are saved in your browser's `localStorage` under the keys `fsp_key_pexels`, `fsp_key_pixabay`, and `fsp_key_unsplash`.

You may also hard-code defaults in `app.js` → `DEFAULT_KEYS` object (lines near the top of the file).

### Getting Free API Keys

| Provider | Sign-up URL | Notes |
|---|---|---|
| **Pexels** | https://www.pexels.com/api/ | Free; 200 req/hr, 20k/mo; higher limits with attribution |
| **Pixabay** | https://pixabay.com/api/docs/ | Free; 100 req/60s; generous overall |
| **Unsplash** | https://unsplash.com/developers | Free demo limit; see confidentiality note below |
| **Wikimedia Commons** | No key needed | Uses the public MediaWiki API (`origin=*`) |

### Security Notice ⚠️

This is a **purely client-side application**. Any API key you enter will be:

- Visible in your browser's `localStorage`.
- Transmitted in HTTP request headers/query strings (visible in DevTools).
- Potentially visible to anyone with access to your machine/browser profile.

**Recommendations:**
- Do **not** enter keys with high quotas or production billing on untrusted machines.
- For **Unsplash**, their API guidelines state that *"Access Key and Secret Key must remain confidential"* — a server-side proxy is required for production use. For this demo, the key is acceptable for personal testing only.
- For **Pexels** and **Pixabay**, client-side usage is common and explicitly supported, provided attribution is shown.

---

## Licensing & Attribution

### Pexels
- Free to use; attribution is encouraged and required for higher API limits.
- Attribution shown on every card and in modal: *"Photo by [Name] on Pexels"*.
- [Pexels License](https://www.pexels.com/license/)

### Pixabay
- Free to use with restrictions; no permanent hotlinking of original images.
- This app displays `webformatURL` thumbnails for search results (permitted).
- Download links point to the Pixabay **source page** (`pageURL`), not direct image files.
- Attribution shown: *"Image by [user] on Pixabay"*.
- [Pixabay License](https://pixabay.com/service/license-summary/)

### Unsplash
- Free to use; attribution appreciated.
- All image URLs are hotlinked via the API (required by Unsplash's guidelines).
- Download action triggers the `download_location` endpoint as required by Unsplash API guidelines.
- Attribution includes UTM parameters linking back to the photographer and Unsplash.
- [Unsplash License](https://unsplash.com/license)
- Cannot be used to build a competing stock photo service.

### Wikimedia Commons
- Only freely licensed or public domain content.
- **Attribution is mandatory** for CC-licensed works.
- Each card and modal shows: *"[Author], [License] via Wikimedia Commons"* with links to the file page.
- Download links point to the **file description page** on Commons, not direct media files.
- [Wikimedia Commons – Reuse](https://commons.wikimedia.org/wiki/Commons:Reuse_of_content_outside_Wikimedia)

---

## Deploy to GitHub Pages

1. **Create a public GitHub repository** and push this folder's contents:
   ```
   git init
   git add .
   git commit -m "Initial dashboard"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repo on GitHub → **Settings** → **Pages**.
   - Under *Source*, select **Deploy from a branch**.
   - Choose **main** branch, **/ (root)** folder.
   - Click **Save**.

3. **Wait ~60 seconds**, then visit:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

4. **API keys:** Enter them via the ⚙ Settings panel after the page loads. They persist in that browser's `localStorage` only — you'll need to re-enter them on other devices.

> **Note:** Wikimedia Commons requires no key. Nature photos will load immediately on the first visit even without configuring any keys — though results will fail gracefully with a toast notification prompting you to configure keys for Pexels/Pixabay/Unsplash.

---

## Project Structure

```
/
  index.html     — Semantic HTML: header, main, footer, two <dialog> modals
  styles.css     — Mobile-first CSS Grid layout, dark mode, animations, a11y
  app.js         — Vanilla JS: provider adapters, state, rendering, events
  README.md      — This file
```

---

## Known Limitations

- **No persistent storage** of results — session only (per provider API guidelines).
- **Pixabay original downloads** redirect to the source page; direct file download is not provided to comply with Pixabay's no-permanent-hotlinking policy.
- **Unsplash keys** are exposed client-side in this demo. Use a server proxy for production.
- **Wikimedia Commons** celebrity search quality depends on MediaWiki full-text search; results may include non-celebrity images. Refine by searching actor names directly.
- **CORS**: All four providers support browser CORS. Wikimedia uses `origin=*`; Pexels/Pixabay/Unsplash set appropriate response headers.
