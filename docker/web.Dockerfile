# syntax=docker/dockerfile:1

# ---- Build della SPA con Vite ----
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline \
 && pnpm --filter @git-wrapped/web build

# ---- Runtime: Caddy ufficiale (alpine), non root, porta 8080 ----
FROM caddy:2-alpine AS runtime
# Il binario dell'immagine ha la file capability cap_net_bind_service: con `cap_drop: [ALL]`
# l'exec fallisce ("operation not permitted"). Qui si ascolta su 8080, quindi la si toglie
# ricreando il file (cp di busybox non copia gli attributi estesi).
RUN cp /usr/bin/caddy /tmp/caddy && mv /tmp/caddy /usr/bin/caddy && chmod 755 /usr/bin/caddy
# Caddy scrive config/stato in XDG_*: puntati a /tmp (tmpfs con read_only).
ENV XDG_DATA_HOME=/tmp/caddy-data XDG_CONFIG_HOME=/tmp/caddy-config
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=1000:1000 /repo/apps/web/dist/ /srv/
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
