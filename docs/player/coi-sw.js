// Adds the headers that make the page cross-origin isolated, for static hosts that can't set
// them (GitHub Pages). The player needs isolation for SharedArrayBuffer, which its threads use.
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function(e) {
	var req = e.request;
	if (req.cache === 'only-if-cached' && req.mode !== 'same-origin')
		return;
	if (new URL(req.url).origin !== self.location.origin)
		return; // cross-origin downloads (fastdl) are CORS requests, which isolation allows as-is

	e.respondWith(fetch(req).then(function(res) {
		if (res.status === 0)
			return res;
		var headers = new Headers(res.headers);
		headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		headers.set('Cross-Origin-Resource-Policy', 'same-origin');
		return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
	}));
});
