var g_socket;
var g_server_url = 'wss://w00tguy.ddns.net:3000/';
//var g_server_url = 'ws://localhost:3000/'; // for Visual Studio debugging
var g_player_data = [];
var g_map_stats = [];
var g_server_name = "Half-Life Co-op";
var g_selected_map = "";
var g_reset_table_timer;
var g_mouseover_state = false;
var g_auth_params;
var g_auth_token;
var g_map_data = {};
var g_web_clients = [];
var g_steamid = 0;

const WEBMSG_SERVER_NAME = 0;
const WEBMSG_PLAYER_LIST = 1;
const WEBMSG_NEXT_MAPS = 2;
const WEBMSG_CHAT = 3;
const WEBMSG_AUTH = 4;
const WEBMSG_WEB_CLIENTS = 5;
const WEBMSG_NOT_AUTHED = 6;
const WEBMSG_LOGOUT = 7;
const WEBMSG_RATING = 8;

function get_utf8_data_len(str) {
	return new TextEncoder().encode(str).length+1;
}

function read_string(view, offset) {
	let bytes = [];

	for (let j = offset; j < view.byteLength; j++) {
		let charCode = view.getUint8(j);
		if (charCode === 0) {
			break; // Null terminator found, end of string
		}
		bytes.push(charCode);
	}

	return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

function update_table_state() {
	let plist = document.getElementById('player_list');
	
	if (g_selected_map) {
		let map_stats = undefined;
		for (let i = 0; i < g_map_stats.length; i++) {
			if (g_map_stats[i].map == g_selected_map) {
				map_stats = g_map_stats[i];
				break;
			}
		}
		
		if (!map_stats) {
			console.log("Missing map stats for " + g_selected_map);
			return;
		}
		
		for (let i = 1; i < plist.rows.length; i++) {
			let row = plist.rows[i];
			let id = row.getAttribute("steamid");
			
			if (!id) {
				row.cells[5].textContent = "";
				row.cells[6].textContent = "";
				row.cells[7].textContent = "";
				break;
			}
			
			let player_stats = undefined;
			for (let k = 0; k < map_stats.player_stats.length; k++) {
				if (map_stats.player_stats[k].steamid == id) {
					player_stats = map_stats.player_stats[k];
					break;
				}
			}
			
			if (player_stats && player_stats.lastPlay && player_stats.totalPlays) {
				row.cells[5].classList.remove("green");
				row.cells[5].classList.remove("red");
				
				if (player_stats.rating == 0) {
					row.cells[5].textContent = "NONE";
				} else if (player_stats.rating == 1) {
					row.cells[5].classList.add("green");
					row.cells[5].textContent = "LIKE";
				} else if (player_stats.rating == 2) {
					row.cells[5].classList.add("red");
					row.cells[5].textContent = "DISLIKE";
				}
				
				let minutesSinceEpoch = Math.floor(Date.now() / (1000*60));
				let timeSincePlay = minutesSinceEpoch - player_stats.lastPlay;
				let minutes = Math.round(timeSincePlay);
				let hours = Math.round(timeSincePlay / 60);
				let days = Math.round(timeSincePlay / (60 * 24));
				
				if (hours > 48) {
					row.cells[6].textContent = days + "d";
				}
				else if (minutes > 120) {
					row.cells[6].textContent = hours + "h";
				}
				else {
					row.cells[6].textContent = minutes + "m";
				}
				
				
				row.cells[7].textContent = player_stats.totalPlays;
			} else {
				row.cells[5].textContent = "NONE";
				row.cells[6].textContent = "NEVER";
				row.cells[7].textContent = "0";
			}
		}
		
		plist.classList.add("stat_view");
	} else {
		plist.classList.remove("stat_view");
	}
}

function refresh_player_table() {
	let plist = document.getElementById('player_list');
	let tbody = plist.querySelector('tbody');
	tbody.innerHTML = "";
	
	let pcount = 0;
	
	for (let i = 0; i < 32; i++) {
		let dat = {};
		
		if (i < g_player_data.length) {
			pcount += 1;
			dat =  g_player_data[i];
		}
		
		let plr = document.createElement('a');
		plr.href = "https://steamcommunity.com/profiles/" + dat.steamid64;
		plr.target = "_blank";
		plr.title = dat.name;
		plr.textContent = dat.name;
		
		let name_col = document.createElement('td');
		name_col.appendChild(plr);
		
		let status_col = document.createElement('td');
		if (dat.status == 0 || dat.status == 1) {
			if (dat.idleTime < 20) {
				if (dat.status == 0) {
					status_col.classList.add("alive");
					status_col.textContent = "ALIVE";
					status_col.title = "Player is alive";
				} else {
					status_col.classList.add("dead");
					status_col.textContent = "DEAD";
					status_col.title = "Player is dead";
				}
			} else {
				if (dat.idleTime > 60*2) {
					status_col.classList.add("longidle");
				}
				else if (dat.idleTime > 60) {
					status_col.classList.add("idle");
				}
				else {
					status_col.classList.add("shortidle");
				}
				status_col.textContent = "IDLE";
				status_col.title = "Player has been idle for " + dat.idleTime + " seconds";
			}
		} else if (dat.status == 2) {
			status_col.classList.add("spec");
			status_col.textContent = "SPEC";
			status_col.title = "Player is spectating";
		}
		
		let score_col = document.createElement('td');
		score_col.textContent = dat.score;
		
		let deaths_col = document.createElement('td');
		deaths_col.textContent = dat.deaths;
		
		let ping_col = document.createElement('td');
		ping_col.textContent = dat.ping;
		
		let opinion_col = document.createElement('td');
		
		let last_play_col = document.createElement('td');
		
		let total_play_col = document.createElement('td');
		
		let plr_row = document.createElement('tr');
		plr_row.appendChild(name_col);
		plr_row.appendChild(status_col);
		plr_row.appendChild(score_col);
		plr_row.appendChild(deaths_col);
		plr_row.appendChild(ping_col);
		plr_row.appendChild(opinion_col);
		plr_row.appendChild(last_play_col);
		plr_row.appendChild(total_play_col);
		
		if (i < g_player_data.length)
			plr_row.setAttribute("steamid", dat.steamid64);
		
		tbody.appendChild(plr_row);
	}
	
	document.getElementById('pcount').textContent = pcount;
	document.getElementById('tab_title').textContent = "Half-Life Co-op (" + pcount + "/32)";
	
	update_table_state();
}

function update_player_data(view) {
	let offset = 1; // skip message type byte

	g_player_data = [];

	while (offset < view.byteLength) {
		let steamid64 = view.getBigUint64(offset, true);
		offset += 8;
		
		let name = read_string(view, offset)
		offset += get_utf8_data_len(name);

		let status = view.getUint8(offset, true);
		offset += 1;

		let score = view.getInt16(offset, true);
		offset += 2;

		let deaths = view.getInt16(offset, true);
		offset += 2;
		
		let ping = view.getInt16(offset, true);
		offset += 2;
		
		let idleTime = view.getUint16(offset, true);
		offset += 2;

		g_player_data.push({ name, steamid64, status, score, deaths, ping, idleTime });
	}
	
	g_player_data.sort((a,b) => b.score - a.score);

	//console.log("Player Data:", g_player_data);
	
	refresh_player_table();
}

function update_server_name(view) {
	let offset = 1; // skip message type byte

	let name = read_string(view, offset);
	
	g_server_name = name;
	document.getElementById('server_name').textContent = name;
	document.getElementById('tab_title').textContent = name;
}

function add_message(steamid64, name, msg) {
	let chatbox = document.getElementById('chat_box');
	
	let chat_container = document.createElement('div');
	chat_container.classList.add("chat_message");
	
	let chat_name = document.createElement('a');
	chat_name.classList.add("player_name");
	chat_name.href = "https://steamcommunity.com/profiles/" + steamid64;
	chat_name.target = "_blank";
	chat_name.textContent = name;
	
	let chat_msg = document.createElement('span');
	if (steamid64 != 0) {
		chat_msg.textContent = ": " + msg;
	} else {
		chat_msg.textContent = msg;
	}
	
	chat_container.appendChild(chat_name);
	chat_container.appendChild(chat_msg);
	chatbox.appendChild(chat_container);
	
	while (chatbox.childElementCount > 100) {
		chatbox.removeChild(chatbox.firstChild);
	}
	
	chatbox.scrollTop = chatbox.scrollHeight;
}

function parse_chat_message(view) {
	let offset = 1; // skip message type byte
	
	while (offset < view.byteLength) {
		let time = view.getBigUint64(offset, true);
		offset += 8;
		
		let steamid64 = view.getBigUint64(offset, true);
		offset += 8;
		
		let name = read_string(view, offset)
		offset += get_utf8_data_len(name);
		
		let msg = read_string(view, offset);
		offset += get_utf8_data_len(msg);
		
		msg = msg.replace(/\n$/, ''); // remove trailing newline if it exists
		
		add_message(steamid64, name, msg);
	}
}

function parse_web_clients(view) {
	let offset = 1; // skip message type byte
	
	g_web_clients = [];
	
	while (offset < view.byteLength) {
		let steamid64 = view.getBigUint64(offset, true);
		offset += 8;
		
		g_web_clients.push(steamid64);
	}
	
	document.getElementById("client_anon_counter").textContent = g_web_clients.length;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function parse_auth(view) {
	let offset = 1; // skip message type byte

	let steamid64 = view.getBigUint64(offset, true);
	offset += 8;
	
	let name = read_string(view, offset);
	offset += get_utf8_data_len(name);
	
	let avatar = read_string(view, offset);
	offset += get_utf8_data_len(avatar);
	
	let token = read_string(view, offset);
	offset += get_utf8_data_len(token);
	
	if (token.length) {
		const currentDate = new Date();
		currentDate.setFullYear(currentDate.getFullYear() + 1);
		const expires = "expires=" + currentDate.toUTCString();
		document.cookie = "token=" + token + "; " + expires + "; path=/; SameSite=Strict; secure";
	}
	
	let login_but = document.getElementById("login_but");
	let login_text = document.getElementById("login_text");
	let login_subtext = document.getElementById("login_subtext");
	let login_icon = document.getElementById("login_icon");
	
	g_steamid = 0;
	
	if (steamid64 == 0) {
		// auth not attempted
	}
	else if (steamid64 == 1) {
		// failed to auth
		login_text.textContent= "Sign in through Steam";
		login_subtext.textContent= "(authentication failed)";
		login_subtext.classList.add("red");
		login_icon.src = "steam_icon_logo.svg";
	}
	else {
		// valid id
		if (name.length == 0) {
			name = steamid64;
		}
		if (avatar.length) {
			login_icon.src = avatar;
		}
		
		login_text.textContent = name;
		login_text.title = name;
		login_but.classList.add("authed");
		login_subtext.textContent= "(click to log out)";
		login_but.href = "";
		
		document.getElementById('login_but').addEventListener('click', logout);
		
		g_steamid = steamid64;
	}
}

function parse_rating(view) {
	let offset = 1; // skip message type byte

	let steamid64 = view.getBigUint64(offset, true);
	offset += 8;
	
	let rating = view.getUint8(offset, true);
	offset += 1;
	
	let map = read_string(view, offset);
	offset += get_utf8_data_len(map);
	
	let map_stats = undefined;
	for (let i = 0; i < g_map_stats.length; i++) {
		if (g_map_stats[i].map == map) {
			map_stats = g_map_stats[i];
			break;
		}
	}
	
	if (!map_stats) {
		console.log("Missing map stats for " + map);
		return;
	}
	
	let player_stats = undefined;
	for (let k = 0; k < map_stats.player_stats.length; k++) {
		if (map_stats.player_stats[k].steamid == steamid64) {
			player_stats = map_stats.player_stats[k];
			break;
		}
	}
	
	player_stats.rating = rating;
	update_map_ratings();
	refresh_player_table();
}

function logout(ev) {
	ev.preventDefault();
	g_socket.send("logout");
}

function finish_logout() {
	let login_but = document.getElementById("login_but");
	let login_text = document.getElementById("login_text");
	let login_subtext = document.getElementById("login_subtext");
	let login_icon = document.getElementById("login_icon");
	
	login_but.removeEventListener('click', logout);
	
	login_but.classList.remove("authed");
	login_text.textContent= "Sign in through Steam";
	login_subtext.textContent= "(required for some actions)";
	login_subtext.classList.remove("red");
	login_icon.src = "steam_icon_logo.svg";
	
	document.cookie = "token=DELETED; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; secure";
	
	g_steamid = 0;
	
	setup_openid_link();
	
	update_map_ratings();
}


function map_mouse_over(ev) {
	g_mouseover_state = true;
	g_selected_map = ev.currentTarget.getAttribute("map");
	update_table_state();
}

function map_mouse_out(ev) {
	clearTimeout(g_reset_table_timer);
	g_mouseover_state = false;
	g_reset_table_timer = setTimeout(function() {
		if (g_mouseover_state) {
			return;
		}
		g_selected_map = "";
		update_table_state();
	}, 500);
}

function rate_map(ev) {
	ev.preventDefault();
	
	if (g_steamid == 0) {
		action_denied_popup();
		return;
	}
	
	let map = event.target.getAttribute("map");
	let rating = event.target.getAttribute("rating");
	
	g_socket.send("rate;" + rating + ";" + map);
	console.log("Rate map " + map + " with " + rating);
}

function handle_img_error(event) {
    event.target.src = 'missing_preview.png'; // Fallback image URL
    event.target.onerror = null; // Prevent infinite loop if the fallback also fails
}

function update_next_maps(view) {
	let offset = 1; // skip message type byte
	let next_maps = [];

	let numPlayers = view.getUint8(offset, true);
	offset += 1;
	
	let player_ids = [];
	for (let j = 0; j < numPlayers; j++) {
		player_ids.push(view.getBigUint64(offset, true));
		offset += 8;
	}

	console.log("Player ids: ", player_ids)
	
	g_map_stats = [];
	
	for (let j = offset; j < view.byteLength; j++) {
		let map = read_string(view, offset);
		offset += get_utf8_data_len(map);
		if (offset >= view.byteLength) {
			continue;
		}
		
		let player_stats = [];
		
		for (let k = 0; k < numPlayers; k++) {
			let steamid = player_ids[k];
			
			let lastPlay = view.getUint32(offset, true)
			offset += 4;
			
			let totalPlays = view.getUint16(offset, true)
			offset += 2;
			
			let rating = view.getUint8(offset, true)
			offset += 1;
			
			player_stats.push({steamid, lastPlay, totalPlays, rating});
		}
		
		g_map_stats.push({map, player_stats});
	}
	
	console.log("Next maps:", g_map_stats);
	
	update_map_data();
}

function get_map_dat(mapname) {
	for (let i = 0; i < g_map_data.length; i++) {
		let map_dat = g_map_data[i];
		
		for (let k = 0; k < map_dat.maps.length; k++) {
			if (map_dat.maps[k] == mapname) {
				return map_dat;
			}
		}
	}
	
	let maps = [];
	let link = "";
	return {maps, link};
}

function update_map_data() {
	if (!g_map_stats.length) {
		return;
	}

	document.getElementById('current_map').setAttribute("map", g_map_stats[0].map);
	document.getElementById('next_map').setAttribute("map", g_map_stats[g_map_stats.length-1].map);
	
	let upcoming = document.getElementById('upcoming_maps_grid');
	upcoming.innerHTML = "";
	
	for (let i = 1; i < g_map_stats.length-1; i++) {
		let map = document.createElement('a');
		map.classList.add("map_container");
		map.setAttribute("map", g_map_stats[i].map);
		
		if (next_map == g_map_stats[i].map) {
			map.classList.add("next");
		}
	
		let title = document.createElement('span');
		title.classList.add("map_title");
		
		let img = document.createElement('img');
		img.classList.add("map_image");
		
		let like = document.createElement('img');
		like.classList.add("like_button");
		like.src = "thumbs_up.png";
		
		let dislike = document.createElement('img');
		dislike.classList.add("dislike_button");
		dislike.src = "thumbs_down.png";
		
		map.appendChild(title);
		map.appendChild(img);
		map.appendChild(like);
		map.appendChild(dislike);
		upcoming.appendChild(map);
	}
	
	document.querySelectorAll('.map_container').forEach(function(div) {
		let map = div.getAttribute("map");
		let dat = get_map_dat(map);
		let url = "http://scmapdb.wikidot.com/map:" + dat.link;
		
		div.href = url;
		div.target = "_blank";
		div.removeEventListener('mouseover', map_mouse_over);
		div.addEventListener('mouseover', map_mouse_over);
		div.addEventListener('mouseout', map_mouse_out);
		div.removeEventListener('mouseout', map_mouse_out);
		
		let title = div.getElementsByClassName("map_title")[0]; 
		title.title = map;
		title.textContent = map;
		if (map.length > 18) {
			title.classList.add("longtext");
		}
		
		let img = div.getElementsByClassName("map_image")[0];
		img.src = "img/" + dat.maps[0] + ".jpg";
		img.onerror = handle_img_error;
		
		let like = div.getElementsByClassName("like_button")[0];
		like.setAttribute("rating", "1");
		like.setAttribute("map", dat.maps[0]);
		like.removeEventListener("click", rate_map);
		like.addEventListener("click", rate_map);
		
		let dislike = div.getElementsByClassName("dislike_button")[0];
		dislike.setAttribute("rating", "2");
		dislike.setAttribute("map", dat.maps[0]);
		dislike.removeEventListener("click", rate_map);
		dislike.addEventListener("click", rate_map);
	});
	
	document.getElementById('upcoming_maps_count').textContent = g_map_stats.length-2;
	
	update_map_ratings();
}

function update_map_ratings() {
	const divs = document.querySelectorAll('.map_container');
	let plist = document.getElementById('player_list');
	
	divs.forEach(function(div) {
		let map = div.getAttribute("map");
		let like_button = div.getElementsByClassName("like_button")[0];
		let dislike_button = div.getElementsByClassName("dislike_button")[0];
		
		like_button.classList.remove("own_rating");
		dislike_button.classList.remove("own_rating");
		
		let numLike = 0;
		let numDislike = 0;
		
		let map_dat = get_map_dat(map);
		let first_map = map_dat.maps[0];
		let map_stats = undefined;
		for (let i = 0; i < g_map_stats.length; i++) {
			if (g_map_stats[i].map == first_map) {
				map_stats = g_map_stats[i];
				break;
			}
		}
		
		if (!map_stats) {
			console.log("Missing map stats for " + map);
			return;
		}
		
		for (let i = 1; i < plist.rows.length; i++) {
			let id = plist.rows[i].getAttribute("steamid");
			
			let player_stats = undefined;
			for (let k = 0; k < map_stats.player_stats.length; k++) {
				if (map_stats.player_stats[k].steamid == id) {
					player_stats = map_stats.player_stats[k];
					break;
				}
			}
			
			if (player_stats) {
				if (player_stats.rating == 1) {
					if (id == g_steamid) {
						like_button.classList.add("own_rating");
					}
					numLike += 1;
				} else if (player_stats.rating == 2) {
					if (id == g_steamid) {
						dislike_button.classList.add("own_rating");
					}
					numDislike += 1;
				}
			}
		}
		
		div.classList.remove("liked");
		div.classList.remove("disliked");
		if (numLike > 0 && numDislike > 0) {
			div.title = "wow mixed";
			div.classList.add("liked");
			div.classList.add("disliked");
			div.title = "This map is highlighted orange due to mixed ratings and is selected with normal priority.";
		}
		else if (numLike > 0) {
			div.title = "This map is highlighted green due to positive ratings and is selected with the highest priority.";
			div.classList.add("liked");
		}
		else if (numDislike > 0) {
			div.title = "This map is highlighted red due to negative ratings and is selected with the lowest priority.\n\nIf all players currently in the server rate it negatively then it will never be chosen as the next map.";
			div.classList.add("disliked");
		} else {
			div.title = "This map isn't highlighted due to neutral ratings and is selected with normal priority.";
		}
	});
}

async function downloadJson(url) {
	try {
		console.log("Downloading: " + url);
		const response = await fetch(url);
		
		// Check if the response is OK
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
		
		// Parse the response as JSON
		const data = await response.json();
		
		// Log or return the JSON object
		return data;
	} catch (error) {
		console.error('Error downloading or parsing JSON:', error);
	}
}

function setup_openid_link() {
	let return_to = window.location.origin + window.location.pathname;	
	let openid_link = "https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=" + return_to + "&openid.realm=" + return_to +"&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select";
	document.getElementById("login_but").setAttribute("href", openid_link);
}

async function setup() {
	g_map_data = await downloadJson("mapdb.json");
	update_map_data();

	document.getElementById('closePopup').addEventListener('click', function() {
		popup.style.display = 'none';
	});
	
	setup_openid_link();
	
	let params = new URLSearchParams(window.location.search);
	g_auth_token = getCookie("token");
	
	if (params.has("server_url")) {
		g_server_url = params.get('server_url');
	}
	
	if (params.has("openid.claimed_id")) {
		g_auth_params = params;
		
		const url = new URL(window.location.href);
		url.search = '';
		history.replaceState(null, '', url.toString()); 
		
		// remove previous cookie/login
		document.cookie = "token=DELETED; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict; secure";
		console.log("ZOMG DELETE COOKIE");
		
		//console.log("GOT AUTH");
		//console.log(params);
	} else {
		g_auth_params = undefined;
	}
	
	if (g_auth_token || g_auth_params) {
		document.getElementById("login_text").textContent = "Signing in...";
		document.getElementById("login_subtext").textContent = "";
	}
	
	createWebSocket();
}

function action_denied_popup() {
	document.getElementById('popup').style.display = 'flex';
}

function createWebSocket() {
	console.log("Connecting to " + g_server_url);
	g_socket = new WebSocket(g_server_url);
	
	// Handle connection open
	g_socket.addEventListener('open', function () {
		console.log("WebSocket connection established");
		let connect_msg = "hey";
		
		if (g_auth_params) {
			let claimed_id = g_auth_params.get('openid.claimed_id').replace("https://steamcommunity.com/openid/id/", "");
			let response_handle = g_auth_params.get('openid.assoc_handle');
			let response_nonce = g_auth_params.get('openid.response_nonce');
			let sig = g_auth_params.get('openid.sig');
			connect_msg += ";" + claimed_id + ";" + response_handle + ";" + response_nonce + ";" + sig;
		}
		else if (g_auth_token) {
			connect_msg += ";" + g_auth_token
		}
		
		g_socket.send(connect_msg);
	});

	// Handle incoming messages
	g_socket.addEventListener('message', async function(event) {
		let arrayBuffer = await event.data.arrayBuffer();
		const view = new DataView(arrayBuffer);
		
		console.log("Got " + event.data.size + " byte message");

		let msgType = view.getUint8(0);
		
		if (msgType == WEBMSG_SERVER_NAME) {
			update_server_name(view);
		}
		else if (msgType == WEBMSG_PLAYER_LIST) {
			update_player_data(view);
		}
		else if (msgType == WEBMSG_NEXT_MAPS) {
			update_next_maps(view);
		}
		else if (msgType == WEBMSG_CHAT) {
			parse_chat_message(view);
		}
		else if (msgType == WEBMSG_AUTH) {
			parse_auth(view);
		}
		else if (msgType == WEBMSG_WEB_CLIENTS) {
			parse_web_clients(view);
		}
		else if (msgType == WEBMSG_NOT_AUTHED) {
			action_denied_popup();
		}
		else if (msgType == WEBMSG_LOGOUT) {
			finish_logout();
		}
		else if (msgType = WEBMSG_RATING) {
			parse_rating(view);
		}
		else {
			console.error("Unrecognized socket message type " + msgType);
		}
	});

	// Handle connection close
	g_socket.addEventListener('close', function () {
		console.log("WebSocket connection closed");
		setTimeout(createWebSocket, 5000);
	});

	// Handle errors
	g_socket.addEventListener('error', function (error) {
		console.error("WebSocket error:", error);
	});
}

function ready(fn) {
  if (document.readyState !== 'loading') {
	fn();
	return;
  }
  document.addEventListener('DOMContentLoaded', fn);
}

ready(setup);
