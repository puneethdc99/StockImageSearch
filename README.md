# Free Stock Photos Dashboard

A serverless, single-page dashboard for searching, browsing, and downloading free stock photos. Built with plain HTML, CSS, and vanilla JavaScript  no frameworks, no build step.

---

## What the App Does

- **Landing grid**  On load, the app uses the best available provider. If no API keys are configured it automatically falls back to **Openverse** (no key needed).
- **Search**  Type any keyword and get results from your selected provider.
- **Category chips**  One-click browsing for 7 curated categories. Chips automatically prefer a no-key provider when no API key is configured for the chip's assigned provider.
- **Filters**  Orientation, color, sort order, safe search, and provider selection.
- **Image cards**  Thumbnail, photographer credit, provider badge, View and Download actions.
- **Modal viewer**  Full-size image, complete attribution, Download and Open Source Page buttons.
- **Infinite scroll**  Automatically loads more results via `IntersectionObserver`.
- **Dark mode**  Respects `prefers-color-scheme`.
- **Accessibility**  All images have `alt` text; keyboard navigable; WCAG AA contrast.

---

## Category Chips

| Chip | Default Provider | No-Key Fallback |
|---|---|---|
| Nature | Pexels | Openverse |
| Entertainment | Pixabay | Openverse |
| Hollywood Celebrity | Wikimedia Commons | always free |
| People | Pexels | Openverse |
| Animals | Pixabay | Openverse |
| Art | Met Museum | always free |
| Science & Space | Openverse | always free |

> Chips with a keyed default provider **automatically switch** to their no-key fallback when no API key is configured. No manual action needed.

---

## Supported Providers

### Keyed (require an API key)

| Provider | Notes |
|---|---|
| **Pexels** | General photography, high quality |
| **Pixabay** | Photos, illustrations, vectors |
| **Unsplash** | Curated editorial photography |

### Key-Free (work without any configuration)

| Provider | Content Type |
|---|---|
| **Wikimedia Commons** | Freely licensed / public domain media |
| **Openverse** | CC-licensed photos from public collections |
| **Met Museum** | Public domain fine art from the Metropolitan Museum of Art |
| **Art Institute of Chicago (AIC)** | Public domain artworks from AIC's open collection |

---

## How to Run Locally

No server, no install, no build step required.

1. **Clone or download** this repository.
2. **Open `index.html`** directly in any modern browser (Chrome, Edge, Firefox, Safari).
3. The app loads immediately using **Openverse**  no keys required.
4. Optionally **add API keys** via the Settings panel to unlock Pexels, Pixabay, and Unsplash.

> Tip: If your browser blocks `file://` CORS requests, serve with a simple local server:
> ```
> npx serve .
> # or
> python -m http.server 8080
> ```
> Then open `http://localhost:8080`.

---

## How to Configure API Keys

Click the gear icon in the header to open the **Settings panel**. Keys are saved in your browser's `localStorage` under `fsp_key_pexels`, `fsp_key_pixabay`, and `fsp_key_unsplash`.

You may also hard-code defaults in `app.js` in the `DEFAULT_KEYS` object near the top of the file.

### Getting Free API Keys

| Provider | Sign-up URL | Free Limits |
|---|---|---|
| **Pexels** | https://www.pexels.com/api/ | 200 req/hr, 20 000/mo |
| **Pixabay** | https://pixabay.com/api/docs/ | 100 req/60 s |
| **Unsplash** | https://unsplash.com/developers | 50 req/hr (demo) |

### Security Notice

This is a **purely client-side application**. Any API key you enter will be visible in `localStorage` and in DevTools network requests.

**Recommendations:**
- Do not enter keys with high quotas or production billing on untrusted machines.
- For **Unsplash**, their guidelines state that keys must remain confidential  a server-side proxy is required for production use. This demo is acceptable for personal testing only.
- For **Pexels** and **Pixabay**, client-side usage is common and explicitly supported, provided attribution is shown.
- The key-free providers (Wikimedia Commons, Openverse, Met Museum, AIC) have no credentials to protect.

---

## Licensing & Attribution

