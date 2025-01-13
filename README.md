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

## Set envs
```sh
# set creds in `.mise.toml` and run:
mise set
```

## Generate image urls

```sh
mise install deno
mise use deno
deno run -A script/download.js
```

## Find 404 links

```sh
wget --spider -o ~/example.com.log -e robots=off -w 1 -r -p http://localhost:1313/
```
