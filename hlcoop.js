var g_socket;
var g_server_url = 'wss://w00tguy.ddns.net:3000/';
//var g_server_url = 'ws://localhost:3000/'; // for Visual Studio debugging
var g_player_data = []; // players currently in the server
var g_player_states = {}; // extra player info and map stats by steam id
var g_server_name = "Half-Life Co-op";
var g_selected_map = "";
var g_reset_table_timer;
var g_mouseover_state = false;
var g_auth_params;
var g_auth_token;
var g_map_data = {}; // information about each map (link)
var g_web_clients = [];
var g_map_cycle = [];
var g_total_maps = 0;
var g_upcoming_maps = new Set(); // set of maps in the upcoming maps pool
var g_steamid = 0;
var g_current_map;
var g_next_map;
var g_map_start_time; // epoch millis when map started
var g_map_time_limit; // map time limit in seconds
var g_map_frag_limit;

const MESSAGE_TYPE = {
	WEBMSG_SERVER_NAME: 0,
	WEBMSG_PLAYER_LIST: 1,
	WEBMSG_CHAT: 3,
	WEBMSG_AUTH: 4,
	WEBMSG_WEB_CLIENTS: 5,
	WEBMSG_NOT_AUTHED: 6,
	WEBMSG_LOGOUT: 7,
	WEBMSG_RATING: 8,
	WEBMSG_MAP_LIST: 9,
	WEBMSG_MAP_INFO: 11,
	WEBMSG_PLAYER_STATE: 12,
	WEBMSG_UPCOMING_MAPS: 13
};

function get_message_type_name(value) {
  for (const [key, val] of Object.entries(MESSAGE_TYPE)) {
    if (val === value) {
      return key;
    }
  }
  return "unknown";
}


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
	let plist = document.getElementById('player_list').querySelector('tbody');
	
	if (g_selected_map) {		
		for (let i = 0; i < plist.rows.length; i++) {
			let row = plist.rows[i];
			let id = row.getAttribute("steamid");
			
			if (!id) {
				row.cells[5].textContent = "";
				row.cells[6].textContent = "";
				row.cells[7].textContent = "";
				break;
			}
			
			let player_state = g_player_states[id];
			let player_stats = player_state.mapstats[g_selected_map];
			
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
		
		document.getElementById('player_list').classList.add("stat_view");
	} else {
		document.getElementById('player_list').classList.remove("stat_view");
	}
}

function refresh_player_table() {
	let plist = document.getElementById('player_list').querySelector('tbody');
	
	let oldRowCount = plist.rows.length;
	
	// remove extra rows
	for (let i = g_player_data.length; i < plist.rows.length; i++) {
		plist.deleteRow(i);
	}
	
	for (let i = 0; i < g_player_data.length; i++) {
		let dat = g_player_data[i];
		
		if (i >= plist.rows.length) {
			let row = plist.insertRow(plist.rows.length);
			row.innerHTML = "<tr><td><a></a><img class=\"rank\"/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>";;
		}
		
		let row = plist.rows[i];
		let rank = row.cells[0].getElementsByClassName('rank')[0];
		let name = row.cells[0].getElementsByTagName('a')[0];
		let state = g_player_states[dat.steamid64];
		
		let mapsPlayed = 0;
		let mapMutliPlayed = 0;
		
		if (state) {
			mapsPlayed = state.mapsPlayed;
			mapMutliPlayed = state.mapsMultiplayed;
		}
		
		//console.log("map plays for " + dat.name + " is " + mapsPlayed + " / " + g_map_cycle.length);
		
		rank.classList.remove("hidden");
		if (!state) {
			rank.classList.add("hidden");
		}
		else if (mapMutliPlayed >= g_map_cycle.length) {
			rank.title = "AUTIST - Played every map 2+ times";
			rank.src = "icon/rank_5.png";
		}
		else if (mapsPlayed >= g_map_cycle.length) {
			rank.title = "MASTER - Played every map";
			rank.src = "icon/rank_4.png";
		}
		else if (mapsPlayed >= 400) {
			rank.title = "VETERAN - Played 400+ maps";
			rank.src = "icon/rank_3.png";
		}
		else if (mapsPlayed >= 200) {
			rank.title = "REGULAR - Played 200+ maps";
			rank.src = "icon/rank_2.png";
		}
		else if (mapsPlayed >= 100) {
			rank.title = "NOVICE - Played 100+ maps";
			rank.src = "icon/rank_1.png";
		}
		else if (!mapsPlayed || mapsPlayed < 10) {
			rank.title = "NEWB - Played fewer than 10 maps";
			rank.src = "icon/newb.png";
		} else {
			rank.classList.add("hidden");
		}
		
		name.textContent = dat.name;
		name.href = "https://steamcommunity.com/profiles/" + dat.steamid64;
		name.target = "_blank";
		name.title = dat.name + "\n\nMaps played: " + (mapsPlayed ? mapsPlayed : 0);
		
		let status_col = row.cells[1];
		status_col.className = "";
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
		
		row.cells[2].textContent = dat.score;
		row.cells[3].textContent = dat.deaths;
		row.cells[4].textContent = dat.ping;
		row.cells[5].textContent = "";
		row.cells[6].textContent = "";
		row.cells[7].textContent = "";
		
		row.setAttribute("steamid", dat.steamid64);
	}
	
	document.getElementById('pcount').textContent = g_player_data.length;
	document.getElementById('tab_title').textContent = "Half-Life Co-op (" + g_player_data.length + "/32)";
	
	update_table_state();
	
	if (oldRowCount != plist.rows.length) {
		let chatbox = document.getElementById('chat_box');	
		chatbox.scrollTop = chatbox.scrollHeight;
	}
}

