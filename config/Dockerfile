FROM python:3.13-slim

# Prevent Python from writing .pyc files and force unbuffered stdout/stderr
# so logs appear immediately in Render's log stream.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so Docker layer caching works —
# dependencies only rebuild when requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Django project (manage.py is at the COPY root,
# matching Render's root-directory = config).
COPY . .

# Collect compressed static assets for WhiteNoise.
# This does NOT need the database — it only walks installed apps
# and the static/ directory.
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Start Daphne (ASGI) on Render's dynamic $PORT.
# Migrations run at container startup because the PostgreSQL
# database is only reachable at runtime, not during image build.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py create_default_admin && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]