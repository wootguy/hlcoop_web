var g_game_id = "hl";
var data_repo_count = 32;
var data_repo_domain = "https://wootdata.github.io/";

function set_badge(id, recentTime, rankDiv, mapsPlayed, mapsMultiPlayed, totalMaps) {
	rankDiv.classList.remove("hidden");
	
	if (id == g_most_active_id) {
		rankDiv.title = "ADDICT - The most active player in the past 2 weeks.";
		rankDiv.src = "icon/hot.png";
	}
	else if (!mapsPlayed || mapsPlayed < 10) {
		rankDiv.title = "NEWB - Played fewer than 10 maps";
		rankDiv.src = "icon/newb.png";
	}
	else if (recentTime > 0 && recentTime < 60*60) {
		rankDiv.title = "FROSTY - Less than 1 hour of playtime in the past 2 weeks.";
		rankDiv.src = "icon/frosty.png";
	}
	else if (mapsMultiPlayed >= totalMaps) {
		rankDiv.title = "AUTIST - Played every map 10+ times";
		rankDiv.src = "icon/rank_5.png";
	}
	else if (mapsPlayed >= totalMaps) {
		rankDiv.title = "MASTER - Played every map";
		rankDiv.src = "icon/rank_4.png";
	}
	else if (mapsPlayed >= 600) {
		rankDiv.title = "VETERAN - Played 600+ maps";
		rankDiv.src = "icon/rank_3.png";
	}
	else if (mapsPlayed >= 300) {
		rankDiv.title = "REGULAR - Played 300+ maps";
		rankDiv.src = "icon/rank_2.png";
	}
	else if (mapsPlayed >= 100) {
		rankDiv.title = "NOVICE - Played 100+ maps";
		rankDiv.src = "icon/rank_1.png";
	}
	else {
		rankDiv.classList.add("hidden");
	}
}

function format_age(secondsPassed, oneUnitOnly, longUnits, maxUnit) {
	let seconds = secondsPassed;
	let minutes = Math.floor(secondsPassed / 60);
	let hours = Math.floor(secondsPassed / (60*60));
	let days = Math.floor(secondsPassed / (60*60*24));
	let months = Math.floor(days / 30);
	let years = Math.floor(days / 365);
	
	let yearUnit = longUnits ? (years != 1 ? " years" : " year") : "y";
	let monthUnit = longUnits ? (months != 1 ? " months" : " month") : "mo";
	let dayUnit = longUnits ? (days != 1 ? " days" : " day") : "d";
	let hourUnit = longUnits ? (hours != 1 ? " hours" : " hour") : "h";
	let minuteUnit = longUnits ? (minutes != 1 ? " minutes" : " minute") : "m";
	let secondUnit = longUnits ? (seconds != 1 ? " seconds" : " second") : "s";
	let separator = longUnits ? ", " : " ";
	let minUnit = oneUnitOnly ? 2 : 1;
	
	if (years > 0 && (!maxUnit || maxUnit >= 5)) {
		if (oneUnitOnly) {
			let val = Math.round(days / 365);
			return "" + val.toLocaleString() + ((val != 1) ? " years" : " year");
		} else {
			return "" + years + yearUnit + separator + (months % 12) + monthUnit;
		}
	}
	else if (months >= 2 && (!maxUnit || maxUnit >= 4)) {
		if (oneUnitOnly) {
			let val = Math.round(days / 30);
			return "" + val.toLocaleString() + ((val != 1) ? " months" : " month");
		} else {
			return "" + months + monthUnit + separator + (days % 30) + dayUnit;
		}
	}
	else if ((days >= 1 || (!oneUnitOnly && hours > 48)) && (!maxUnit || maxUnit >= 3)) {
		if (oneUnitOnly) {
			let val = Math.round(hours / 24);
			return "" + val.toLocaleString() + ((val != 1) ? " days" : " day");
		} else {
			return "" + days + dayUnit + separator + (hours % 24) + hourUnit;
		}
	}
	else if (hours >= 1 && (!maxUnit || maxUnit >= 2)) {
		if (oneUnitOnly) {
			return "" + hours.toLocaleString() + hourUnit;
		} else {
			return "" + hours + hourUnit + separator + (minutes % 60) + minuteUnit;
		}
	}
	else if (minutes > 2 && (!maxUnit || maxUnit >= 1)) {
		return "" + minutes + minuteUnit;
	}
	else {
		return "" + seconds + secondUnit;
	}
}

function steamid64_to_steamid(steam64) {
	const base = BigInt("76561197960265728");
	let id = BigInt(steam64) - base;

	const Y = id % 2n;
	const Z = (id - Y) / 2n;

	return `STEAM_0:${Y}:${Z}`;
}

