if test -z "$(which go)"; then
  asdf plugin add golang
  asdf install golang 1.19.3
  asdf global golang 1.19.3
fi

cd
git clone https://github.com/caddyserver/caddy
cd caddy/cmd/caddy

go build

sudo setcap cap_net_bind_service=+ep ~/caddy/cmd/caddy/caddy
ln -s -f ~/caddy/cmd/caddy/caddy ~/.local/bin/caddy

