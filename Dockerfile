# syntax=docker/dockerfile:1
# Greenfield single-image build: Fastify backend + Next front door + CRA static,
# run together by pm2. NPM routes /graphql,/api,/messenger -> backend:5005;
# everything else -> Next:8200. See docs/superpowers/plans/2026-08-28-greenfield-single-image-cutover.md
ARG NODE_VERSION=24.15.0

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /src
# install deps first (layer-cached unless a package.json changes)
COPY backend/package*.json backend/
RUN cd backend && npm ci
COPY frontend/webapp/package*.json frontend/webapp/
RUN cd frontend/webapp && npm ci
COPY frontend/next/package*.json frontend/next/
RUN cd frontend/next && npm ci
# sources
COPY . .
# browser/build-time config (baked into the CRA + Next bundles)
ARG REACT_APP_CLICKY_SITE_ID
ARG REACT_APP_CLICKY_JS_PATH
ARG CLICKY_JS_PATH
ARG CLICKY_BEACON_PATH
ENV REACT_APP_CLICKY_SITE_ID=$REACT_APP_CLICKY_SITE_ID \
    REACT_APP_CLICKY_JS_PATH=$REACT_APP_CLICKY_JS_PATH \
    CLICKY_JS_PATH=$CLICKY_JS_PATH \
    CLICKY_BEACON_PATH=$CLICKY_BEACON_PATH
RUN cd backend && npm run build
RUN cd frontend/webapp && npm run build
RUN cd frontend/next && npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
RUN npm i -g pm2 serve
COPY --from=build /src/backend/dist ./backend/dist
COPY --from=build /src/backend/schema ./backend/dist/schema
COPY --from=build /src/backend/node_modules ./backend/node_modules
COPY --from=build /src/backend/package*.json ./backend/
# Operational .mjs scripts (one-off migrations/ingests run via `docker exec`).
COPY --from=build /src/backend/scripts ./backend/scripts
COPY --from=build /src/frontend/next/.next ./frontend/next/.next
COPY --from=build /src/frontend/next/node_modules ./frontend/next/node_modules
COPY --from=build /src/frontend/next/package*.json ./frontend/next/
COPY --from=build /src/frontend/next/public ./frontend/next/public
COPY --from=build /src/frontend/next/config ./frontend/next/config
COPY --from=build /src/frontend/webapp/build ./frontend/webapp/build
COPY ops/container ./ops/container
COPY ecosystem.config.cjs ./
EXPOSE 8200 8201 5005
HEALTHCHECK --interval=15s --timeout=10s --start-period=45s --retries=3 \
  CMD ["node", "/app/ops/container/healthcheck.mjs"]
CMD ["pm2-runtime", "ecosystem.config.cjs"]
