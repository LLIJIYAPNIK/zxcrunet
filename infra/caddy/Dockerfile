# Caddy with the Cloudflare DNS plugin: the wildcard certificate for *.zxc.ru.net
# is obtained through a DNS-01 challenge.
FROM caddy:2.10.2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10.2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
