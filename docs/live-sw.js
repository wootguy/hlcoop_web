// Adds the headers that make a page cross-origin isolated, which the live view's player needs
// for its threads (see live_view.js). GitHub Pages can't send them itself.
//
// Only the dashboard loaded with ?live=1 and the files in player/ get them, so the rest of the site
// works as before. COEP is "credentialless" rather than "require-corp" so images from other sites
// (Steam avatars, map images) still load on the isolated dashboard.
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
		|| (req.mode === 'navigate' && url.searchParams.has('live'));
	if (!isolate)
		return;

	e.respondWith(fetch(req).then(function(res) {
		if (res.status === 0)
			return res;
		var headers = new Headers(res.headers);
		headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
		headers.set('Cross-Origin-Resource-Policy', 'same-origin');
		return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
	}));
});
