import json, os
import urllib.request, requests, mimetypes
from lxml import html

def read_url_safe(url):
	try:
		f = urllib.request.urlopen(url, timeout=60)
		data = f.read()
		f.close()
		return data
	except urllib.error.URLError as e:
		reason = e.reason if hasattr(e, 'reason') else '???'
		print("Failed to open url due to %s" % reason)
	except http.client.IncompleteRead as e:
		print("Failed to open url due to IncompleteRead")
	except socket.timeout as e:
		print("Failed to open url due to timeout")

def download_map_image(mapname, outpath):
	if os.path.exists(outpath):
		return
	
	domain_name = 'http://scmapdb.wikidot.com'
	page_contents = ''
	try:
		page_contents = read_url_safe("%s/map:%s" % (domain_name, mapname))
	except urllib.error.HTTPError as e:
		print(e)
		return []
	
	dom = html.fromstring(page_contents)
	links = dom.cssselect('#page-content div.dl a')
	
	# download the thumbnail
	thumb = dom.cssselect(".gallery-box .gallery-item img")
	
	if len(thumb) == 0:
		print("Page has no images: %s" % mapname)
	else:
		thumb = thumb[0]
		file_contents = ''
		try:
			print("Download map image: %s" % outpath)
			file_contents = read_url_safe(thumb.attrib['src'])
		except urllib.error.HTTPError as e:
			print(e)
			return []
			
		if not os.path.exists(os.path.dirname(outpath)):
			os.makedirs(os.path.dirname(outpath))
			
		c = open(outpath, 'wb')
		c.write(file_contents)
		c.close()

json_dat = {}
mapcycle = []
manual_links = {}

with open('pool.json') as f:
	json_dat = json.loads(f.read())
	
with open("mapcycle.txt") as f:
	mapcycle = f.read().splitlines()
	
with open("manual_links.txt") as f:
	lines = f.read().splitlines()
	for line in lines:
		parts = line.split("=")
		manual_links[parts[0].strip()] = parts[1].strip()

maps_dir = json_dat["maps"]
maps_dir = {key.lower(): value for key, value in maps_dir.items()}
mapdb = []

for line in mapcycle:
	maps = line.split()
	bsp = maps[0] + ".bsp"
	
	if bsp in maps_dir:
		refs = maps_dir[bsp]["refs"]
		
		if len(refs) > 1:
			print("%s matches multiple maps! %s" % (bsp, refs))
		elif len(refs) == 1:
			item = {
				"maps": maps,
				"link": refs[0][1:] # skip first dash
			}
			mapdb.append(item)
		else:
			print("No link found for %s" % bsp)
	elif maps[0] in manual_links:
		item = {
			"maps": maps,
			"link": manual_links[maps[0]] # skip first dash
		}
		mapdb.append(item)
	else:
		print("No link found for %s" % bsp)

for item in mapdb:
	download_map_image(item["link"], os.path.join("img", item["maps"][0] + ".jpg"))

with open("mapdb.json", 'w') as outfile:
	json.dump(mapdb, outfile)
