#!/usr/bin/env bash
# build.sh — Railway/Railpack build step (run from the REPO ROOT).
# The Django project (manage.py, settings, Procfile) lives in ./config,
# so delegate there. Dependency installation is already done by Railpack
# (pip install -r requirements.txt) before this script runs.
set -o errexit

cd "$(dirname "$0")/config"

# Collect compressed static assets for WhiteNoise.
# Safe at build time — does not require a database connection.
python manage.py collectstatic --noinput

# NOTE: Database migrations intentionally omitted here.
# The database is not reachable during the build phase; migrations run
# at container startup (migrate --noinput) before daphne starts.