### Pexels
- Free to use; attribution is encouraged and required for higher API limits.
- Attribution shown on every card and in the modal: "Photo by [Name] on Pexels".
- https://www.pexels.com/license/

### Pixabay
- Free to use with restrictions; no permanent hotlinking of original images.
- This app displays `webformatURL` thumbnails for search results (permitted).
- Download links point to the Pixabay **source page** (`pageURL`), not direct image files.
- Attribution shown: "Image by [user] on Pixabay".
- https://pixabay.com/service/license-summary/

### Unsplash
- Free to use; attribution appreciated.
- All image URLs are hotlinked via the API (required by Unsplash guidelines).
- Download action triggers the `download_location` endpoint as required by Unsplash API guidelines.
- Attribution includes UTM parameters linking back to the photographer and Unsplash.
- https://unsplash.com/license
- Cannot be used to build a competing stock photo service.

### Wikimedia Commons
- Only freely licensed or public domain content.
- **Attribution is mandatory** for CC-licensed works.
- Each card and modal shows: "[Author], [License] via Wikimedia Commons" with links to the file page.
- Download links point to the file description page on Commons, not direct media files.
- https://commons.wikimedia.org/wiki/Commons:Reuse_of_content_outside_Wikimedia

### Openverse
- Aggregates openly licensed media from many public sources.
- All results carry Creative Commons or public domain licenses.
- Attribution shown per CC license requirements: "[Title] by [Creator] ([License])".
- https://openverse.org/ | https://creativecommons.org/licenses/

### Met Museum
- Open Access artworks only (public domain, `isPublicDomain: true`).
- No restrictions on download or reuse.
- Attribution shown: "[Title]  [Artist]. The Metropolitan Museum of Art."
- https://www.metmuseum.org/about-the-met/policies-and-documents/open-access

### Art Institute of Chicago (AIC)
- Public domain works from AIC's open-access collection.
- Images served via the IIIF image API.
- Attribution shown: "[Title]  [Artist]. Art Institute of Chicago."
- https://www.artic.edu/open-access/open-access-images

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
   - Go to your repo on GitHub -> Settings -> Pages.
   - Under Source, select **Deploy from a branch**.
   - Choose **main** branch, **/ (root)** folder.
   - Click **Save**.

3. **Wait ~60 seconds**, then visit:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

4. **API keys:** Enter them via the Settings panel after the page loads. They persist in that browser's `localStorage` only  you will need to re-enter them on other devices.

> **Note:** The dashboard works immediately on first visit with no setup  Openverse, Met Museum, AIC, and Wikimedia Commons all load without any API key.

---

## Project Structure

```
/
  index.html      Semantic HTML: header, search, chips, filters, grid, two div-overlay modals
  styles.css      Mobile-first CSS Grid layout, dark mode, shimmer skeletons, animations, a11y
  app.js          Vanilla JS: 7 provider adapters, smart provider fallback, infinite scroll, events
  README.md       This file
```

---

## Smart Provider Fallback

The app resolves the active provider at two points:

1. **On initial load** (`init()`): if no API keys are stored in `localStorage`, the provider is automatically set to `openverse`.
2. **On category chip click** (`resolveProvider()`): if a chip's preferred provider (e.g., Pexels for Nature) requires a key that is not configured, the app silently switches to the appropriate key-free fallback for that category. The provider dropdown updates to reflect the active provider.

This means the dashboard is **fully functional out of the box** with no configuration needed.

---

## Known Limitations

- **No persistent storage** of results  session only (per provider API guidelines).
- **Pixabay original downloads** redirect to the source page; direct file download is not provided to comply with Pixabay's no-permanent-hotlinking policy.
- **Unsplash keys** are exposed client-side in this demo. Use a server proxy for production.
- **Wikimedia Commons** celebrity search quality depends on MediaWiki full-text search; results may include non-celebrity images. Searching actor names directly yields better results.
- **Met Museum** results are limited to works that have associated public-domain images; some queries may return fewer results than expected.
- **CORS**: All 7 providers support browser CORS. Wikimedia uses `origin=*`; Openverse, Met, and AIC set permissive CORS headers; Pexels/Pixabay/Unsplash set appropriate response headers.
