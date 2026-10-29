# syntax=docker/dockerfile:1
# Immagine per `make test`: unit test + Playwright. La versione DEVE coincidere con
# @playwright/test nel lockfile (browser preinstallati nell'immagine ufficiale).
FROM mcr.microsoft.com/playwright:v1.64.1-noble
ENV PNPM_HOME=/pnpm CI=true
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
CMD ["sh", "-c", "pnpm test && pnpm e2e"]
