# syntax=docker/dockerfile:1

# ---- Build: Node 22 + pnpm (versione presa da "packageManager") ----
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# 1) Solo lockfile e workspace: lo strato di "pnpm fetch" si riusa finche' le dipendenze non cambiano.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

# 2) Sorgenti, installazione offline dallo store e build del bundle esbuild.
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline \
 && pnpm --filter @git-wrapped/api build

# ---- Runtime: solo il bundle (esbuild include gia' le dipendenze) ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=1000:1000 /repo/apps/api/dist/ ./dist/
USER 1000:1000
EXPOSE 3000
# Compatibile con read_only: true + tmpfs su /tmp. Nessuna scrittura altrove.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
