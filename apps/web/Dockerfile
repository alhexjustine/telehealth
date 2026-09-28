# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
RUN npm install -g pnpm@12.6.0

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web run build

FROM nginx:alpine AS runtime
# nginx:alpine's own entrypoint (docker-entrypoint.d/20-envsubst-on-templates.sh) renders every
# /etc/nginx/templates/*.template into /etc/nginx/conf.d/ via envsubst before nginx starts,
# substituting only names present in the container's env — see nginx.conf.template's header.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
ENV DNS_RESOLVER=127.0.0.11 \
    API_UPSTREAM_HOST=api \
    API_UPSTREAM_PORT=3000
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
