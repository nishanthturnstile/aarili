# Renderer runtime verification image, not a deployment or separate service.
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
WORKDIR /workspace
RUN npm install --global pnpm@12.11.2
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
