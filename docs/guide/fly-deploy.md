# Deploying to Fly.io

This is the brief's optional bonus cloud deployment (see the root `CLAUDE.md`'s "Bonus cloud
deployment"). It reuses the same two Docker images `docker-compose.yml` builds — `apps/api/Dockerfile`
and `apps/web/Dockerfile` — as two separate Fly apps, plus a Fly Postgres cluster. No other managed
service is involved, so the standalone-runtime rule (no external auth/notification/file/AI SaaS)
still holds; Fly is only hosting the same three containers the brief requires, and the consultation
workspace's Jitsi embed is the one documented, prototype-only exception already called out in
`docs/guide/demo.md`.

## Why two apps, not three containers in one

Fly runs each app as its own set of Machines with its own public hostname. To keep the same
same-origin architecture `docker-compose.yml` already has — the browser only ever talks to the web
app's origin, and nginx proxies `/api/` and `/socket.io/` to the API server-side — the web app's
nginx proxies to the API app over Fly's private 6PN network (`<api-app>.internal:3000`) instead of
Docker's embedded DNS (`api:3000`). `apps/web/nginx.conf.template` picks the right target via
`DNS_RESOLVER`/`API_UPSTREAM_HOST`/`API_UPSTREAM_PORT`, rendered at container start by nginx's own
`envsubst`-on-templates entrypoint (see the template's header comment). This means:

- Cookies stay `SameSite=Lax` and same-origin — no CORS, no `SameSite=None`, no code changes to
  `apps/api/src/auth/session/session-cookie.ts` or the origin-check middleware.
- `APP_ORIGINS` on the API just needs the web app's public `https://<name>.fly.dev` origin.

Postgres is a separate managed cluster (Fly Managed Postgres), attached to the API app only.

## One-time setup

```bash
fly auth login                    # interactive browser login — do this yourself
fly orgs list                     # confirm which org to deploy into
```

Pick two globally-unique Fly app names (e.g. `<yourname>-telehealth-api` / `-web`) — Fly app names
are shared across all Fly accounts, so the placeholders in `fly.api.toml`/`fly.web.toml` need to be
replaced with whatever you actually get to register.

```bash
fly apps create <api-app-name> --org <org>
fly apps create <web-app-name> --org <org>
```

Then edit `fly.api.toml` and `fly.web.toml`, replacing every `REPLACE_WITH_*` placeholder with the
real app names (both files cross-reference each other's app name for `APP_ORIGINS` /
`API_UPSTREAM_HOST`).

### Postgres

```bash
fly mpg create --org <org> --name <api-app-name>-db --region sin
fly mpg attach <cluster-id> --app <api-app-name>
```

`attach` sets `DATABASE_URL` as a secret on the API app directly — nothing to copy by hand. Confirm
it went through with `fly secrets list --app <api-app-name>`.

### Remaining secrets

Everything else non-sensitive lives in `fly.api.toml`'s `[env]`; these three don't, because they're
credentials:

```bash
fly secrets set --app <api-app-name> \
  ADMIN_PASSWORD='<a strong password, not the local default>' \
  JITSI_ROOM_SECRET="$(openssl rand -hex 32)"
```

(`DATABASE_URL` was already set by `fly mpg attach` above.)

## Deploy

From the repo root, so the Docker build context matches `docker-compose.yml`'s `context: .`:

```bash
fly deploy --config fly.api.toml --dockerfile apps/api/Dockerfile
fly deploy --config fly.web.toml --dockerfile apps/web/Dockerfile
```

Deploy the API first — its `docker-entrypoint.sh` runs `prisma migrate deploy`, admin provisioning,
and (if `DEMO_DATA=true`) the demo seed on boot, so the database is ready before the web app's
health checks start expecting a working `/api/` proxy target.

## Continuous deployment

`.github/workflows/fly-deploy.yml` redeploys both apps automatically once `CI` finishes
successfully on `main` (`workflow_run`, gated on `conclusion == 'success'`) — it never deploys
code CI hasn't verified. It needs two **app-scoped** deploy tokens as repo secrets (Settings →
Secrets and variables → Actions), one per app so a compromised token can't touch the other app:

```bash
fly tokens create deploy -a <api-app-name> -x 8760h -n github-actions-deploy
fly tokens create deploy -a <web-app-name> -x 8760h -n github-actions-deploy
```

Add the two printed values as `FLY_API_TOKEN_API` and `FLY_API_TOKEN_WEB`. `-x 8760h` sets a
1-year expiry (flyctl's default is 20 years) — plan to rotate before then by re-running the command
above and updating the secret.

## Verifying

```bash
fly status --app <api-app-name>
fly status --app <web-app-name>
curl -s https://<api-app-name>.fly.dev/api/health
open https://<web-app-name>.fly.dev
```

Sign in as the pre-provisioned admin (`ADMIN_EMAIL` / the `ADMIN_PASSWORD` secret you set above), or
— if `DEMO_DATA=true` — any of the seeded demo accounts from `docs/guide/demo.md`.

## Notes

- `min_machines_running = 1` and `auto_stop_machines = "off"` on both apps: this app uses
  Socket.IO for realtime notifications and the consultation workspace, so scale-to-zero would drop
  live connections and add cold-start latency mid-demo. Fine to flip back on for a cluster that
  sits idle between demos — Fly's hobby allowance covers a couple of always-on `shared-cpu-1x`
  Machines at these memory sizes.
- `DEMO_DATA=true` re-seeds are idempotent (`seed-demo.js` no-ops if the dataset already exists),
  so redeploys are safe.
- To reset or restage the deployed demo dataset the same way `pnpm demo:reset`/`pnpm demo:live` do
  locally: `fly ssh console --app <api-app-name> -C "node dist/scripts/seed-demo.js --reset"` (or
  `--live-consultation`).
- Custom domains, if wanted later, go through `fly certs add` on the web app only — the API stays
  reachable at its `.fly.dev` hostname since nothing external calls it directly.
