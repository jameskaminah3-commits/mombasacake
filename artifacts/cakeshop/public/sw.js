const CACHE_VERSION = "v2";
const SHELL_CACHE = `channah-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `channah-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `channah-images-${CACHE_VERSION}`;
const DATA_CACHE = `channah-data-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/logo-clear.png"
];

const OFFLINE_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Image unavailable">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f7e7ef" />
        <stop offset="100%" stop-color="#f2d4e0" />
      </linearGradient>
    </defs>
    <rect width="800" height="800" fill="url(#g)" />
    <rect x="120" y="120" width="560" height="560" rx="40" fill="#ffffff" opacity="0.48" />
    <path d="M210 520l108-126 92 104 70-76 110 120" fill="none" stroke="#c45a87" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="300" cy="295" r="42" fill="#c45a87" opacity="0.8" />
    <text x="400" y="635" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#7c3558">
      Channah Cakes
    </text>
  </svg>
`)}`;

function cacheUrl(url) {
  return new URL(url, self.location.origin).toString();
}

async function putInCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
}

async function cacheFirst(request, cacheName, fallbackResponse) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return fallbackResponse;
  }
}

async function staleWhileRevalidate(request, cacheName, fallbackResponse) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const response = await refresh;
  return response || fallbackResponse;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(cacheUrl(asset)))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE, DATA_CACHE].includes(key)) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(cacheUrl("/index.html")).then((cached) => cached || fetch(request).catch(() => caches.match(cacheUrl("/index.html")))),
    );
    return;
  }

  if (!isSameOrigin) return;

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, new Response(OFFLINE_IMAGE, {
      headers: { "Content-Type": "image/svg+xml" },
    })));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (request.destination === "style" || request.destination === "script" || request.destination === "font") {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, Response.error()));
  }
});
