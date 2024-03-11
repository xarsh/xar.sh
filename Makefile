build:
	hugo --buildFuture
	npx pagefind --site public
	cp _headers ./public/
	cp robots.txt ./public/
new:
	hugo new post/`date +%Y`/`date +%s`.md
serve:
	hugo server --buildFuture --bind "0.0.0.0"
download:
	deno run --allow-net --allow-read --allow-run --allow-env --allow-write script/download.js
