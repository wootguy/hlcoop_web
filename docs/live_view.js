// Live view: replaces the upcoming maps list with the HLTV demo player in player/ (a copy of
// bspbot's build-web folder: bspguy.js, bspguy.wasm, index.html, coi-sw.js).
//
// The player runs on threads, which browsers only allow on a cross-origin isolated page. An iframe
// can only be isolated if the page around it is too, so the dashboard itself needs the
// Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers:
//   - server.bat (bspbot's web/serve.py --coep credentialless) sends them on every page. It also
//     relays the stream and proxies fastdl downloads, so the player doesn't need the game server to
//     have a WebSocket relay or CORS headers.
//   - GitHub Pages can't send headers, so live-sw.js adds them. It only does that for pages loaded
//     with ?live=1, so the dashboard reloads once with that parameter the first time the live view
//     opens. The player then connects to the game server directly (see web/README.md in bspbot).

var LIVE_URL_PARAM = "live";
var LIVE_RELOAD_KEY = "live-view-reloaded";
var LIVE_SHOWED_MAPS_KEY = "live-view-showed-maps"; // the map list was hidden before the live view opened

function live_session_get(key) {
	try { return sessionStorage.getItem(key); } catch (e) { return null; }
}
function live_session_set(key, val) {
	try {
		if (val === null) sessionStorage.removeItem(key);
		else sessionStorage.setItem(key, val);
	} catch (e) {}
}

// true when served by server.bat, which proxies the stream and fastdl for the player
function live_has_proxy() {
	return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

function live_server_address() {
	let selector = document.getElementById("server_selector");
	let config = (selector && g_server_configs[selector.value]) || g_server_config;
	return config.hltv_address;
}

function live_player_url() {
	let params = new URLSearchParams();
	params.set("server", live_server_address());
	params.set("connect", "1");
	if (!live_has_proxy())
		params.set("direct", "1");
	return "player/index.html?" + params.toString();
}

function live_page_url(enabled) {
	let url = new URL(location.href);
	if (enabled)
		url.searchParams.set(LIVE_URL_PARAM, "1");
	else
		url.searchParams.delete(LIVE_URL_PARAM);
	return url.toString();
}

function live_status(text) {
	let status = document.getElementById("live_view_status");
	status.textContent = text;
	status.classList.toggle("hidden", !text);
}

function live_view_is_open() {
	return !document.getElementById("live_view").classList.contains("hidden");
}

function set_live_view_visible(visible) {
	document.getElementById("map_list_container").classList.toggle("live_active", visible);
	document.getElementById("live_view").classList.toggle("hidden", !visible);
}

// hlcoop.js's setup() may still be running (it's async), so this sets the state the same way its
// show/hide buttons do instead of clicking them. setup() calls handle_resize() itself when it finishes.
function set_maps_hidden(hidden) {
	document.getElementById("hide_maps_cb").checked = g_settings.hide_maps = hidden;
	save_settings();
	try {
		handle_resize();
		if (!hidden)
			update_map_data();
	} catch (e) {}
}

function remove_live_frame() {
	document.querySelectorAll("#live_view_frame_container iframe").forEach(function(frame) {
		frame.remove();
	});
}

// reloads the dashboard with live-sw.js adding the isolation headers
function live_enable_isolation() {
	let unsupported = "Your browser can't run the live view on this page. It needs service workers and "
		+ "cross-origin isolation (try a current Chrome, Edge or Firefox).";

	if (!("serviceWorker" in navigator) || !window.isSecureContext) {
		live_status(unsupported);
		return;
	}
	if (live_session_get(LIVE_RELOAD_KEY)) {
		live_session_set(LIVE_RELOAD_KEY, null); // the reload didn't help. Let the button try again
		live_status(unsupported);
		return;
	}

	live_status("Loading...");
	navigator.serviceWorker.register("live-sw.js").then(function() {
		return navigator.serviceWorker.ready;
	}).then(function() {
		live_session_set(LIVE_RELOAD_KEY, "1");
		location.replace(live_page_url(true));
	}).catch(function(e) {
		live_status("The live view couldn't start: " + e);
	});
}

function open_live_view() {
	// the live view takes the place of the map list, so that has to be showing
	if (document.getElementById("hide_maps_cb").checked) {
		live_session_set(LIVE_SHOWED_MAPS_KEY, "1");
		set_maps_hidden(false);
	}

	set_live_view_visible(true);
	remove_live_frame();

	if (!window.crossOriginIsolated) {
		live_enable_isolation();
		return;
	}
	live_session_set(LIVE_RELOAD_KEY, null);
	history.replaceState(history.state, "", live_page_url(true)); // reloading keeps the view open
	live_status("");

	let frame = document.createElement("iframe");
	frame.src = live_player_url();
	frame.allow = "autoplay; fullscreen";
	document.getElementById("live_view_frame_container").appendChild(frame);
	document.getElementById("live_view_newtab").href = frame.src;
}

function close_live_view() {
	remove_live_frame();
	set_live_view_visible(false);
	history.replaceState(history.state, "", live_page_url(false));
	if (live_session_get(LIVE_SHOWED_MAPS_KEY)) {
		live_session_set(LIVE_SHOWED_MAPS_KEY, null);
		set_maps_hidden(true);
	}
}

ready(function() {
	document.getElementById("watch_live_button").addEventListener("click", open_live_view);
	document.getElementById("watch_live_alt_button").addEventListener("click", open_live_view); // shown while maps are hidden
	document.getElementById("close_live_button").addEventListener("click", close_live_view);

	document.getElementById("server_selector").addEventListener("change", function() {
		if (live_view_is_open() && window.crossOriginIsolated)
			open_live_view(); // reconnect to the new server's stream
	});

	if (new URL(location.href).searchParams.has(LIVE_URL_PARAM))
		open_live_view();
});
