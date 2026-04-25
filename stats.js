var g_fastdl_server_url = 'https://w00tguy.ddns.net/';
//var g_fastdl_server_url = '/'; // for local testing
var g_player_ids = [];
var g_filtered_ids = [];
var g_player_states = {};
var g_server_name = "Half-Life Co-op";
var g_map_total = 0;
var g_steamid = 0;
var g_update_time = 0;
var g_player_clients = {};
var g_is_stats_page = true;
var result_offset = 0;
var g_most_active_id = 0;

function refresh_update_time() {
	let timeText = new Date(g_update_time*1000).toLocaleString(undefined, {
		year: 'numeric', 
		month: 'short', 
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	});
	
	let today = Math.floor(Date.now() / 1000);
	let timeSince = today - g_update_time;
	document.getElementById('update_time').textContent = format_age(timeSince, true, true, 2) + " ago";
	document.getElementById('update_time').title = timeText;
}

async function load_misc_data() {
	const url = g_fastdl_server_url + "files/playerdb_misc.txt?t=" + Date.now();
	const res = await fetch(url);
	const text = await res.text();
	const lines = text.split(/\r?\n/);
	
	for (const line of lines) {
		const parts = line.split("=");
		const val = parts[1];
		
		if (parts[0] == "maps") {
			g_map_total = parseInt(val);
			console.log("Total maps: " + g_map_total);
		} else if (parts[0] == "server_name") {
			g_server_name = val;
			console.log("Server name: " + g_server_name);
		} else if (parts[0] == "update_time") {
			g_update_time = parseInt(val);
			console.log("Update time: " + g_update_time);
		} else if (parts[0] == "most_active_id") {
			g_most_active_id = BigInt(val);
			console.log("Most active ID: " + g_most_active_id);
		}
	}
	
	document.getElementById('tab_title').textContent = "Player stats - " + g_server_name;
	document.getElementById('server_name').textContent = g_server_name;
	
	refresh_update_time();
	setInterval(refresh_update_time, 1000, -1);
	
	await load_shared_html();
	
	let player_profile = document.getElementById("player_profile");
	player_profile.addEventListener('click', function() {
		player_profile.style.display = "none";
		player_profile.getElementsByClassName("avatar_img")[0].src = "icon/blank.png";
		player_profile.getElementsByClassName("spray_img")[0].src = "icon/blank.png";
		player_profile.getElementsByClassName("pmodel_img")[0].src = "icon/blank.png";
	});
	player_profile.getElementsByClassName("content")[0].addEventListener('click', function(event) {
		event.stopPropagation();
	});
}

function load_page() {	
	document.getElementsByClassName("result-total")[0].textContent = "" + g_filtered_ids.length;
	document.getElementsByClassName("page-start")[0].textContent = "" + (result_offset+1);
	document.getElementsByClassName("page-end")[0].textContent = "" + Math.min(result_offset+results_per_page, g_filtered_ids.length);
	
	update_stat_table();
}

function next_page() {
	result_offset += results_per_page;
	if (result_offset >= g_filtered_ids.length) {
		result_offset -= results_per_page;
		return;
	}
	load_page();
}

function prev_page() {
	result_offset -= results_per_page;
	if (result_offset < 0) {
		result_offset = 0;
	}
	load_page();
}

function first_page() {
	result_offset = 0;
	load_page();
}

function last_page() {
	result_offset = 0;
	while (true) {
		result_offset += results_per_page;
		if (result_offset >= g_filtered_ids.length) {
			result_offset -= results_per_page;
			break;
		}
	}
	load_page();
}

function sort_total() {
	let sort_total = document.getElementsByClassName("sort-total")[0];
	let sort_recent = document.getElementsByClassName("sort-recent")[0];
	let sort_first_seen = document.getElementsByClassName("sort-first-seen")[0];
	let sort_last_seen = document.getElementsByClassName("sort-last-seen")[0];
	
	sort_recent.classList.remove("asc");
	sort_recent.classList.remove("dsc");
	sort_first_seen.classList.remove("asc");
	sort_first_seen.classList.remove("dsc");
	sort_last_seen.classList.remove("asc");
	sort_last_seen.classList.remove("dsc");
	
	if (sort_total.classList.contains("asc")) {
		sort_total.classList.remove("asc");
		sort_total.classList.add("dsc");
	} else {
		sort_total.classList.remove("dsc");
		sort_total.classList.add("asc");
	}
	
	sort_ids();
	first_page();
}

function sort_recent() {
	let sort_total = document.getElementsByClassName("sort-total")[0];
	let sort_recent = document.getElementsByClassName("sort-recent")[0];
	let sort_first_seen = document.getElementsByClassName("sort-first-seen")[0];
	let sort_last_seen = document.getElementsByClassName("sort-last-seen")[0];
	
	sort_total.classList.remove("asc");
	sort_total.classList.remove("dsc");
	sort_first_seen.classList.remove("asc");
	sort_first_seen.classList.remove("dsc");
	sort_last_seen.classList.remove("asc");
	sort_last_seen.classList.remove("dsc");
	
	if (sort_recent.classList.contains("asc")) {
		sort_recent.classList.remove("asc");
		sort_recent.classList.add("dsc");
	} else {
		sort_recent.classList.remove("dsc");
		sort_recent.classList.add("asc");
	}
	
	sort_ids();
	first_page();
}

