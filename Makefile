build:
	hugo --buildFuture
	npm_config_yes=true npx pagefind --site public
	cp _headers ./public/
	cp robots.txt ./public/
new:
	hugo new post/`date +%Y`/`date +%s`.md
serve:
	hugo server --buildFuture --bind "0.0.0.0"
