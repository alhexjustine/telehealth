-- Local-dev-only Postgres (docker-compose.dev.yml): creates a second
-- database so e2e tests run against real Postgres without touching the
-- interactive dev database.
CREATE DATABASE telehealth_test;