function update_player_data(view) {
	let offset = 1; // skip message type byte

	let old_pdata_len = g_player_data.length;
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
	
	if (old_pdata_len != g_player_data.length)
		update_map_ratings();
}

function update_server_name(view) {
	let offset = 1; // skip message type byte

	let name = read_string(view, offset);
	
	g_server_name = name;
	document.getElementById('server_name').textContent = name;
	document.getElementById('tab_title').textContent = name;
}

function add_message(steamid64, name, msg, time) {
	let chatbox = document.getElementById('chat_box');
	
	let chat_container = document.createElement('div');
	chat_container.classList.add("chat_message");
	
	let chat_time = document.createElement('span');
	chat_time.classList.add("chat_time");
	const date = new Date(Number(time));
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	chat_time.textContent = `${hours}:${minutes} `;
	
	chat_time.addEventListener("mouseover", function(ev) {
		const deltaTime = Number(new Date()) - Number(date);
		chat_time.title = format_age(Math.floor(deltaTime / 1000)) + " ago";
	});
	
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
	
	chat_container.appendChild(chat_time);
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
		
		add_message(steamid64, name, msg, time);
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
		console.log("Stored Steam authentication cookie");
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
		login_icon.src = "icon/steam_icon_logo.svg";
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
		login_subtext.textContent= "(click to sign out)";
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
	
	let state = g_player_states[steamid64];
	let map_stats = state.mapstats[map];
	
	if (!map_stats) {
		console.log("Player " + steamid64 + " missing map stats for " + map);
		return;
	}
	
	map_stats.rating = rating;
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
	login_icon.src = "icon/steam_icon_logo.svg";
	
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
    event.target.src = 'img/missing_preview.png'; // Fallback image URL
    event.target.onerror = null; // Prevent infinite loop if the fallback also fails
}

function parse_player_state(view) {
	let offset = 1; // skip message type byte

	let steamid64 = view.getBigUint64(offset, true);
	offset += 8;

	g_player_states[steamid64] = {
		mapstats: {},
		mapsPlayed: 0,		// number of unique maps played
		mapsMultiplayed: 0	// number of unique maps played 2+ times
	};
	
	let lang = read_string(view, offset);
	offset += get_utf8_data_len(lang);
	g_player_states[steamid64].language = lang;
	
	let mapIdx = 0;
	
	for (let j = offset; j < view.byteLength && mapIdx < g_map_cycle.length; j++) {
		let map = g_map_cycle[mapIdx][0];
		mapIdx++;
		
		let lastPlay = view.getUint32(offset, true)
		offset += 4;
		
		let totalPlays = view.getUint16(offset, true)
		offset += 2;
		
		let rating = view.getUint8(offset, true)
		offset += 1;
		
		if (totalPlays > 0) {
			g_player_states[steamid64].mapsPlayed += 1;
		}
		if (totalPlays > 1) {
			g_player_states[steamid64].mapsMultiplayed += 1;
		}
		
		g_player_states[steamid64].mapstats[map] = {
			lastPlay: lastPlay,
			totalPlays: totalPlays,
			rating: rating
		};
	}
	
	console.log("Player state: ", g_player_states[steamid64]);
	
	update_map_data();
}

