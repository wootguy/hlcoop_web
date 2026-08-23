var g_map_stats = [];
var g_filtered_map_stats = [];
var g_map_info = {};
var g_server_name = "Half-Life Co-op";
var g_update_time = 0;
var result_offset = 0;

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
		
		if (parts[0] == "server_name") {
			g_server_name = val;
			console.log("Server name: " + g_server_name);
		}
	}
	
	document.getElementById('tab_title').textContent = "Map stats - " + g_server_name;
	document.getElementById('server_name').textContent = g_server_name;
}

function load_page() {	
	document.getElementsByClassName("result-total")[0].textContent = "" + g_filtered_map_stats.length;
	document.getElementsByClassName("page-start")[0].textContent = "" + (result_offset+1);
	document.getElementsByClassName("page-end")[0].textContent = "" + Math.min(result_offset+results_per_page, g_filtered_map_stats.length);
	
	update_stat_table();
}

function next_page() {
	result_offset += results_per_page;
	if (result_offset >= g_filtered_map_stats.length) {
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
		if (result_offset >= g_map_stats.length) {
			result_offset -= results_per_page;
			break;
		}
	}
	load_page();
}

function sort_generic(name) {
	let all_sorts = [
		document.getElementsByClassName("sort-rating")[0],
		document.getElementsByClassName("sort-plays")[0],
		document.getElementsByClassName("sort-time")[0],
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

function sort_rating() {
	sort_generic("sort-rating");	
}

function sort_like() {
	sort_generic("sort-like");	
}

function sort_dislike() {
	sort_generic("sort-dislike");	
}

function sort_uploaded() {
	sort_generic("sort-uploaded");	
}

function sort_plays() {
	sort_generic("sort-plays");	
}

function sort_time() {
	sort_generic("sort-time");	
}

function sort_ids() {	
	let sort_rating = document.getElementsByClassName("sort-rating")[0];
	let sort_plays = document.getElementsByClassName("sort-plays")[0];
	let sort_time = document.getElementsByClassName("sort-time")[0];
	let sort_uploaded = document.getElementsByClassName("sort-uploaded")[0];
	
	if (sort_rating.classList.contains("asc")) {
		g_map_stats.sort((a, b) => a.rating - b.rating);
	} else if (sort_rating.classList.contains("dsc")) {
		g_map_stats.sort((a, b) => b.rating - a.rating);
	} else if (sort_time.classList.contains("asc")) {
		g_map_stats.sort((a, b) => a.median_time - b.median_time);
	} else if (sort_time.classList.contains("dsc")) {
		g_map_stats.sort((a, b) => b.median_time - a.median_time);
	} else if (sort_uploaded.classList.contains("asc")) {
		g_map_stats.sort((a, b) => a.first_seen - b.first_seen);
	} else if (sort_uploaded.classList.contains("dsc")) {
		g_map_stats.sort((a, b) => b.first_seen - a.first_seen);
	} else if (sort_plays.classList.contains("asc")) {
		g_map_stats.sort((a, b) => a.win_rate - b.win_rate);
	} else if (sort_plays.classList.contains("dsc")) {
		g_map_stats.sort((a, b) => b.win_rate - a.win_rate);
	}
}

function search_filter() {
	let searchText = document.getElementById("search_bar").value.toLowerCase();
	
	g_filtered_map_stats = [];
	for (let i = 0; i < g_map_stats.length; i++) {
		if (searchText.length && !g_map_stats[i].name.toLowerCase().includes(searchText)) {
			continue;
		}

		g_filtered_map_stats.push(i);
	}
	
	first_page();
}

function update_stat_table() {
	let table = document.getElementById('stats_table').querySelector('tbody');	
	
	table.innerHTML = "";
	let today = Math.floor(Date.now() / 1000);
	
	for (let i = result_offset; i < g_filtered_map_stats.length && i < result_offset + results_per_page; i++) {
		let dat = g_map_stats[g_filtered_map_stats[i]];
		
		let row = table.insertRow(table.rows.length);
		row.innerHTML = "<tr><td></td><td><a target=\"_blank\" class=\"map-link\"></a></td><td><span class=\"rating\"></span><span class=\"rate-count\"></span></td><td><span class=\"winrate\"></span><span class=\"play-count\"></span></td><td></td><td></td></tr>";
		
		row.cells[0].textContent = i+1;
		row.cells[1].getElementsByClassName("map-link")[0].textContent = dat.name;
		row.cells[1].getElementsByClassName("map-link")[0].href = "http://scmapdb.wikidot.com/map:" + dat.link;
		row.cells[1].title = (dat.maps.length == 1 ? "" : dat.maps.length + " map series:\n") + dat.maps.join("\n");
		row.cells[2].getElementsByClassName("rating")[0].textContent = dat.rating;
		row.cells[2].getElementsByClassName("rate-count")[0].textContent = "/" + (dat.likefavs + dat.dislikes);
		row.cells[2].title = "Total ratings: " + (dat.likefavs + dat.dislikes)
							+ "\nPositive: " + dat.likefavs
							+ "\nNegative: " + dat.dislikes;
		row.cells[3].getElementsByClassName("winrate")[0].textContent = dat.win_rate + "%";
		row.cells[3].getElementsByClassName("play-count")[0].textContent = "/" + dat.plays;
		row.cells[3].title = "Plays: " + dat.plays + "\nRTVs: " + dat.rtvs;
		
		if (dat.median_time != 0) {			
			row.cells[4].textContent = format_age(dat.median_time, false, false, 2);
			
			// leaving out the fastest time for now because it's counting the times I did a changelevel command
			// to test something and there's no way to differentiate that from normal level changes
			//row.cells[4].title = "Median: " + format_age(dat.median_time, false, true, 2)
			//					+ "\nFastest: " + format_age(dat.fastest_time, false, true, 2);
			
			row.cells[4].title = format_age(dat.median_time, false, true, 2)
		} else {
			row.cells[4].textContent = "--";
			row.cells[4].title = "This map has never been completed. The map may be new, or another map was appended to this series."
		}
		
		let firstSeenDate = new Date(dat.first_seen*1000);		
		if (dat.first_seen == 0) {
			firstSeenDate = new Date(); // new state just joined today
		}
		let firstSeenText = firstSeenDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short', 
			day: 'numeric'
		});
		let firstSeenAge = today - dat.first_seen;
		if (firstSeenAge < 60*60*24) {
			row.cells[5].textContent = "Today";
		} else {
			row.cells[5].textContent = format_age(firstSeenAge, true, true) + " ago";
			row.cells[5].title = firstSeenText;
		}
	}
}