function hash_code(str) {
	var hash = 0;

	for (var i = 0; i < str.length; i++) {
		var char = str.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash % 15485863; // prevent hash ever increasing beyond 31 bits

	}
	return hash;
}

async function load_shared_html() {
	await fetch("player_profile.html")
	  .then(res => res.text())
	  .then(html => {
		document.getElementById("player_profile").innerHTML = html;
	});
}

function get_repo_url(model_name) {
	var repoId = hash_code(model_name) % data_repo_count;
	return data_repo_domain + g_game_id + "models_data_" + repoId + "/";
}

function get_client_details_tip(steamid) {
	let clientStr_tip = "Client details are unknown. This player either hasn't joined recently or failed to respond to client queries.";
	
	if (steamid in g_player_clients) {
		let deetz = g_player_clients[steamid];
		
		clientStr_tip = "Mod: " + deetz.modStr + "\n";
		
		clientStr_tip += "OS: ";
		if (deetz.os == 1) {
			clientStr_tip += "Windows";
		} else if (deetz.os == 2) {
			clientStr_tip += "Linux";
		}
		
		clientStr_tip += "\nEngine: ";
		if (deetz.engine == 1) {
			clientStr_tip += "Steam";
		} else if (deetz.engine == 2) {
			clientStr_tip += "steam_legacy";
		}
		
		clientStr_tip += "\nRenderer: ";
		if (deetz.renderer == 1) {
			clientStr_tip += "OpenGL";
		} else if (deetz.renderer == 2) {
			clientStr_tip += "Software";
		}
	}
	
	return clientStr_tip;
}

function open_player_profile(event) {	
	let clickedId = event.currentTarget.getAttribute("id");
	if (!clickedId)
		clickedId = event.currentTarget.parentElement.parentElement.getAttribute("steamid");
	let player_profile = document.getElementById("player_profile");
	g_opened_profile_id = clickedId;
	let is_own_profile = clickedId == g_steamid;

	const state = g_player_states[clickedId];
	const avatar = "https://avatars.steamstatic.com/" + state.steamAvatar;
	let spray = g_fastdl_server_url + "sprays/" + clickedId + ".png";
	let firstSeenDate = new Date(state.firstSeen*1000);
	
	if (state.sprayBanReason) {
		spray = "icon/spray_banned.png";
	}
	
	if (state.firstSeen == 0) {
		firstSeenDate = new Date(); // new state just joined today
	}
	
	let firstSeenText = firstSeenDate.toLocaleString(undefined, {
		year: 'numeric', 
		month: 'short', 
		day: 'numeric'
	});
	
	const lang = (state.language in g_languages) ? g_languages[state.language] : state.language;
	let percentPlayed = Math.floor((state.mapsPlayed / g_map_total) * 100);
	let mapsPlayed = state.mapsPlayed + " / " + g_map_total + " (" + percentPlayed + "%)";
	let steamlink = "<a href=\"https://steamcommunity.com/profiles/" + clickedId + "\" target=\"_blank\">" + steamid64_to_steamid(clickedId) + "</a>";
	
	let clientStr = "Unknown";
	
	if (clickedId in g_player_clients) {
		if (g_player_clients[clickedId].modStr)
			clientStr = g_player_clients[clickedId].modStr;
	}
	
	let clientStr_tip = get_client_details_tip(clickedId);
	
	player_profile.style.display = "block";
	player_profile.getElementsByClassName("avatar_img")[0].src = avatar;
	player_profile.getElementsByClassName("spray_img")[0].src = spray + "?t=" + state.salt;
	player_profile.getElementsByClassName("lang")[0].textContent = lang;
	player_profile.getElementsByClassName("name")[0].textContent = state.name;
	player_profile.getElementsByClassName("steam_name")[0].textContent = state.steamName;
	player_profile.getElementsByClassName("steam_id")[0].innerHTML = steamlink;
	player_profile.getElementsByClassName("maps_played")[0].textContent = mapsPlayed;
	player_profile.getElementsByClassName("like_cooldown")[0].value = state.likeCooldown;
	player_profile.getElementsByClassName("like_cooldown")[0].disabled = !is_own_profile;
	player_profile.getElementsByClassName("play_time")[0].textContent = format_age(state.totalPlayTime, true, true, 2);
	player_profile.getElementsByClassName("play_time")[0].title = format_age(state.totalPlayTime, false, true, 2) + " (" + format_age(state.totalPlayTime, true, true, 3) + ")";
	player_profile.getElementsByClassName("play_time_recent")[0].textContent = format_age(state.recentPlayTime, true, true, 2);
	player_profile.getElementsByClassName("play_time_recent")[0].title = format_age(state.recentPlayTime, false, true, 2);
	player_profile.getElementsByClassName("first_seen")[0].textContent = firstSeenText;
	player_profile.getElementsByClassName("client_type")[0].textContent = clientStr;
	player_profile.getElementsByClassName("client_type")[0].title = clientStr_tip;
	
	if (state.sprayBanReason) {
		player_profile.getElementsByClassName("spray_img")[0].title = 'This player lost their spray prviledge.\n\nBan reason: "' + state.sprayBanReason + '"';
	} else {
		player_profile.getElementsByClassName("spray_img")[0].title = "";
	}
	
	let model_name = state.model;
	let pmodel_img_src = get_repo_url(model_name) + "models/player/" + model_name + "/" + model_name + "_large.png";
	if (!model_name) {
		pmodel_img_src = "icon/missing_pmodel.png";
		model_name = "<missing data>"
	}
	player_profile.getElementsByClassName("pmodel_img")[0].src = pmodel_img_src;
	player_profile.getElementsByClassName("pmodel_name")[0].textContent = model_name;
	
	let alias_list = player_profile.getElementsByClassName("alias_details")[0].querySelector('tbody');
	alias_list.innerHTML = "";
	
	for (let i = 0; i < state.aliases.length; i++) {
		let alias = state.aliases[i];
		let lastUsed = alias.lastUsed*24*60*60*1000;
		let firstUsed = alias.firstUsed*24*60*60*1000;
		const deltaTime = Number(new Date()) - Number(lastUsed);
		let timeSince = format_age(deltaTime/1000, true) + " ago";
		let timeUsed = format_age(alias.timeUsed, true, true, 2);
		
		const lastUseDate = new Date(lastUsed);
		let lastUseText = lastUseDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short',
			day: 'numeric'
		});
		
		const firstUseDate = new Date(firstUsed);
		let firstUseText = firstUseDate.toLocaleString(undefined, {
			year: 'numeric', 
			month: 'short',
			day: 'numeric'
		});
		
		if (!g_is_stats_page && alias.name == state.name) {
			lastUseText = "Now";
		}
		
		let nameCell = document.createElement('td');
		nameCell.textContent = alias.name;
		nameCell.title = alias.name;
		
		let timeUsedCell = document.createElement('td');
		timeUsedCell.textContent = timeUsed;
		timeUsedCell.title = "First used: " + firstUseText + "\nLast used: " + lastUseText;
		
		let row = alias_list.insertRow(alias_list.rows.length);
		row.appendChild(nameCell);
		row.appendChild(timeUsedCell);
	}
}


