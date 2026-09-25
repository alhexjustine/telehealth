#!/bin/sh
set -e

./node_modules/.bin/prisma migrate deploy
node dist/scripts/provision-admin.js

# Only an explicit "true" loads the fictional demo dataset (see env.schema.ts) — anything else
# (unset, "false", a typo) means no seeding, so a deploy with a real database never seeds by
# accident. Idempotent: seed-demo.js itself no-ops when the demo dataset is already present.
if [ "$DEMO_DATA" = "true" ]; then
  node dist/scripts/seed-demo.js
fi

exec "$@"
