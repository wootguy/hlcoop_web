// Adds the headers that make a page cross-origin isolated, which the live view's player needs
// for its threads (see live_view.js). GitHub Pages can't send them itself.
//
// Only the dashboard (index.html) and the files in player/ get them, so the other pages work as
// before. COEP is "require-corp" because Safari doesn't support "credentialless". That blocks
// images from other sites unless they're requested with CORS, so the dashboard's cross-origin
// <img> elements have crossorigin="anonymous" (Steam avatars, player models and sprays).
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function(e) {
	var req = e.request;
	if (req.cache === 'only-if-cached' && req.mode !== 'same-origin')
		return;

	var url = new URL(req.url);
	if (url.origin !== self.location.origin)
		return;
	var isolate = url.pathname.indexOf('/player/') !== -1
		|| (req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname));
	if (!isolate)
		return;

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
