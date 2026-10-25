/**
 * @file sw.js
 * @description Production Service Worker for ClassPredict.
 * Provides offline application shell caching for core client-side numerical workflows.
 * 
 * STRICT PRIVACY & CACHING POLICY:
 * - Only caches immutable static application shell assets (HTML, CSS, JS, sample CSV).
 * - NEVER caches user-uploaded documents, cropped bitmaps, OCR text, or student records.
 * - All user data remains strictly ephemeral in browser memory and is never written to cache storage.
 */

const CACHE_NAME = 'classpredict-v1.1.0-static';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './css/components.css',
  './js/app.js',
  './js/core/math_utils.js',
  './js/core/data_validator.js',
  './js/core/linear_algebra.js',
  './js/core/regression_engine.js',
  './js/core/interpolation_engine.js',
  './js/core/temporal_validator.js',
  './js/core/prediction_service.js',
  './js/core/ocr_engine.js',
  './js/core/dashboard_analytics.js',
  './js/core/numerical_lab.js',
  './js/services/state_manager.js',
  './js/services/ocr_service.js',
  './js/ui/dashboard_view.js',
  './js/ui/dataset_view.js',
  './js/ui/prediction_view.js',
  './js/ui/ocr_view.js',
  './js/ui/numerical_lab_view.js',
  './samples/sample_class_sgpa.csv',
  './assets/hero_model.jpg',
  './assets/hero_thumb.jpg'
];

// Install: Cache Application Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up previous cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for HTML shell, Cache-first for static scripts/styles
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Strict guardrail: only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never intercept or cache non-HTTP(S) schemes (such as blob: or data:)
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Network-first for navigation requests (index.html) to ensure updates are delivered
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // Cache-first for local static assets with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        // Cache external CDN scripts (pdf.min.js, tesseract.min.js) if fetched successfully
        if (networkResponse && networkResponse.status === 200 && (url.origin.includes('cdnjs') || url.origin.includes('jsdelivr'))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch((err) => {
        // If offline and resource is not in cache, let caller handle error
        return new Response('Network unavailable (Offline)', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
