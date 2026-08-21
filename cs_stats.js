var g_sound_stats = [];
var g_filtered_sound_stats = [];
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
	
	document.getElementById('tab_title').textContent = "Sound stats - " + g_server_name;
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
	document.getElementsByClassName("result-total")[0].textContent = "" + g_filtered_sound_stats.length;
	document.getElementsByClassName("page-start")[0].textContent = "" + (result_offset+1);
	document.getElementsByClassName("page-end")[0].textContent = "" + Math.min(result_offset+results_per_page, g_sound_stats.length);
	
	update_stat_table();
}

function next_page() {
	result_offset += results_per_page;
	if (result_offset >= g_sound_stats.length) {
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
		if (result_offset >= g_filtered_sound_stats.length) {
			result_offset -= results_per_page;
			break;
		}
	}
	load_page();
}

function sort_generic(name) {
	let all_sorts = [
		document.getElementsByClassName("sort-name")[0],
		document.getElementsByClassName("sort-users")[0],
		document.getElementsByClassName("sort-topuses")[0],
		document.getElementsByClassName("sort-uses")[0],
		document.getElementsByClassName("sort-user")[0],
		document.getElementsByClassName("sort-uploaded")[0],
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

function sort_uses() {
	sort_generic("sort-uses");	
}

function sort_users() {
	sort_generic("sort-users");	
}

function sort_topuses() {
	sort_generic("sort-topuses");	
}

function sort_user() {
	sort_generic("sort-user");	
}

function sort_uploaded() {
	sort_generic("sort-uploaded");	
}

function sort_ids() {
	let sort_name = document.getElementsByClassName("sort-name")[0];
	let sort_topuses = document.getElementsByClassName("sort-topuses")[0];
	let sort_uses = document.getElementsByClassName("sort-uses")[0];
	let sort_users = document.getElementsByClassName("sort-users")[0];
	let sort_user = document.getElementsByClassName("sort-user")[0];
	let sort_uploaded = document.getElementsByClassName("sort-uploaded")[0];
	
	if (sort_uses.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => a.totalUses - b.totalUses);
	} else if (sort_uses.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => b.totalUses - a.totalUses);
	} else if (sort_user.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => a.topUserName.localeCompare(b.topUserName, undefined, { sensitivity: "base" }));
	} else if (sort_user.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => b.topUserName.localeCompare(a.topUserName, undefined, { sensitivity: "base" }));
	} else if (sort_uploaded.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => a.modified - b.modified);
	} else if (sort_uploaded.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => b.modified - a.modified);
	} else if (sort_name.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => b.name.localeCompare(a.name));
	} else if (sort_name.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => a.name.localeCompare(b.name));
	} else if (sort_topuses.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => a.topUserUses - b.topUserUses);
	} else if (sort_topuses.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => b.topUserUses - a.topUserUses);
	} else if (sort_users.classList.contains("asc")) {
		g_sound_stats.sort((a, b) => a.totalUsers - b.totalUsers);
	} else if (sort_users.classList.contains("dsc")) {
		g_sound_stats.sort((a, b) => b.totalUsers - a.totalUsers);
	}
}

function search_filter() {
	let searchText = document.getElementById("search_bar").value.toLowerCase();
	
	g_filtered_sound_stats = [];
	for (let i = 0; i < g_sound_stats.length; i++) {
		if (searchText.length && !g_sound_stats[i].name.toLowerCase().includes(searchText) && !g_sound_stats[i].topUserName.toLowerCase().includes(searchText)) {
			continue;
		}

		g_filtered_sound_stats.push(i);
	}
	
	first_page();
}

function update_stat_table() {
	let table = document.getElementById('stats_table').querySelector('tbody');	
	
	table.innerHTML = "";
	let today = Math.floor(Date.now() / 1000);
	
	for (let i = result_offset; i < g_filtered_sound_stats.length && i < result_offset + results_per_page; i++) {
		let dat = g_sound_stats[g_filtered_sound_stats[i]];
		
		let row = table.insertRow(table.rows.length);
		row.innerHTML = "<tr><td></td><td></td><td></td><td></td><td></td><td><div></div></td><td></td></tr>";
		
		row.cells[0].textContent = i+1;
		row.cells[1].textContent = dat.name;
		row.cells[1].title = dat.name;
		row.cells[2].textContent = dat.totalUses;
		
		row.cells[3].textContent = dat.totalUsers;
		
		row.cells[4].textContent = dat.topUserUses;
		row.cells[4].title = dat.topTitle;
		
		row.cells[5].title = dat.topTitle;
		let name = row.cells[5].getElementsByTagName('div')[0];		
		name.textContent = dat.topUserName;
		name.setAttribute("id", dat.topUserId);
		name.addEventListener('click', open_player_profile);
		
		let firstSeenDate = new Date(dat.modified*1000);		
		if (dat.modified == 0) {
			firstSeenDate = new Date(); // new state just joined today
		}
		let firstSeenText = firstSeenDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short', 
			day: 'numeric'
		});
		let firstSeenAge = today - dat.modified;
		if (firstSeenAge < 60*60*24) {
			row.cells[6].textContent = "Today";
		} else {
			row.cells[6].textContent = format_age(firstSeenAge, true, true) + " ago";
			row.cells[6].title = firstSeenText;
		}
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

	const url = g_fastdl_server_url + "files/cs_stats.json?t=" + Date.now();
	
	await fetch(url)
		.then(response => response.json())
		.then(data => {			
			for (const [key, value] of Object.entries(data["stats"])) {
				value["name"] = key;
				
				let ustats = value["userstats"];
				let topUser = Object.keys(ustats).reduce((a, b) =>
					ustats[a] > ustats[b] ? a : b
				);
				
				const keys = Object.keys(ustats).sort((a, b) => ustats[b] - ustats[a]);
				
				if (keys.length > 0) {
					value["topUserId"] = topUser;
					value["topUserUses"] = ustats[topUser];
					value["topUserName"] = g_player_states[topUser] ? g_player_states[topUser].name : topUser;
					
					value["topTitle"] = "1) used " + ustats[keys[0]] + " times by     " + value["topUserName"];
					if (keys.length > 1) {
						let name = g_player_states[keys[1]] ? g_player_states[keys[1]].name : keys[1];
						value["topTitle"] += "\n2) used " + ustats[keys[1]] + " times by     " + name;
					}
					if (keys.length > 2) {
						let name = g_player_states[keys[2]] ? g_player_states[keys[2]].name : keys[2];
						value["topTitle"] += "\n3) used " + ustats[keys[2]] + " times by     " + name;
					}
				}
				
				g_sound_stats.push(value);
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
	document.getElementsByClassName("sort-uses")[0].addEventListener("click", sort_uses);
	document.getElementsByClassName("sort-users")[0].addEventListener("click", sort_users);
	document.getElementsByClassName("sort-topuses")[0].addEventListener("click", sort_topuses);
	document.getElementsByClassName("sort-user")[0].addEventListener("click", sort_user);
	document.getElementsByClassName("sort-uploaded")[0].addEventListener("click", sort_uploaded);
	
	init_common();
	
	sort_uses();
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