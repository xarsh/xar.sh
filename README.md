# xar.sh source

<https://xar.sh/>

Built with [Hugo](http://gohugo.io/),
Served from [CloudFlare Pages](https://pages.cloudflare.com/).
Deploy automatically by `git push`.

```sh
# creates new article
$ make new
$ make serve
```

## Generate image urls

```sh
deno run -A script/download.js
```

## Find 404 links

```sh
wget --spider -o ~/example.com.log -e robots=off -w 1 -r -p http://localhost:1313/
```
