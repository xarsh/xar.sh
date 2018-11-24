build:
	hugo
deploy: build
	surge --project ./public --domain https://xar.sh
new:
	hugo new post/`date +%Y`/`date +%s`.md