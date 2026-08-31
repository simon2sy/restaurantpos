#!/usr/bin/env bash
# build.sh — Render native-build command (NOT used in Docker path).
# This file lives next to manage.py (the Django project root).
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Collect compressed static assets for WhiteNoise.
# Safe at build time — does not require a database connection.
python manage.py collectstatic --noinput

# NOTE: Database migrations intentionally omitted here.
# Render's PostgreSQL instance is NOT reachable during the build
# phase, so migrate would fail. Migrations run at container
# startup via the Procfile instead.