async function setup() {	
	await load_misc_data();

	const url = g_fastdl_server_url + "files/map_stats.json?t=" + Date.now();
	
	let map_infos = await downloadJson("mapdb.json");
	for (let i = 0; i < map_infos.length; i++) {
		
		let first_map = map_infos[i].maps[0];
		g_map_info[first_map] = {
			link: map_infos[i].link,
			maps: map_infos[i].maps
		};
	}
	
	await fetch(url)
		.then(response => response.json())
		.then(data => {			
			for (const [key, value] of Object.entries(data["maps"])) {
				value["name"] = key;
				
				let total_ratings = value["likes"] + value["favorites"] + value["dislikes"];
				if (total_ratings > 0) {
					let shift = value["likes"] + value["favorites"] - value["dislikes"];
					value["rating"] = shift > 0 ? "+" + shift : shift;
				}
				else
					value["rating"] = 0;
				
				value["win_rate"] = 100 - Math.round((value["rtvs"] / value["plays"]) * 100);
				value["likefavs"] = value["likes"] + value["favorites"];
				if (key in g_map_info) {
					value["link"] = g_map_info[key].link;
					value["maps"] = g_map_info[key].maps;
				} else {
					value["link"] = "";
					value["maps"] = [];
				}
				g_map_stats.push(value);
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
	
	document.getElementsByClassName("sort-rating")[0].addEventListener("click", sort_rating);
	document.getElementsByClassName("sort-plays")[0].addEventListener("click", sort_plays);
	document.getElementsByClassName("sort-time")[0].addEventListener("click", sort_time);
	document.getElementsByClassName("sort-uploaded")[0].addEventListener("click", sort_uploaded);
	
	init_common();
	
	sort_rating();
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