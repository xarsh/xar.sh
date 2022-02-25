build:
	hugo --buildFuture
	cp _headers ./public/
new:
	hugo new post/`date +%Y`/`date +%s`.md
serve:
	hugo server --buildFuture --bind "0.0.0.0"
