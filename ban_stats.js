var g_ban_stats = [];
var g_filtered_ban_stats = [];
var g_player_states = {};
var g_server_name = "Half-Life Co-op";
var g_update_time = 0;
var result_offset = 0;

var g_map_total = 0;
var g_steamid = 0;
var g_is_stats_page = true;
var g_player_clients = {};

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
		} else if (parts[0] == "most_active_id") {
			g_most_active_id = BigInt(val);
			console.log("Most active ID: " + g_most_active_id);
		}
	}
	
	document.getElementById('tab_title').textContent = "Ban stats - " + g_server_name;
	document.getElementById('server_name').textContent = g_server_name;
	
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
	document.getElementsByClassName("result-total")[0].textContent = "" + g_filtered_ban_stats.length;
	document.getElementsByClassName("page-start")[0].textContent = "" + (result_offset+1);
	document.getElementsByClassName("page-end")[0].textContent = "" + Math.min(result_offset+results_per_page, g_filtered_ban_stats.length);
	
	update_stat_table();
}

function next_page() {
	result_offset += results_per_page;
	if (result_offset >= g_filtered_ban_stats.length) {
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
		if (result_offset >= g_filtered_ban_stats.length) {
			result_offset -= results_per_page;
			break;
		}
	}
	load_page();
}

function sort_generic(name) {
	let all_sorts = [
		document.getElementsByClassName("sort-name")[0],
		document.getElementsByClassName("sort-count")[0],
		document.getElementsByClassName("sort-time")[0],
		document.getElementsByClassName("sort-lastp")[0],
	];
	
	for (let i = 0; i < all_sorts.length; i++) {
		if (all_sorts[i].classList.contains(name)) {
			if (all_sorts[i].classList.contains("dsc")) {
				all_sorts[i].classList.remove("dsc");
				all_sorts[i].classList.add("asc");
			} else {
				all_sorts[i].classList.remove("asc");
				all_sorts[i].classList.add("dsc");
			}
		} else {
			all_sorts[i].classList.remove("dsc");
			all_sorts[i].classList.remove("asc");
		}
	}
	
	sort_ids();
	search_filter();
}

function sort_name() {
	sort_generic("sort-name");	
}

function sort_count() {
	sort_generic("sort-count");	
}

function sort_time() {
	sort_generic("sort-time");	
}

function sort_lastp() {
	sort_generic("sort-lastp");	
}

function sort_ids() {
	let sort_name = document.getElementsByClassName("sort-name")[0];
	let sort_count = document.getElementsByClassName("sort-count")[0];
	let sort_time = document.getElementsByClassName("sort-time")[0];
	let sort_lastp = document.getElementsByClassName("sort-lastp")[0];
	
	if (sort_time.classList.contains("asc")) {
		g_ban_stats.sort((a, b) => a.total_time - b.total_time);
	} else if (sort_time.classList.contains("dsc")) {
		g_ban_stats.sort((a, b) => b.total_time - a.total_time);
	} else if (sort_lastp.classList.contains("asc")) {
		g_ban_stats.sort((a, b) => a.last_punish - b.last_punish);
	} else if (sort_lastp.classList.contains("dsc")) {
		g_ban_stats.sort((a, b) => b.last_punish - a.last_punish);
	} else if (sort_name.classList.contains("asc")) {
		g_ban_stats.sort((a, b) => b.name.localeCompare(a.name));
	} else if (sort_name.classList.contains("dsc")) {
		g_ban_stats.sort((a, b) => a.name.localeCompare(b.name));
	} else if (sort_count.classList.contains("asc")) {
		g_ban_stats.sort((a, b) => a.punish_count - b.punish_count);
	} else if (sort_count.classList.contains("dsc")) {
		g_ban_stats.sort((a, b) => b.punish_count - a.punish_count);
	}
}

function search_filter() {
	let searchText = document.getElementById("search_bar").value.toLowerCase();
	
	g_filtered_ban_stats = [];
	for (let i = 0; i < g_ban_stats.length; i++) {
		if (searchText.length && !g_ban_stats[i].name.toLowerCase().includes(searchText) && !g_ban_stats[i].last_reason.toLowerCase().includes(searchText)) {
			continue;
		}

		g_filtered_ban_stats.push(i);
	}
	
	first_page();
}

function steamID32To64(steamID) {
    const match = steamID.match(/^STEAM_\d+:([01]):(\d+)$/);
    if (!match) {
        throw new Error("Invalid SteamID32");
    }

    const y = BigInt(match[1]);
    const z = BigInt(match[2]);

    return (z * 2n + y + 76561197960265728n).toString();
}