function sort_first_seen() {
	let sort_total = document.getElementsByClassName("sort-total")[0];
	let sort_recent = document.getElementsByClassName("sort-recent")[0];
	let sort_first_seen = document.getElementsByClassName("sort-first-seen")[0];
	let sort_last_seen = document.getElementsByClassName("sort-last-seen")[0];
	
	sort_total.classList.remove("asc");
	sort_total.classList.remove("dsc");
	sort_recent.classList.remove("asc");
	sort_recent.classList.remove("dsc");
	sort_last_seen.classList.remove("asc");
	sort_last_seen.classList.remove("dsc");
	
	if (sort_first_seen.classList.contains("asc")) {
		sort_first_seen.classList.remove("asc");
		sort_first_seen.classList.add("dsc");
	} else {
		sort_first_seen.classList.remove("dsc");
		sort_first_seen.classList.add("asc");
	}
	
	sort_ids();
	first_page();
}

function sort_last_seen() {
	let sort_total = document.getElementsByClassName("sort-total")[0];
	let sort_recent = document.getElementsByClassName("sort-recent")[0];
	let sort_first_seen = document.getElementsByClassName("sort-first-seen")[0];
	let sort_last_seen = document.getElementsByClassName("sort-last-seen")[0];
	
	sort_total.classList.remove("asc");
	sort_total.classList.remove("dsc");
	sort_recent.classList.remove("asc");
	sort_recent.classList.remove("dsc");
	sort_first_seen.classList.remove("asc");
	sort_first_seen.classList.remove("dsc");
	
	if (sort_last_seen.classList.contains("asc")) {
		sort_last_seen.classList.remove("asc");
		sort_last_seen.classList.add("dsc");
	} else {
		sort_last_seen.classList.remove("dsc");
		sort_last_seen.classList.add("asc");
	}
	
	sort_ids();
	first_page();
}

function sort_ids() {
	let sort_total = document.getElementsByClassName("sort-total")[0];
	let sort_recent = document.getElementsByClassName("sort-recent")[0];
	let sort_first_seen = document.getElementsByClassName("sort-first-seen")[0];
	let sort_last_seen = document.getElementsByClassName("sort-last-seen")[0];
	
	if (sort_total.classList.contains("asc")) {
		g_filtered_ids.sort((a, b) => g_player_states[a].totalPlayTime - g_player_states[b].totalPlayTime);
	} else if (sort_total.classList.contains("dsc")) {
		g_filtered_ids.sort((a, b) => g_player_states[b].totalPlayTime - g_player_states[a].totalPlayTime);
	} else if (sort_recent.classList.contains("asc")) {
		g_filtered_ids.sort((a, b) => g_player_states[a].recentPlayTime - g_player_states[b].recentPlayTime);
	} else if (sort_recent.classList.contains("dsc")) {
		g_filtered_ids.sort((a, b) => g_player_states[b].recentPlayTime - g_player_states[a].recentPlayTime);
	} else if (sort_first_seen.classList.contains("asc")) {
		g_filtered_ids.sort((a, b) => g_player_states[a].firstSeen - g_player_states[b].firstSeen);
	} else if (sort_first_seen.classList.contains("dsc")) {
		g_filtered_ids.sort((a, b) => g_player_states[b].firstSeen - g_player_states[a].firstSeen);
	} else if (sort_last_seen.classList.contains("asc")) {
		g_filtered_ids.sort((a, b) => g_player_states[a].lastSeen - g_player_states[b].lastSeen);
	} else if (sort_last_seen.classList.contains("dsc")) {
		g_filtered_ids.sort((a, b) => g_player_states[b].lastSeen - g_player_states[a].lastSeen);
	}
}

function filter_ids() {
	let hide_inactive = document.getElementById('filter_active').checked;
	
	g_filtered_ids = [];
	for (let i = 0; i < g_player_ids.length; i++) {
		let dat = g_player_states[g_player_ids[i]];
		
		if (hide_inactive && dat.recentPlayTime == 0) {
			continue;
		}
		
		g_filtered_ids.push(g_player_ids[i]);
	}
	
	sort_ids();
}

