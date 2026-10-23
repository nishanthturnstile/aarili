# Renderer runtime verification image, not a deployment or separate service.
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
WORKDIR /workspace
RUN npm install --global pnpm@12.15.0
COPY manifests/ ./
RUN pnpm install --prod --filter @aarili/documents... --frozen-lockfile
RUN node packages/documents/node_modules/playwright-core/cli.js install --with-deps chromium && chmod -R a+rX /ms-playwright
FROM dependencies AS verification-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
FROM dependencies AS runtime
COPY packages/contracts/dist/ ./packages/contracts/dist/
COPY packages/documents/dist/ ./packages/documents/dist/
COPY packages/documents/assets/ ./packages/documents/assets/
USER node
FROM verification-dependencies AS verification
COPY packages/contracts/dist/ ./packages/contracts/dist/
COPY packages/documents/dist/ ./packages/documents/dist/
COPY packages/documents/assets/ ./packages/documents/assets/
COPY packages/documents/test/ ./packages/documents/test/
USER node
ENTRYPOINT ["node","packages/documents/test/runtime.mjs"]
