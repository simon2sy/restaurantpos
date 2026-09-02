"""
check_low_stock — sends push notification when ingredients are below minimum stock.

Run periodically (e.g. every hour) via cron or Render cron job:

    python manage.py check_low_stock

Or triggered on-demand via API:

    POST /api/v1/menu/stock/check-low/
"""

import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_low_stock_items():
    """Get all ingredients at or below minimum stock level."""
    from django.db.models import F
    from menu.models import Ingredient

    return list(
        Ingredient.objects.filter(
            is_active=True,
            current_stock__lte=F("minimum_stock"),
        ).order_by("name")
    )


def format_low_stock_message(items):
    """Format low stock items into a readable notification body."""
    if not items:
        return None

    lines = [f"Low Stock Alert — {len(items)} items below minimum:", ""]

    for item in items:
        status = "OUT OF STOCK" if item.current_stock == 0 else "LOW"
        lines.append(
            f"  {status}: {item.name} — {item.current_stock} {item.unit} "
            f"(min: {item.minimum_stock} {item.unit})"
        )

    lines.append("")
    lines.append("Please restock these items.")

    return "\n".join(lines)


def send_low_stock_alerts(items):
    """Send low stock push notifications to managers."""
    if not items:
        return {"sent": 0, "failed": 0, "items": 0}

    from accounts.models import EmployeeProfile
    from core.push import send_push_to_users
    from django.contrib.auth.models import User

    # Get all managers
    managers = EmployeeProfile.objects.filter(
        role__in=[
            EmployeeProfile.Role.MANAGER,
        ],
        is_active=True,
    ).select_related("user")

    # Get superusers
    superusers = User.objects.filter(is_superuser=True)

    # Combine unique users
    users = list(set([m.user for m in managers] + list(superusers)))

    if not users:
        logger.warning("No managers to send low stock alerts to")
        return {"sent": 0, "failed": 0, "items": len(items)}

    title = f"Low Stock Alert — {len(items)} items"
    body = format_low_stock_message(items)

    result = send_push_to_users(
        users,
        title=title,
        body=body,
        data={"type": "low_stock", "count": len(items)},
        sound=True,  # Low stock needs attention
    )

    result["items"] = len(items)
    return result


class Command(BaseCommand):
    help = "Check for low stock ingredients and send push notification alerts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print low stock items without sending push notifications",
        )

    def handle(self, *args, **options):
        items = get_low_stock_items()

        if not items:
            self.stdout.write(
                self.style.SUCCESS("All ingredients are adequately stocked.")
            )
            return

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("=== LOW STOCK (dry run) ==="))
            self.stdout.write(format_low_stock_message(items))
            return

        result = send_low_stock_alerts(items)

        self.stdout.write(
            self.style.WARNING(
                f"Low stock alert: {result['items']} items, "
                f"{result['sent']} sent, {result['failed']} failed"
            )
        )

        logger.warning(
            "Low stock alert: %d items below threshold, sent=%d failed=%d",
            result["items"],
            result["sent"],
            result["failed"],
        )