function update_stat_table() {
	let table = document.getElementById('stats_table').querySelector('tbody');	
	
	table.innerHTML = "";
	let today = Math.floor(Date.now() / 1000);
	
	for (let i = result_offset; i < g_filtered_ids.length && i < result_offset + results_per_page; i++) {
		let dat = g_player_states[g_filtered_ids[i]];
		
		let row = table.insertRow(table.rows.length);
		row.innerHTML = "<tr><td></td><td><div></div><img class=\"rank\"/></td><td></td><td></td><td></td><td></tr>";
		
		row.cells[0].textContent = i+1;
		let rank = row.cells[1].getElementsByClassName('rank')[0];
		let name = row.cells[1].getElementsByTagName('div')[0];
		
		set_badge(g_filtered_ids[i], dat.recentPlayTime, rank, dat.mapsPlayed, dat.mapsMultiPlayed, g_map_total);
		
		name.textContent = dat.name;
		name.title = dat.name;
		name.setAttribute("id", dat.id);
		name.addEventListener('click', open_player_profile);

		row.cells[2].textContent = format_age(dat.totalPlayTime, true, true, 2);
		row.cells[2].title = format_age(dat.totalPlayTime, false, true, 2) + " (" + format_age(dat.totalPlayTime, true, true, 3) + ")";
		
		if (dat.recentPlayTime > 0) {
			row.cells[3].textContent = format_age(dat.recentPlayTime, true, true, 2);
			row.cells[3].title = format_age(dat.recentPlayTime, false, true, 2);
		}
		else
			row.cells[3].textContent = "--";
		
		let firstSeenDate = new Date(dat.firstSeen*1000);		
		if (dat.firstSeen == 0) {
			firstSeenDate = new Date(); // new state just joined today
		}
		let firstSeenText = firstSeenDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short', 
			day: 'numeric'
		});
		let firstSeenAge = today - dat.firstSeen;
		if (firstSeenAge < 60*60*24) {
			row.cells[4].textContent = "Today";
		} else {
			row.cells[4].textContent = format_age(firstSeenAge, true, true) + " ago";
			row.cells[4].title = firstSeenText;
		}
		
		let lastSeenDate = new Date(dat.lastSeen*1000);		
		if (dat.lastSeen == 0) {
			lastSeenDate = new Date(); // new state just joined today
		}
		let lastSeenText = lastSeenDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short', 
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		});
		let lastSeenAge = today - dat.lastSeen;
		if (lastSeenAge < 60*60*24) {
			row.cells[5].textContent = "Today";
			row.cells[5].title = lastSeenText;
		} else {
			row.cells[5].textContent = format_age(lastSeenAge, true, true) + " ago";
			row.cells[5].title = lastSeenText;
		}
	}
}

async function setup() {	
	await load_misc_data();

	const url = g_fastdl_server_url + "files/playerdb_all.txt?t=" + Date.now();
	const res = await fetch(url);
	const text = await res.text();
	const lines = text.split(/\r?\n/);
	const salt = new Date().getTime();
	
	for (const line of lines) {
		const parts = line.split("\\");
		
		if (parts.length < 12) {
			console.log("Not enough data in db row");
			continue;
		}
		
		aliases = [];
		for (let i = 12; i < parts.length; i += 4) {
			aliases.push({
				firstUsed: parseInt(parts[i]),
				lastUsed: parseInt(parts[i+1]),
				timeUsed: parseInt(parts[i+2]),
				name: parts[i+3]
			});
		}
		
		let id = BigInt(parts[0]);
		g_player_states[id] = {
			id: id,
			mapsPlayed: parts[1],
			mapsMultiPlayed: parts[2],
			totalPlayTime: parts[3],
			recentPlayTime: parts[4],
			firstSeen: parts[5],
			lastSeen: parts[6],
			model: parts[7],
			steamAvatar: parts[8],
			steamName: parts[9],
			language: parts[10],
			name: parts[11],
			aliases: aliases,
			salt: salt
		};
		
		g_player_ids.push(id);
	}
	
	//console.log(lines);
	//console.log(g_player_data);
	
	let perPageInput = document.getElementById("results_per_page");
	results_per_page = perPageInput.value = 50;
	perPageInput.addEventListener("change", (e) => {
		results_per_page = parseInt(perPageInput.value);
		first_page();
	});
	
	const cb = document.getElementById("filter_active");
	cb.addEventListener("change", (e) => {
		filter_ids();
		first_page();
	});
	
	filter_ids();
	first_page();
	
	document.getElementsByClassName("page-next-container")[0].addEventListener("click", next_page);
	document.getElementsByClassName("page-prev-container")[0].addEventListener("click", prev_page);
	document.getElementsByClassName("page-first-container")[0].addEventListener("click", first_page);
	document.getElementsByClassName("page-last-container")[0].addEventListener("click", last_page);
	
	document.getElementsByClassName("sort-total")[0].addEventListener("click", sort_total);
	document.getElementsByClassName("sort-recent")[0].addEventListener("click", sort_recent);
	document.getElementsByClassName("sort-first-seen")[0].addEventListener("click", sort_first_seen);
	document.getElementsByClassName("sort-last-seen")[0].addEventListener("click", sort_last_seen);
}

function ready(fn) {
  if (document.readyState !== 'loading') {
	fn();
	return;
  }
  document.addEventListener('DOMContentLoaded', fn);
}

ready(setup);