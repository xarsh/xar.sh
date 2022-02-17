build:
	hugo --buildFuture
build_and_invoke_google_crawling: build
	curl https://www.google.com/ping?sitemap=https://xar.sh/post/index.xml
new:
	hugo new post/`date +%Y`/`date +%s`.md
serve:
	hugo server --buildFuture --bind "0.0.0.0"
