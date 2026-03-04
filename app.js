/* ══════════════════════════════════════════════════════════════════════════
   Free Stock Photos Dashboard — app.js
   Vanilla JS, no frameworks, no build step required
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── CONFIG ────────────────────────────────────────────────────────────── */
  // Replace the placeholder values below with your own keys,
  // OR enter them at runtime via the Settings panel.
  // NOTE: Keys stored here (or in localStorage) are visible in browser
  // DevTools and network traffic. See README for details.
  const DEFAULT_KEYS = {
    pexels:   '',   // https://www.pexels.com/api/
    pixabay:  '',   // https://pixabay.com/api/docs/
    unsplash: '',   // https://unsplash.com/developers
  };

  const PER_PAGE = 20;

  const PIXABAY_CATEGORY_MAP = {
    nature:        'nature',
    entertainment: 'music',
    people:        'people',
    animals:       'animals',
    celebrity:     '', // handled by Wikimedia Commons
  };

  // Providers that need an API key
  const KEY_PROVIDERS = new Set(['pexels', 'pixabay', 'unsplash']);

  // For each category, which free (no-key) provider to use as fallback
  const FREE_FALLBACK = {
    nature:        'openverse',
    entertainment: 'openverse',
    celebrity:     'commons',   // Wikimedia Commons — always free
    people:        'openverse',
    animals:       'openverse',
    art:           'met',
    science:       'openverse',
  };

  function resolveProvider(preferredProvider, category) {
    if (!KEY_PROVIDERS.has(preferredProvider)) return preferredProvider; // already free
    if (getKey(preferredProvider)) return preferredProvider;             // key is configured
    return FREE_FALLBACK[category] || 'openverse';                       // fall back to free
  }

  /* ─── KEY STORE ─────────────────────────────────────────────────────────── */
  function getKey(provider) {
    return localStorage.getItem('fsp_key_' + provider) || DEFAULT_KEYS[provider] || '';
  }
  function setKey(provider, value) {
    if (value) localStorage.setItem('fsp_key_' + provider, value);
    else localStorage.removeItem('fsp_key_' + provider);
  }

  /* ─── FETCH HELPER ──────────────────────────────────────────────────────── */
  let abortController = null;

  async function apiFetch(url, options = {}, retries = 2) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...options, signal });

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
          if (attempt < retries) {
            const delay = (retryAfter * 1000) + jitter();
            showToast(`Rate limit reached — retrying in ${Math.round(delay / 1000)}s…`, 'warn');
            await sleep(delay);
            continue;
          }
          throw Object.assign(new Error('Rate limit exceeded'), { code: 429 });
        }
        if (res.status === 403 || res.status === 401) {
          throw Object.assign(new Error('API key invalid or missing'), { code: res.status });
        }
        if (!res.ok) {
          throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status });
        }
        return res.json();
      } catch (err) {
        if (err.name === 'AbortError') return null;
        if (attempt < retries) {
          await sleep(2000 * (attempt + 1) + jitter());
          continue;
        }
        throw err;
      }
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function jitter()  { return Math.floor(Math.random() * 500); }

  // Lightweight fetch for parallel sub-requests (no abort controller)
  async function simpleFetch(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    } catch (_) { return null; }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PROVIDER ADAPTERS
     Each returns: { items: NormalizedPhoto[], totalPages: number, total: number }
     ══════════════════════════════════════════════════════════════════════════ */

  /* Unified photo shape:
    {
      id, thumbUrl, fullUrl, altText,
      author, authorUrl, provider, sourcePage,
      license, licenseUrl, downloadFn, attribution
    }
  */

  /* ─── PEXELS ─────────────────────────────────────────────────────────────── */
  const pexelsAdapter = {
    name: 'pexels',
    label: 'Pexels',
    async search(query, filters, page) {
      const key = getKey('pexels');
      if (!key) throw Object.assign(new Error('API key invalid or missing'), { code: 403 });

      const isLanding = !query && !filters.category;
      let url;
      if (isLanding || (!query && filters.category === 'nature')) {
        url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query || 'nature')}&per_page=${PER_PAGE}&page=${page}&orientation=${filters.orientation || ''}`;
      } else {
        const q = query || filters.category || 'nature';
        url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${page}` +
              (filters.orientation ? `&orientation=${filters.orientation}` : '') +
              (filters.color       ? `&color=${filters.color}`             : '') +
              (filters.sort === 'latest' ? '&sort=desc' : '');
      }

      const data = await apiFetch(url, {
        headers: { Authorization: key }
      });
      if (!data) return { items: [], totalPages: 0, total: 0 };

      const totalPages = Math.ceil((data.total_results || 0) / PER_PAGE);
      const items = (data.photos || []).map(p => pexelsNormalize(p));
      return { items, totalPages, total: data.total_results || 0 };
    }
  };

  function pexelsNormalize(p) {
    const thumbUrl = p.src?.medium || p.src?.small || '';
    const fullUrl  = p.src?.original || p.src?.large2x || p.src?.large || '';
    const alt      = p.alt || `Photo by ${p.photographer}`;
    return {
      id:          'pexels_' + p.id,
      thumbUrl,
      fullUrl,
      altText:     alt,
      author:      p.photographer || 'Unknown',
      authorUrl:   p.photographer_url || 'https://www.pexels.com',
      provider:    'pexels',
      sourcePage:  p.url || 'https://www.pexels.com',
      license:     'Pexels License',
      licenseUrl:  'https://www.pexels.com/license/',
      downloadFn:  () => downloadDirect(fullUrl, `pexels-${p.id}.jpg`),
      attribution: buildPexelsAttrib(p),
    };
  }

  function buildPexelsAttrib(p) {
    return `Photo by <a href="${p.photographer_url || 'https://www.pexels.com'}" target="_blank" rel="noopener noreferrer">${escHtml(p.photographer || 'Photographer')}</a> on <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>`;
  }

  /* ─── PIXABAY ────────────────────────────────────────────────────────────── */
  const pixabayAdapter = {
    name: 'pixabay',
    label: 'Pixabay',
    async search(query, filters, page) {
      const key = getKey('pixabay');
      if (!key) throw Object.assign(new Error('API key invalid or missing'), { code: 403 });

      const category = PIXABAY_CATEGORY_MAP[filters.category] || '';
      const q        = encodeURIComponent(query || '');

      let url = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&per_page=${PER_PAGE}&page=${page}&image_type=photo`;
      if (q)        url += `&q=${q}`;
      if (category) url += `&category=${category}`;
      if (filters.orientation && filters.orientation !== 'squarish') url += `&orientation=${filters.orientation}`;
      if (filters.color)        url += `&colors=${filters.color}`;
      if (filters.safesearch)   url += `&safesearch=true`;
      if (filters.sort === 'latest')  url += `&order=latest`;
      if (filters.sort === 'popular') url += `&order=popular`;

      const data = await apiFetch(url);
      if (!data) return { items: [], totalPages: 0, total: 0 };

      const total      = data.totalHits || 0;
      const totalPages = Math.ceil(total / PER_PAGE);
      const items      = (data.hits || []).map(h => pixabayNormalize(h));
      return { items, totalPages, total };
    }
  };

  function pixabayNormalize(h) {
    // Pixabay prohibits permanent hotlinking of images;
    // webformatURL is OK for display in search results.
    // For download, send user to pageURL.
    return {
      id:          'pixabay_' + h.id,
      thumbUrl:    h.webformatURL || h.previewURL || '',
      fullUrl:     h.webformatURL || '',
      altText:     (h.tags || 'Pixabay photo').split(',')[0].trim(),
      author:      h.user || 'Pixabay User',
      authorUrl:   `https://pixabay.com/users/${h.user}-${h.user_id}/`,
      provider:    'pixabay',
      sourcePage:  h.pageURL || 'https://pixabay.com',
      license:     'Pixabay License',
      licenseUrl:  'https://pixabay.com/service/license-summary/',
      downloadFn:  () => openPage(h.pageURL),
      attribution: buildPixabayAttrib(h),
    };
  }

  function buildPixabayAttrib(h) {
    return `Image by <a href="https://pixabay.com/users/${h.user}-${h.user_id}/" target="_blank" rel="noopener noreferrer">${escHtml(h.user || 'user')}</a> on <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer">Pixabay</a>. <a href="${h.pageURL}" target="_blank" rel="noopener noreferrer">View original &amp; download</a> (Pixabay License — no permanent hotlinking).`;
  }

  /* ─── UNSPLASH ───────────────────────────────────────────────────────────── */
  const unsplashAdapter = {
    name: 'unsplash',
    label: 'Unsplash',
    async search(query, filters, page) {
      const key = getKey('unsplash');
      if (!key) throw Object.assign(new Error('API key invalid or missing'), { code: 403 });

      const q   = encodeURIComponent(query || 'nature');
      let url   = `https://api.unsplash.com/search/photos?query=${q}&page=${page}&per_page=${PER_PAGE}&client_id=${encodeURIComponent(key)}`;
      if (filters.orientation) url += `&orientation=${filters.orientation}`;
      if (filters.color)       url += `&color=${filters.color}`;
      if (filters.sort === 'latest') url += `&order_by=latest`;

      const data = await apiFetch(url);
      if (!data) return { items: [], totalPages: 0, total: 0 };

      const total      = data.total || 0;
      const totalPages = Math.min(data.total_pages || 0, 50); // Unsplash caps at 50 pages
      const items      = (data.results || []).map(p => unsplashNormalize(p, key));
      return { items, totalPages, total };
    }
  };

  function unsplashNormalize(p, key) {
    const dlLocation = (p.links?.download_location || '') + `&client_id=${encodeURIComponent(key)}`;
    return {
      id:          'unsplash_' + p.id,
      thumbUrl:    p.urls?.small || p.urls?.thumb || '',
      fullUrl:     p.urls?.regular || p.urls?.full || '',
      altText:     p.alt_description || p.description || `Photo by ${p.user?.name}`,
      author:      p.user?.name || 'Unknown',
      authorUrl:   (p.user?.links?.html || 'https://unsplash.com') + '?utm_source=free_stock_photos&utm_medium=referral',
      provider:    'unsplash',
      sourcePage:  (p.links?.html || 'https://unsplash.com') + '?utm_source=free_stock_photos&utm_medium=referral',
      license:     'Unsplash License',
      licenseUrl:  'https://unsplash.com/license',
      downloadFn:  () => unsplashDownload(dlLocation, p.urls?.full || p.urls?.regular || '', p.id),
      attribution: buildUnsplashAttrib(p),
    };
  }

  async function unsplashDownload(downloadLocation, imageUrl, id) {
    // Unsplash requires triggering the download_location endpoint
    if (downloadLocation) {
      try { await fetch(downloadLocation); } catch (_) { /* non-blocking */ }
    }
    downloadDirect(imageUrl, `unsplash-${id}.jpg`);
  }

  function buildUnsplashAttrib(p) {
    const authorUrl = (p.user?.links?.html || 'https://unsplash.com') + '?utm_source=free_stock_photos&utm_medium=referral';
    return `Photo by <a href="${authorUrl}" target="_blank" rel="noopener noreferrer">${escHtml(p.user?.name || 'Photographer')}</a> on <a href="https://unsplash.com/?utm_source=free_stock_photos&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
  }

  /* ─── WIKIMEDIA COMMONS (Hollywood Celebrity) ────────────────────────────── */
  const commonsAdapter = {
    name: 'commons',
    label: 'Wikimedia Commons',
    async search(query, filters, page) {
      const sroffset = (page - 1) * PER_PAGE;
      const searchTerm = query ? query + ' portrait' : 'celebrity portrait';

      const url = `https://commons.wikimedia.org/w/api.php?action=query` +
        `&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}` +
        `&gsrnamespace=6&gsrlimit=${PER_PAGE}&gsroffset=${sroffset}` +
        `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400` +
        `&format=json&origin=*`;

      const data = await apiFetch(url);
      if (!data || !data.query) return { items: [], totalPages: 0, total: 0 };

      const pages = Object.values(data.query.pages || {});
      const items = pages
        .filter(pg => pg.imageinfo && pg.imageinfo[0]?.url)
        .map(pg => commonsNormalize(pg));

      // Wikimedia API doesn't give a reliable total; estimate from search continuation
      const hasContinue = !!(data.continue);
      const totalPages  = hasContinue ? page + 1 : page;

      return { items, totalPages, total: items.length };
    }
  };

  function commonsNormalize(pg) {
    const info  = pg.imageinfo[0];
    const meta  = info.extmetadata || {};
    const thumb = info.thumburl || info.url;
    const full  = info.url;

    const rawAuthor  = meta.Artist?.value || meta.Credit?.value || 'Unknown';
    const author     = stripHtml(rawAuthor);
    const license    = meta.LicenseShortName?.value || meta.License?.value || 'Unknown License';
    const licenseUrl = meta.LicenseUrl?.value || 'https://commons.wikimedia.org';
    const title      = pg.title?.replace(/^File:/i, '').replace(/\.(jpg|jpeg|png|gif|svg|webp)$/i, '') || 'Wikimedia Image';
    const filePage   = `https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title || '')}`;

    return {
      id:          'commons_' + pg.pageid,
      thumbUrl:    thumb,
      fullUrl:     full,
      altText:     title,
      author,
      authorUrl:   filePage,
      provider:    'commons',
      sourcePage:  filePage,
      license,
      licenseUrl,
      downloadFn:  () => openPage(filePage),
      attribution: buildCommonsAttrib(author, license, licenseUrl, filePage, rawAuthor),
    };
  }

  function buildCommonsAttrib(author, license, licenseUrl, filePage, rawAuthorHtml) {
    const authorDisplay = rawAuthorHtml && rawAuthorHtml !== author ? rawAuthorHtml : escHtml(author);
    return `${authorDisplay}, <a href="${licenseUrl}" target="_blank" rel="noopener noreferrer">${escHtml(license)}</a>, via <a href="${filePage}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>`;
  }

  /* ─── OPENVERSE (CC-licensed images, no key required) ────────────────────── */
  const openverseAdapter = {
    name: 'openverse',
    label: 'Openverse',
    async search(query, filters, page) {
      const q = encodeURIComponent(query || filters.category || 'nature');
      let url = `https://api.openverse.org/v1/images/?q=${q}&page=${page}&page_size=${PER_PAGE}`;
      if (filters.orientation === 'landscape') url += '&aspect_ratio=wide';
      if (filters.orientation === 'portrait')  url += '&aspect_ratio=tall';
      if (filters.orientation === 'squarish')  url += '&aspect_ratio=square';
      if (!filters.safesearch) url += '&mature=true';

      const data = await apiFetch(url);
      if (!data) return { items: [], totalPages: 0, total: 0 };

      const total      = data.count || 0;
      const totalPages = Math.min(Math.ceil(total / PER_PAGE), 50);
      const items      = (data.results || []).map(r => openverseNormalize(r));
      return { items, totalPages, total };
    }
  };

  function openverseNormalize(r) {
    const licenseLabel = r.license_version
      ? `${(r.license || '').toUpperCase()} ${r.license_version}`
      : (r.license || 'CC').toUpperCase();
    return {
      id:          'openverse_' + r.id,
      thumbUrl:    r.thumbnail || r.url,
      fullUrl:     r.url,
      altText:     r.title || 'Openverse image',
      author:      r.creator || 'Unknown',
      authorUrl:   r.creator_url || 'https://openverse.org',
      provider:    'openverse',
      sourcePage:  r.foreign_landing_url || r.url,
      license:     licenseLabel,
      licenseUrl:  r.license_url || 'https://creativecommons.org',
      downloadFn:  () => downloadDirect(r.url, `openverse-${r.id}.jpg`),
      attribution: r.attribution || buildOpenverseAttrib(r, licenseLabel),
    };
  }

  function buildOpenverseAttrib(r, licenseLabel) {
    const authorPart = r.creator
      ? `by <a href="${escAttr(r.creator_url || '#')}" target="_blank" rel="noopener noreferrer">${escHtml(r.creator)}</a> `
      : '';
    return `&ldquo;${escHtml(r.title || 'Image')}&rdquo; ${authorPart}is licensed under <a href="${escAttr(r.license_url || 'https://creativecommons.org')}" target="_blank" rel="noopener noreferrer">${escHtml(licenseLabel)}</a> via <a href="https://openverse.org" target="_blank" rel="noopener noreferrer">Openverse</a>`;
  }

  /* ─── METROPOLITAN MUSEUM OF ART (public domain, no key) ────────────────── */
  const metAdapter = {
    name: 'met',
    label: 'Met Museum',
    async search(query, filters, page) {
      const q          = encodeURIComponent(query || filters.category || 'painting');
      const searchUrl  = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${q}`;
      const searchData = await apiFetch(searchUrl);
      if (!searchData || !searchData.objectIDs?.length) return { items: [], totalPages: 0, total: 0 };

      const allIds     = searchData.objectIDs;
      const total      = allIds.length;
      const totalPages = Math.ceil(total / PER_PAGE);
      const start      = (page - 1) * PER_PAGE;
      const pageIds    = allIds.slice(start, start + PER_PAGE);

      // Parallel-fetch object details (use simpleFetch — no shared AbortController)
      const settled = await Promise.allSettled(
        pageIds.map(id =>
          simpleFetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
        )
      );

      const items = settled
        .filter(r => r.status === 'fulfilled' && r.value?.primaryImageSmall)
        .map(r => metNormalize(r.value));

      return { items, totalPages, total };
    }
  };

  function metNormalize(obj) {
    const title  = obj.title || 'Untitled';
    const artist = obj.artistDisplayName || 'Unknown Artist';
    const date   = obj.objectDate ? ` (${obj.objectDate})` : '';
    return {
      id:          'met_' + obj.objectID,
      thumbUrl:    obj.primaryImageSmall || obj.primaryImage,
      fullUrl:     obj.primaryImage || obj.primaryImageSmall,
      altText:     `${title} — ${artist}${date}`,
      author:      artist,
      authorUrl:   obj.artistProfileUrl || obj.objectURL || 'https://metmuseum.org',
      provider:    'met',
      sourcePage:  obj.objectURL || 'https://metmuseum.org',
      license:     obj.rightsAndReproduction || 'Public Domain',
      licenseUrl:  'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access',
      downloadFn:  () => downloadDirect(obj.primaryImage || obj.primaryImageSmall, `met-${obj.objectID}.jpg`),
      attribution: buildMetAttrib(obj, title, artist, date),
    };
  }

  function buildMetAttrib(obj, title, artist, date) {
    return `&ldquo;${escHtml(title)}${escHtml(date)}&rdquo; by ${escHtml(artist)}. <a href="${escAttr(obj.objectURL || 'https://metmuseum.org')}" target="_blank" rel="noopener noreferrer">The Metropolitan Museum of Art</a> — ${escHtml(obj.rightsAndReproduction || 'Public Domain')}`;
  }

  /* ─── ART INSTITUTE OF CHICAGO (open access, no key) ────────────────────── */
  const aicAdapter = {
    name: 'aic',
    label: 'Art Inst. Chicago',
    async search(query, filters, page) {
      const q   = encodeURIComponent(query || filters.category || 'landscape');
      const url = `https://api.artic.edu/api/v1/artworks/search?q=${q}&page=${page}&limit=${PER_PAGE}` +
                  `&fields=id,title,artist_display,image_id,thumbnail,date_display,credit_line,license_text,api_link`;
      const data = await apiFetch(url);
      if (!data) return { items: [], totalPages: 0, total: 0 };

      const total      = data.pagination?.total || 0;
      const totalPages = data.pagination?.total_pages || 1;
      const items      = (data.data || [])
        .filter(a => a.image_id)
        .map(a => aicNormalize(a));
      return { items, totalPages, total };
    }
  };

  function aicNormalize(a) {
    const iiifBase  = `https://www.artic.edu/iiif/2/${a.image_id}`;
    const thumbUrl  = `${iiifBase}/full/400,/0/default.jpg`;
    const fullUrl   = `${iiifBase}/full/843,/0/default.jpg`;
    const sourcePage = `https://www.artic.edu/artworks/${a.id}`;
    const artist    = a.artist_display || 'Unknown Artist';
    const title     = a.title || 'Untitled';
    return {
      id:          'aic_' + a.id,
      thumbUrl,
      fullUrl,
      altText:     `${title} — ${artist}`,
      author:      artist.split('\n')[0],
      authorUrl:   sourcePage,
      provider:    'aic',
      sourcePage,
      license:     a.license_text || 'Open Access',
      licenseUrl:  'https://www.artic.edu/open-access/public-api',
      downloadFn:  () => downloadDirect(fullUrl, `aic-${a.id}.jpg`),
      attribution: buildAicAttrib(a, title, artist, sourcePage),
    };
  }

  function buildAicAttrib(a, title, artist, sourcePage) {
    return `&ldquo;${escHtml(title)}&rdquo; by ${escHtml(artist.split('\n')[0])}${a.date_display ? `, ${escHtml(a.date_display)}` : ''}. <a href="${escAttr(sourcePage)}" target="_blank" rel="noopener noreferrer">Art Institute of Chicago</a>${a.credit_line ? ` — ${escHtml(a.credit_line)}` : ''}`;
  }

  /* --- PROVIDER REGISTRY --- */
  const PROVIDERS = {
    pexels:    pexelsAdapter,
    pixabay:   pixabayAdapter,
    unsplash:  unsplashAdapter,
    commons:   commonsAdapter,
    openverse: openverseAdapter,
    met:       metAdapter,
    aic:       aicAdapter,
  };

  /* ══════════════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════════════ */
  const state = {
    provider:   'pexels',
    query:      '',
    category:   'nature',
    filters: {
      orientation: '',
      color:       '',
      sort:        'relevant',
      safesearch:  true,
    },
    page:       1,
    totalPages: 1,
    loading:    false,
    results:    [],        // NormalizedPhoto[]
    photoMap:   {},        // id → NormalizedPhoto (for modal lookup)
  };

  function getFilters() {
    return { ...state.filters, category: state.category };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  const grid       = document.getElementById('photo-grid');
  const resultsBar = document.getElementById('results-bar');

  /* ─── Skeletons ─────────────────────────────────────────────────────────── */
  function renderSkeletons(n = PER_PAGE) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'skeleton';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `
        <div class="skeleton-img"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-line-short"></div>`;
      frag.appendChild(el);
    }
    return frag;
  }

  /* ─── Grid ──────────────────────────────────────────────────────────────── */
  function renderGrid(items, append = false) {
    if (!append) {
      grid.innerHTML = '';
      state.photoMap = {};
    }
    // Remove any lingering skeletons
    grid.querySelectorAll('.skeleton').forEach(el => el.remove());

    if (items.length === 0 && !append) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon">🔍</div>
        <h3>No photos found</h3>
        <p>Try different keywords, a different category, or switch the provider in filters.</p>`;
      grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(photo => {
      state.photoMap[photo.id] = photo;
      frag.appendChild(renderCard(photo));
    });
    grid.appendChild(frag);
  }

  /* ─── Card ──────────────────────────────────────────────────────────────── */
  function renderCard(photo) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.setAttribute('data-id', photo.id);
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', photo.altText);

    const provBadgeClass = {
      pexels:    'badge-prov-pexels',
      pixabay:   'badge-prov-pixabay',
      unsplash:  'badge-prov-unsplash',
      commons:   'badge-prov-commons',
      openverse: 'badge-prov-openverse',
      met:       'badge-prov-met',
      aic:       'badge-prov-aic',
    }[photo.provider] || 'badge-prov-pexels';

    card.innerHTML = `
      <div class="card-image-wrap">
        <img
          class="card-img"
          src="${escAttr(photo.thumbUrl)}"
          alt="${escAttr(photo.altText)}"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'300\\'%3E%3Crect width=\\'400\\' height=\\'300\\' fill=\\'%23e0e0e5\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%236b6b80\\' font-size=\\'14\\'%3EImage unavailable%3C/text%3E%3C/svg%3E'"
        />
        <span class="card-provider-badge ${provBadgeClass}">${escHtml(PROVIDERS[photo.provider]?.label || photo.provider)}</span>
      </div>
      <div class="card-info">
        <p class="card-author">
          📷 <a href="${escAttr(photo.authorUrl)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${escHtml(photo.author)}</a>
        </p>
        <div class="card-attribution">${photo.attribution}</div>
        <div class="card-actions">
          <button class="card-btn card-btn-view" data-action="view" data-id="${escAttr(photo.id)}" aria-label="View ${escAttr(photo.altText)}">👁 View</button>
          <button class="card-btn card-btn-dl"  data-action="download" data-id="${escAttr(photo.id)}" aria-label="Download ${escAttr(photo.altText)}">↓ Download</button>
        </div>
      </div>`;
    return card;
  }

  /* ─── Modal Viewer ──────────────────────────────────────────────────────── */
  const modalViewer   = document.getElementById('modal-viewer');
  const modalImg      = document.getElementById('modal-img');
  const modalTitle    = document.getElementById('modal-title');
  const modalAuthor   = document.getElementById('modal-author');
  const modalAttrib   = document.getElementById('modal-attribution');
  const modalDownload = document.getElementById('modal-download');
  const modalSource   = document.getElementById('modal-source');
  const modalCopyAttr = document.getElementById('modal-copy-attr');

  function openModal(photoId) {
    const photo = state.photoMap[photoId];
    if (!photo) return;

    modalImg.src    = photo.fullUrl || photo.thumbUrl;
    modalImg.alt    = photo.altText;
    modalTitle.textContent = photo.altText;
    modalAuthor.innerHTML  = `By <a href="${escAttr(photo.authorUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(photo.author)}</a> · ${escHtml(PROVIDERS[photo.provider]?.label || photo.provider)} · <a href="${escAttr(photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(photo.license)}</a>`;
    modalAttrib.innerHTML  = photo.attribution;
    modalSource.href        = photo.sourcePage;

    modalDownload.onclick = () => photo.downloadFn();
    modalCopyAttr.onclick = () => copyAttribution(photo);

    modalViewer.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-close').focus();
  }

  function closeModal() {
    modalViewer.hidden = true;
    document.body.style.overflow = '';
    modalImg.src = '';
  }

  function copyAttribution(photo) {
    const text = stripHtml(photo.attribution);
    navigator.clipboard?.writeText(text).then(() => {
      showToast('Attribution copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Could not copy — please copy manually from the attribution box.', 'warn');
    });
  }

  /* ─── Toast ─────────────────────────────────────────────────────────────── */
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' || type === 'warn' ? 'alert' : 'status');
    toast.innerHTML = `
      <span>${escHtml(message)}</span>
      <button class="toast-dismiss" aria-label="Dismiss notification">✕</button>`;

    const dismiss = () => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
    toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
    toastContainer.appendChild(toast);
    if (duration > 0) setTimeout(dismiss, duration);
  }

  /* ─── Results bar ────────────────────────────────────────────────────────── */
  function updateResultsBar(total, provider) {
    if (total > 0) {
      resultsBar.textContent = `${total.toLocaleString()} photo${total !== 1 ? 's' : ''} found via ${PROVIDERS[provider]?.label || provider}`;
    } else {
      resultsBar.textContent = '';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SEARCH / LOAD
     ══════════════════════════════════════════════════════════════════════════ */
  async function search(query, page = 1) {
    if (state.loading) return;
    state.loading  = true;
    state.query    = query;
    state.page     = page;

    // Choose provider: category chip overrides provider select
    const providerName = state.provider;
    const adapter      = PROVIDERS[providerName];

    if (page === 1) {
      grid.innerHTML = '';
      const skels = renderSkeletons();
      grid.appendChild(skels);
      resultsBar.textContent = 'Searching…';
    } else {
      // append skeletons at the bottom
      const skels = renderSkeletons(8);
      grid.appendChild(skels);
    }

    try {
      const result = await adapter.search(state.query, getFilters(), page);
      if (!result) { state.loading = false; return; } // aborted

      state.totalPages = result.totalPages || 1;
      state.results    = page === 1 ? result.items : [...state.results, ...result.items];

      renderGrid(result.items, page > 1);
      updateResultsBar(page === 1 ? result.total : state.results.length, providerName);

    } catch (err) {
      grid.querySelectorAll('.skeleton').forEach(el => el.remove());
      if (err.code === 403 || err.code === 401) {
        showToast(`API key invalid or missing for ${PROVIDERS[providerName]?.label}. Open ⚙ Settings to enter your key.`, 'error', 8000);
      } else if (err.code === 429) {
        showToast('Rate limit exceeded — please wait before searching again.', 'warn', 6000);
      } else {
        showToast(`Error: ${err.message}. Check your network connection.`, 'error', 6000);
      }
      if (page === 1) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-state-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>${escHtml(err.message)} — check your API keys in Settings or try again later.</p>
          <button class="btn btn-secondary" id="btn-retry" style="margin-top:.75rem">Retry</button>`;
        grid.appendChild(empty);
        document.getElementById('btn-retry')?.addEventListener('click', () => search(state.query, 1));
      }
    } finally {
      state.loading = false;
    }
  }

  function loadMore() {
    if (state.loading) return;
    if (state.page >= state.totalPages) return;
    search(state.query, state.page + 1);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INFINITE SCROLL
     ══════════════════════════════════════════════════════════════════════════ */
  const sentinel = document.getElementById('sentinel');
  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (entry.isIntersecting && !state.loading && state.page < state.totalPages) {
      loadMore();
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);

  /* ══════════════════════════════════════════════════════════════════════════
     EVENT WIRING
     ══════════════════════════════════════════════════════════════════════════ */

  /* Search form */
  const searchForm  = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const btnClear    = document.getElementById('btn-clear');

  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    const q = searchInput.value.trim();
    // Clear active chip because user typed a custom query
    if (q && q !== state.query) clearActiveChip();
    search(q);
  });

  searchInput.addEventListener('input', () => {
    btnClear.hidden = !searchInput.value;
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      btnClear.hidden = true;
    }
  });

  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    btnClear.hidden = true;
    searchInput.focus();
    search('');
  });

  /* Category chips */
  const chipsScroll = document.querySelector('.chips-scroll');
  chipsScroll.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    document.querySelectorAll('.chip').forEach(c => {
      c.classList.remove('chip-active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('chip-active');
    chip.setAttribute('aria-pressed', 'true');

    state.category = chip.dataset.category;
    state.provider = resolveProvider(chip.dataset.provider, chip.dataset.category);
    document.getElementById('provider-select').value = state.provider;

    // Clear search input when category chip selected
    searchInput.value = '';
    btnClear.hidden   = true;

    search('', 1);
  });

  chipsScroll.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const chip = e.target.closest('.chip');
      if (chip) chip.click();
    }
  });

  function clearActiveChip() {
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.remove('chip-active');
      c.setAttribute('aria-pressed', 'false');
    });
    state.category = '';
  }

  /* Filters */
  document.getElementById('filter-orientation').addEventListener('change', e => {
    state.filters.orientation = e.target.value;
    search(state.query);
  });
  document.getElementById('filter-color').addEventListener('change', e => {
    state.filters.color = e.target.value;
    search(state.query);
  });
  document.getElementById('filter-sort').addEventListener('change', e => {
    state.filters.sort = e.target.value;
    search(state.query);
  });
  document.getElementById('filter-safesearch').addEventListener('change', e => {
    state.filters.safesearch = e.target.checked;
    search(state.query);
  });
  document.getElementById('provider-select').addEventListener('change', e => {
    state.provider = e.target.value;
    // Sync category: if switching to Commons, use celebrity; otherwise reset
    if (state.provider === 'commons') {
      state.category = 'celebrity';
    } else if (state.category === 'celebrity') {
      state.category = 'nature';
    }
    search(state.query);
  });

  /* Photo grid (delegated events) */
  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      const photo = state.photoMap[id];
      if (!photo) return;
      if (action === 'view')     openModal(id);
      if (action === 'download') photo.downloadFn();
      return;
    }
    const card = e.target.closest('.photo-card');
    if (card) openModal(card.dataset.id);
  });

  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.photo-card');
      if (card && !e.target.closest('button, a')) {
        e.preventDefault();
        openModal(card.dataset.id);
      }
    }
  });

  /* Modal viewer */
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  /* Settings modal */
  const settingsModal = document.getElementById('settings-modal');

  function openSettings() {
    ['pexels', 'pixabay', 'unsplash'].forEach(p => {
      const el = document.getElementById('key-' + p);
      if (el) el.value = getKey(p);
    });
    settingsModal.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('settings-close').focus();
  }
  function closeSettings() {
    settingsModal.hidden = true;
    document.body.style.overflow = '';
  }

  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', closeSettings);

  // Close on Escape key for both modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!modalViewer.hidden)   closeModal();
      if (!settingsModal.hidden) closeSettings();
    }
  });

  document.getElementById('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    ['pexels', 'pixabay', 'unsplash'].forEach(p => {
      const val = document.getElementById('key-' + p)?.value.trim() || '';
      setKey(p, val);
    });
    closeSettings();
    showToast('API keys saved! 🎉', 'success');
    // Re-run current search with new keys
    search(state.query);
  });

  document.getElementById('btn-clear-keys').addEventListener('click', () => {
    ['pexels', 'pixabay', 'unsplash'].forEach(p => {
      setKey(p, '');
      const el = document.getElementById('key-' + p);
      if (el) el.value = '';
    });
    showToast('All API keys cleared.', 'info');
  });

  /* ══════════════════════════════════════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════════════════════════════════════ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(str) { return escHtml(str); }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function downloadDirect(url, filename) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.target   = '_blank';
    a.rel      = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openPage(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════════════ */
  function init() {
    // If no keyed provider is configured, fall back to Openverse (no key needed)
    const hasAnyKey = ['pexels', 'pixabay', 'unsplash'].some(p => getKey(p));
    if (!hasAnyKey) {
      state.provider = 'openverse';
      document.getElementById('provider-select').value = 'openverse';
      showToast(
        'No API keys found — showing Openverse (free, no key needed). Add keys via ⚙ Settings for Pexels/Pixabay/Unsplash.',
        'info',
        9000
      );
    }

    // Set provider select to match initial state
    document.getElementById('provider-select').value = state.provider;

    // Mark the default chip as active
    const defaultChip = document.querySelector('.chip[data-category="nature"]');
    if (defaultChip) {
      defaultChip.classList.add('chip-active');
      defaultChip.setAttribute('aria-pressed', 'true');
    }

    // Kick off initial landing search
    search('', 1);
  }

  init();

})();