function parse_upcoming_maps(view) {
	let offset = 1; // skip message type byte

	g_next_map = read_string(view, offset);
	offset += get_utf8_data_len(g_next_map);
	
	console.log("Read count at offset " + offset);
	
	let upcomingMapsCount = view.getUint16(offset, true);
	offset += 2;
	
	g_upcoming_maps.clear();
	
	for (let i = 0; i < upcomingMapsCount; i++) {		
		let mapId = view.getUint16(offset, true);
		offset += 2;
		
		g_upcoming_maps.add(g_map_cycle[mapId][0]);
	}
	
	console.log("Next map: " + g_next_map + ", upcoming maps: ", g_upcoming_maps);
	
	update_map_data();
}


function parse_map_list(view) {
	g_map_cycle = [];
	
	let offset = 1;
	
	let series = [];
	g_total_maps = 0;
	
	while (offset < view.byteLength) {
		let map = read_string(view, offset);
		offset += get_utf8_data_len(map);
		g_total_maps += 1;
		
		if (map == "\n") {
			g_map_cycle.push(series);
			series = [];
		} else {
			series.push(map);
		}
	}
	
	console.log("Map cycle:", g_map_cycle);
}

function parse_map_info(view) {
	let offset = 1; // skip message type byte
	
	g_current_map = read_string(view, offset);
	offset += get_utf8_data_len(g_current_map);
	
	g_map_start_time = view.getBigUint64(offset, true);
	offset += 8;
	
	g_map_time_limit = Math.round(view.getFloat32(offset, true) * 60);
	offset += 4;
	
	g_map_frag_limit = view.getFloat32(offset, true);
	offset += 4;
	
	let series_counter = document.getElementById("series_counter");
		
	let seriesLength = 1;
	let seriesIdx = 1;
	for (let i = 0; i < g_map_cycle.length; i++) {
		for (let k = 0; k < g_map_cycle[i].length; k++) {
			if (g_map_cycle[i][k] == g_current_map) {
				seriesLength = g_map_cycle[i].length;
				seriesIdx = k+1;
				break;
			}
		}
	}
	
	if (seriesLength > 1) {
		series_counter.textContent = " (" + seriesIdx + " of " + seriesLength + ")";
	} else {
		series_counter.textContent = "";
	}
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

function get_first_map_in_series(mapname) {
	for (let i = 0; i < g_map_cycle.length; i++) {
		for (let k = 0; k < g_map_cycle[i].length; k++) {
			if (g_map_cycle[i][k] == mapname) {
				return g_map_cycle[i][0];
			}
		}
	}
	
	return mapname;
}

function update_map_data() {
	document.getElementById('current_map').setAttribute("map", g_current_map);
	document.getElementById('next_map').setAttribute("map", g_next_map);
	
	let upcoming = document.getElementById('upcoming_maps_grid');
	upcoming.innerHTML = "";
	
	for (let i = 1; i < g_map_cycle.length; i++) {
		let map = document.createElement('a');
		let mapname = g_map_cycle[i][0];
		map.classList.add("map_container");
		map.setAttribute("map", mapname);
		
		if (g_upcoming_maps.has(mapname)) {
			map.classList.add("upcoming");
		}
	
		let title = document.createElement('span');
		title.classList.add("map_title");
		
		let img = document.createElement('img');
		img.classList.add("map_image");
		
		let like = document.createElement('img');
		like.classList.add("like_button");
		like.src = "icon/thumbs_up.png";
		
		let dislike = document.createElement('img');
		dislike.classList.add("dislike_button");
		dislike.src = "icon/thumbs_down.png";
		
		map.appendChild(title);
		map.appendChild(img);
		map.appendChild(like);
		map.appendChild(dislike);
		upcoming.appendChild(map);
	}
	
	document.querySelectorAll('.map_container').forEach(function(div) {
		let map = div.getAttribute("map");
		let dat = get_map_dat(map);
		let first_map = get_first_map_in_series(map);
		let url = "http://scmapdb.wikidot.com/map:" + dat.link;
		
		div.href = url;
		div.target = "_blank";
		div.removeEventListener('mouseover', map_mouse_over);
		div.addEventListener('mouseover', map_mouse_over);
		div.removeEventListener('mouseout', map_mouse_out);
		div.addEventListener('mouseout', map_mouse_out);
		
		let title = div.getElementsByClassName("map_title")[0]; 
		title.title = map;
		title.textContent = map;
		if (map.length > 18) {
			title.classList.add("longtext");
		}
		
		let img = div.getElementsByClassName("map_image")[0];
		img.src = "img/" + first_map + ".jpg";
		img.onerror = handle_img_error;
		
		let like = div.getElementsByClassName("like_button")[0];
		like.setAttribute("rating", "1");
		like.setAttribute("map", first_map);
		like.removeEventListener("click", rate_map);
		like.addEventListener("click", rate_map);
		like.title= "Rating this map positively will raise its chance of being picked while you're on the server."
		+ "\n\nThe recent playtime filter doesn't apply to maps you rate positively, meaning you can potentially play them multiple times per day.";
		
		let dislike = div.getElementsByClassName("dislike_button")[0];
		dislike.setAttribute("rating", "2");
		dislike.setAttribute("map", first_map);
		dislike.removeEventListener("click", rate_map);
		dislike.addEventListener("click", rate_map);
		dislike.title = "Rating this map negatively will lower its chance of being picked while you're on the server."
		+ "\n\nIf everyone on the server dislikes this map, then it will never be picked.";
	});
	
	if (document.getElementById("show_all_maps").checked) {
		document.getElementById('upcoming_maps_count').textContent = upcoming.getElementsByClassName("map_container").length;
	} else {
		document.getElementById('upcoming_maps_count').textContent = upcoming.getElementsByClassName("upcoming").length;
	}
	
	if (g_player_data.length == 0) {
		document.getElementById("content").classList.add("empty_server");
		document.getElementById('upcoming_maps_count').textContent = "0";
		
		if (document.getElementById("show_all_maps").checked) {
			document.getElementById("empty_notice").classList.add("hidden");
		} else {
			document.getElementById("empty_notice").classList.remove("hidden");
		}
	} else {
		document.getElementById("content").classList.remove("empty_server");
		document.getElementById("empty_notice").classList.add("hidden");
	}
	
	update_map_ratings();
}

function update_map_ratings() {
	const divs = document.querySelectorAll('.map_container');
	let plist = document.getElementById('player_list').querySelector('tbody');
	
	let steamids = [];
	let connectedIds = {};
	let ownIdPushed = false;
	for (let i = 0; i < plist.rows.length; i++) {
		let id = plist.rows[i].getAttribute("steamid");
		if (id)
			steamids.push(id);
		if (id == g_steamid) {
			ownIdPushed = true;
		}
		connectedIds[id] = true;
	}
	if (!ownIdPushed && g_steamid > 0) {
		steamids.push(g_steamid);
	}
	let shouldCountOwnId = ownIdPushed;
	
	divs.forEach(function(div) {
		let map = div.getAttribute("map");
		let like_button = div.getElementsByClassName("like_button")[0];
		let dislike_button = div.getElementsByClassName("dislike_button")[0];
		
		like_button.classList.remove("own_rating");
		dislike_button.classList.remove("own_rating");
		
		let numLike = 0;
		let numDislike = 0;
		
		let first_map = get_first_map_in_series(map);		
		let was_played = false;
		
		for (let i = 0; i < steamids.length; i++) {
			let id = steamids[i];
			
			let player_state = g_player_states[id];
			if (!player_state) {
				continue;
			}
			let player_stats = player_state.mapstats[first_map];
			
			if (player_stats) {
				if (player_stats.totalPlays > 0 && id in connectedIds) {
					was_played = true;
				}
				
				if (player_stats.rating == 1) {
					if (id == g_steamid) {
						like_button.classList.add("own_rating");
						like_button.title = "You've rated this map positively. Clicking this button again will remove your rating."
						
						if (shouldCountOwnId) {
							numLike += 1;
						}
					} else {
						numLike += 1;
					}
				} else if (player_stats.rating == 2) {
					if (id == g_steamid) {
						dislike_button.classList.add("own_rating");
						dislike_button.title = "You've rated this map negatively. Clicking this button again will remove your rating."
						
						if (shouldCountOwnId) {
							numDislike += 1;
						}
					} else {
						numDislike += 1;
					}
				}
			}
		}
		
		div.classList.remove("new");
		div.classList.remove("liked");
		div.classList.remove("disliked");
		if (!was_played && g_player_data.length) {
			div.classList.add("new");
			div.title = "This map has a rainbow effect because no one in the server has played it. It is selected with the highest priority.";
		}
		else if (numLike > 0 && numDislike > 0) {
			div.classList.add("liked");
			div.classList.add("disliked");
			div.title = "This map is highlighted orange due to mixed ratings and is selected with normal priority.";
		}
		else if (numLike > 0) {
			div.title = "This map is highlighted green due to positive ratings and is selected with high priority.";
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

function format_timer(secondsPassed) {
	let seconds = secondsPassed % 60;
	let minutes = Math.floor((secondsPassed / 60) % 60);
	let hours = Math.floor(secondsPassed / (60*60));
	let minutesTotal = Math.floor(secondsPassed / 60);
	
	if (minutesTotal > 99) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	} else {
		return `${minutesTotal}:${String(seconds).padStart(2, '0')}`;
	}
}

function format_age(secondsPassed) {
	let seconds = secondsPassed;
	let minutes = Math.floor(secondsPassed / 60);
	let hours = Math.floor(secondsPassed / (60*60));
	
	if (hours > 2) {
		return "" + hours + "h";
	}
	else if (minutes > 2) {
		return "" + minutes + "m";
	}
	else {
		return "" + seconds + "s";
	}
}

function update_map_timer() {
	let timer = document.getElementById("map_timer");
	
	let secondsPassed = Math.floor((Date.now() / 1000) - Number(g_map_start_time));
	
	if (g_map_time_limit) {
		timer.textContent = format_timer(secondsPassed) + " / " + format_timer(g_map_time_limit);
	} else {
		timer.textContent = format_timer(secondsPassed);
	}
	
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

function filter_maps() {
	let searchString = document.getElementById("maps_filter").value;
	let upcoming = document.getElementById("upcoming_maps");

	upcoming.querySelectorAll('.map_container').forEach(function(div) {
		if (searchString.length > 0) {
			let map = div.getAttribute("map");
			if (map.toLowerCase().includes(searchString.toLowerCase())) {
				div.classList.remove("filtered");
			} else {
				div.classList.add("filtered");
			}
		} else {
			div.classList.remove("filtered");
		}
	});
}

async function setup() {
	g_map_data = await downloadJson("mapdb.json");
	update_map_data();
	
	setInterval(update_map_timer, 1000, -1);

	document.getElementById('closePopup').addEventListener('click', function() {
		popup.style.display = 'none';
	});

	document.getElementById("maps_filter").value = "";
	document.getElementById("send_message").value = "";
	document.getElementById('show_all_maps').checked = false;
	document.getElementById("show_all_maps").addEventListener("change", function() {
		let upcoming = document.getElementById("upcoming_maps");
		
		if (this.checked) {
			upcoming.classList.add("all_maps");
			document.getElementById("upcoming_title").textContent = "All maps";
			document.getElementById('upcoming_maps_count').textContent = upcoming.getElementsByClassName("map_container").length;
			document.getElementById("empty_notice").classList.add("hidden");
		} else {
			document.getElementById("upcoming_maps").classList.remove("all_maps");
			document.getElementById("upcoming_title").textContent = "Upcoming maps";
			document.getElementById('upcoming_maps_count').textContent = upcoming.getElementsByClassName("upcoming").length;
			if (g_player_data.length == 0) {
				document.getElementById("empty_notice").classList.remove("hidden");
			}
		}
	});
	
	document.getElementById("maps_filter").addEventListener('onchange', filter_maps);

	document.getElementById('send_message').addEventListener('keydown', (event) => {
		let message = document.getElementById("send_message").value.trim();
		if (event.key === 'Enter' && message.length) {
			alert("Oopsie whoopsie! Chat message feature not implemented.");
		}
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
		console.log("Deleted Steam authentication cookie");
		
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

		let msgType = view.getUint8(0);
		
		console.log("Got " + get_message_type_name(msgType) + " (" + event.data.size + " bytes)");
		
		if (msgType == MESSAGE_TYPE.WEBMSG_SERVER_NAME) {
			update_server_name(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_PLAYER_LIST) {
			update_player_data(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_CHAT) {
			parse_chat_message(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_AUTH) {
			parse_auth(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_WEB_CLIENTS) {
			parse_web_clients(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_NOT_AUTHED) {
			action_denied_popup();
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_LOGOUT) {
			finish_logout();
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_RATING) {
			parse_rating(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_MAP_LIST) {
			parse_map_list(view);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_MAP_INFO) {
			parse_map_info(view, true);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_PLAYER_STATE) {
			parse_player_state(view, true);
		}
		else if (msgType == MESSAGE_TYPE.WEBMSG_UPCOMING_MAPS) {
			parse_upcoming_maps(view, true);
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