const g_languages = {
  "ab": "Abkhaz",
  "ace": "Acehnese",
  "ach": "Acholi",
  "af": "Afrikaans",
  "sq": "Albanian",
  "alz": "Alur",
  "am": "Amharic",
  "ar": "Arabic",
  "hy": "Armenian",
  "as": "Assamese",
  "awa": "Awadhi",
  "ay": "Aymara",
  "az": "Azerbaijani",
  "ban": "Balinese",
  "bm": "Bambara",
  "ba": "Bashkir",
  "eu": "Basque",
  "btx": "Batak Karo",
  "bts": "Batak Simalungun",
  "bbc": "Batak Toba",
  "be": "Belarusian",
  "bem": "Bemba",
  "bn": "Bengali",
  "bew": "Betawi",
  "bho": "Bhojpuri",
  "bik": "Bikol",
  "bs": "Bosnian",
  "br": "Breton",
  "bg": "Bulgarian",
  "bua": "Buryat",
  "yue": "Cantonese",
  "ca": "Catalan",
  "ceb": "Cebuano",
  "ny": "Chichewa (Nyanja)",
  "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)",
  "cv": "Chuvash",
  "co": "Corsican",
  "crh": "Crimean Tatar",
  "hr": "Croatian",
  "cs": "Czech",
  "da": "Danish",
  "din": "Dinka",
  "dv": "Divehi",
  "doi": "Dogri",
  "dov": "Dombe",
  "nl": "Dutch",
  "dz": "Dzongkha",
  "en": "English",
  "eo": "Esperanto",
  "et": "Estonian",
  "ee": "Ewe",
  "fj": "Fijian",
  "fil": "Filipino (Tagalog)",
  "tl": "Filipino (Tagalog)",
  "fi": "Finnish",
  "fr": "French",
  "fr-fr": "French (French)",
  "fr-ca": "French (Canadian)",
  "fy": "Frisian",
  "ff": "Fulfulde",
  "gaa": "Ga",
  "gl": "Galician",
  "lg": "Ganda (Luganda)",
  "ka": "Georgian",
  "de": "German",
  "el": "Greek",
  "gn": "Guarani",
  "gu": "Gujarati",
  "ht": "Haitian Creole",
  "cnh": "Hakha Chin",
  "ha": "Hausa",
  "haw": "Hawaiian",
  "iw": "Hebrew",
  "he": "Hebrew",
  "hil": "Hiligaynon",
  "hi": "Hindi",
  "hmn": "Hmong",
  "hu": "Hungarian",
  "hrx": "Hunsrik",
  "is": "Icelandic",
  "ig": "Igbo",
  "ilo": "Iloko",
  "id": "Indonesian",
  "ga": "Irish",
  "it": "Italian",
  "ja": "Japanese",
  "jw": "Javanese",
  "jv": "Javanese",
  "kn": "Kannada",
  "pam": "Kapampangan",
  "kk": "Kazakh",
  "km": "Khmer",
  "cgg": "Kiga",
  "rw": "Kinyarwanda",
  "ktu": "Kituba",
  "gom": "Konkani",
  "ko": "Korean",
  "kri": "Krio",
  "ku": "Kurdish (Kurmanji)",
  "ckb": "Kurdish (Sorani)",
  "ky": "Kyrgyz",
  "lo": "Lao",
  "ltg": "Latgalian",
  "la": "Latin",
  "lv": "Latvian",
  "lij": "Ligurian",
  "li": "Limburgan",
  "ln": "Lingala",
  "lt": "Lithuanian",
  "lmo": "Lombard",
  "luo": "Luo",
  "lb": "Luxembourgish",
  "mk": "Macedonian",
  "mai": "Maithili",
  "mak": "Makassar",
  "mg": "Malagasy",
  "ms": "Malay",
  "ms-arab": "Malay (Jawi)",
  "ml": "Malayalam",
  "mt": "Maltese",
  "mi": "Maori",
  "mr": "Marathi",
  "chm": "Meadow Mari",
  "mni-mtei": "Meiteilon (Manipuri)",
  "min": "Minang",
  "lus": "Mizo",
  "mn": "Mongolian",
  "my": "Myanmar (Burmese)",
  "nr": "Ndebele (South)",
  "new": "Nepalbhasa (Newari)",
  "ne": "Nepali",
  "nso": "Northern Sotho (Sepedi)",
  "no": "Norwegian",
  "nus": "Nuer",
  "oc": "Occitan",
  "or": "Odia (Oriya)",
  "om": "Oromo",
  "pag": "Pangasinan",
  "pap": "Papiamento",
  "ps": "Pashto",
  "fa": "Persian",
  "pl": "Polish",
  "pt": "Portuguese",
  "pt-pt": "Portuguese (Portugal)",
  "pt-br": "Portuguese (Brazil)",
  "pa": "Punjabi",
  "pa-arab": "Punjabi (Shahmukhi)",
  "qu": "Quechua",
  "rom": "Romani",
  "ro": "Romanian",
  "rn": "Rundi",
  "ru": "Russian",
  "sm": "Samoan",
  "sg": "Sango",
  "sa": "Sanskrit",
  "gd": "Scots Gaelic",
  "sr": "Serbian",
  "st": "Sesotho",
  "crs": "Seychellois Creole",
  "shn": "Shan",
  "sn": "Shona",
  "scn": "Sicilian",
  "szl": "Silesian",
  "sd": "Sindhi",
  "si": "Sinhala (Sinhalese)",
  "sk": "Slovak",
  "sl": "Slovenian",
  "so": "Somali",
  "es": "Spanish",
  "su": "Sundanese",
  "sw": "Swahili",
  "ss": "Swati",
  "sv": "Swedish",
  "tg": "Tajik",
  "ta": "Tamil",
  "tt": "Tatar",
  "te": "Telugu",
  "tet": "Tetum",
  "th": "Thai",
  "ti": "Tigrinya",
  "ts": "Tsonga",
  "tn": "Tswana",
  "tr": "Turkish",
  "tk": "Turkmen",
  "ak": "Twi (Akan)",
  "uk": "Ukrainian",
  "ur": "Urdu",
  "ug": "Uyghur",
  "uz": "Uzbek",
  "vi": "Vietnamese",
  "cy": "Welsh",
  "xh": "Xhosa",
  "yi": "Yiddish",
  "yo": "Yoruba",
  "yua": "Yucatec Maya",
  "zu": "Zulu"
};