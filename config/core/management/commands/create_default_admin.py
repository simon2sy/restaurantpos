"""create_default_admin — idempotent command that creates a default
superuser when the database has none.

Run after migrations on first deploy so the admin can always log in.

Environment variables (all optional):
    ADMIN_USERNAME   (default: restaurant)
    ADMIN_PASSWORD   (default: Admin@123)
    ADMIN_EMAIL      (default: admin@restaurant.com)
"""

import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a default superuser if none exists."

    def handle(self, *args, **options):
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(self.style.NOTICE(
                "Superuser already exists — skipping."
            ))
            return

        username = os.environ.get("ADMIN_USERNAME", "restaurant")
        password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
        email = os.environ.get("ADMIN_EMAIL", "admin@restaurant.com")

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )

        self.stdout.write(self.style.SUCCESS(
            f"Default superuser created: {username}"
        ))