function update_stat_table() {
	let table = document.getElementById('stats_table').querySelector('tbody');	
	
	table.innerHTML = "";
	let today = Math.floor(Date.now() / 1000);
	
	for (let i = result_offset; i < g_filtered_ban_stats.length && i < result_offset + results_per_page; i++) {
		let dat = g_ban_stats[g_filtered_ban_stats[i]];
		
		let row = table.insertRow(table.rows.length);
		row.innerHTML = "<tr><td></td><td><div></div></td><td></td><td></td><td></td><td></td></tr>";
		
		row.cells[0].textContent = i+1;
		
		row.cells[1].title = dat.name;
		let name = row.cells[1].getElementsByTagName('div')[0];		
		name.textContent = dat.name;
		name.setAttribute("id", dat.id);
		
		if (dat.has_profile) {
			name.addEventListener('click', open_player_profile);
		} else {
			name.addEventListener('click', () => {
				window.open("https://steamcommunity.com/profiles/" + dat.id, "_blank");
			});
			row.cells[1].title += "\n\nThis player's name and profile is missing because they have less than 1 hour of playtime on the server.";
		}
		
		row.cells[2].textContent = dat.punish_count;
		row.cells[2].title = dat.punish_desc;
		
		if (dat.total_time >= 60 * 60 * 24 * 365 * 10) {
			row.cells[3].textContent = "Permanent";
			row.cells[3].title = format_age(dat.total_time, false, true);
		} else {
			row.cells[3].textContent = format_age(dat.total_time, true, true);
			row.cells[3].title = format_age(dat.total_time, false, true);
		}
		
		row.cells[4].textContent = dat.last_punish;
		
		let firstSeenDate = new Date(dat.last_punish*1000);		
		if (dat.last_punish == 0) {
			firstSeenDate = new Date(); // new state just joined today
		}
		let firstSeenText = firstSeenDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short', 
			day: 'numeric'
		});
		let firstSeenAge = today - dat.last_punish;
		if (firstSeenAge < 60*60*24) {
			row.cells[4].textContent = "Today";
		} else {
			row.cells[4].textContent = format_age(firstSeenAge, true, true) + " ago";
			row.cells[4].title = firstSeenText;
		}
		
		row.cells[5].textContent = dat.last_reason;
		
		const match = dat.last_reason.match(/STEAM_\d+:[01]:\d+/);
		if (match) {
			let evaderId = steamID32To64(match[0]);
			row.cells[5].innerHTML = dat.last_reason.replace(/STEAM_\d+:[01]:\d+/g, "<div></div>");
			let evader = row.cells[5].getElementsByTagName('div')[0];		
			evader.textContent = g_player_states[evaderId] ? g_player_states[evaderId].name : evaderId;
			evader.setAttribute("id", evaderId);
			evader.addEventListener('click', open_player_profile);
		}
		
		row.cells[5].title = dat.last_reason;
	}
}

async function load_player_data() {
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
	}
}

async function setup() {	
	await load_misc_data();
	await load_player_data();

	const url = g_fastdl_server_url + "files/bans.json?t=" + Date.now();
	
	await fetch(url)
		.then(response => response.json())
		.then(data => {			
			for (const [key, value] of Object.entries(data["bans"])) {
				let dat = {
					"id": key,
					"name": g_player_states[key] ? g_player_states[key].name : key,
					"has_profile": g_player_states[key] ? true : false,
					"bans": value,
					"punish_count": 0,
					"punish_desc": "Punishments:",
					"total_time": 0,
					"last_punish": 0,
					"last_reason" : "",
				}
				
				for (let i = 0; i < value.length; i++) {
					let ban = value[i];
					dat.punish_count += 1;
					dat.total_time += ban.minutes*60;
					
					if (ban.start > dat.last_punish) {
						dat.last_punish = ban.start;
						dat.last_reason = ban.reason;
					}
					
					dat.punish_desc += "\n" + get_punish_desc(ban);
				}
				
				if (data["ban_notes"][key]) {
					dat.punish_desc += "\n\nw00tguy notes:\n" + data["ban_notes"][key]["notes"];
				}
				
				g_ban_stats.push(dat);
			}
			
			g_update_time = data["time"];
		})
		.catch(error => {
			console.error('Failed to load JSON:', error);
		});
		
	refresh_update_time();
	setInterval(refresh_update_time, 1000, -1);
	
	let perPageInput = document.getElementById("results_per_page");
	results_per_page = perPageInput.value = 30;
	perPageInput.addEventListener("change", (e) => {
		results_per_page = parseInt(perPageInput.value);
		first_page();
	});
	
	document.getElementById("search_bar").addEventListener('input', search_filter);
	
	document.getElementsByClassName("page-next-container")[0].addEventListener("click", next_page);
	document.getElementsByClassName("page-prev-container")[0].addEventListener("click", prev_page);
	document.getElementsByClassName("page-first-container")[0].addEventListener("click", first_page);
	document.getElementsByClassName("page-last-container")[0].addEventListener("click", last_page);
	
	document.getElementsByClassName("sort-name")[0].addEventListener("click", sort_name);
	document.getElementsByClassName("sort-count")[0].addEventListener("click", sort_count);
	document.getElementsByClassName("sort-time")[0].addEventListener("click", sort_time);
	document.getElementsByClassName("sort-lastp")[0].addEventListener("click", sort_lastp);
	
	init_common();
	
	sort_lastp();
	search_filter();
}

function ready(fn) {
  if (document.readyState !== 'loading') {
	fn();
	return;
  }
  document.addEventListener('DOMContentLoaded', fn);
}

ready(setup);