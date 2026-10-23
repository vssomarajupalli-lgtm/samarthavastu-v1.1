'use strict';

const CACHE_PREFIX = 'samartha-vastu-v1.1::' + new URL(self.registration.scope).pathname + '::';
const CACHE_NAME = CACHE_PREFIX + 'shell';
const APP_SHELL = ['./', './index.html', './app.js', './patches.js', './style.css', './manifest.webmanifest', './icon.svg'];
const MAX_CACHED_RESPONSE_BYTES = 5 * 1024 * 1024;
const CDN_HOSTS = new Set(['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  const sameOriginAppRequest = requestUrl.origin === scopeUrl.origin && requestUrl.pathname.startsWith(scopeUrl.pathname);
  const approvedStaticCdnRequest = CDN_HOSTS.has(requestUrl.hostname);
  if (!sameOriginAppRequest && !approvedStaticCdnRequest) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      const size = Number(response.headers.get('content-length')) || 0;
      if ((response.ok || response.type === 'opaque') && size <= MAX_CACHED_RESPONSE_BYTES) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
