build:
	hugo
new:
	hugo new post/`date +%Y`/`date +%s`.md
serve:
	hugo server