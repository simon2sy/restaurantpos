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


def get_low_stock_items(restaurant):
    """Get all ingredients at or below minimum stock level for ONE restaurant.

    SECURITY: ``restaurant`` is REQUIRED — data is never aggregated across
    restaurants.
    """
    from django.db.models import F
    from menu.models import Ingredient

    return list(
        Ingredient.objects.filter(
            restaurant=restaurant,
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


def send_low_stock_alerts(restaurant, items):
    """Send low stock push notifications to the managers of ONE restaurant.

    SECURITY: Only managers belonging to ``restaurant`` receive the alert.
    """
    if not items or restaurant is None:
        return {"sent": 0, "failed": 0, "items": 0}

    from accounts.models import EmployeeProfile
    from core.push import send_push_to_users

    # Managers for this specific restaurant only
    managers = EmployeeProfile.objects.filter(
        restaurant=restaurant,
        role__in=[
            EmployeeProfile.Role.MANAGER,
        ],
        is_active=True,
    ).select_related("user")

    users = [m.user for m in managers]

    if not users:
        logger.warning("No managers to send low stock alerts to for restaurant %s", restaurant.name)
        return {"sent": 0, "failed": 0, "items": len(items)}

    title = f"{restaurant.name} — Low Stock Alert ({len(items)} items)"
    body = format_low_stock_message(items)

    result = send_push_to_users(
        users,
        title=title,
        body=body,
        data={"type": "low_stock", "count": len(items), "restaurant_id": restaurant.id},
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
        from core.models import Restaurant

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("=== LOW STOCK (dry run) ==="))
            for restaurant in Restaurant.objects.filter(is_active=True):
                items = get_low_stock_items(restaurant)
                if not items:
                    self.stdout.write(
                        f"{restaurant.name}: All ingredients adequately stocked."
                    )
                else:
                    self.stdout.write(self.style.WARNING(f"--- {restaurant.name} ---"))
                    self.stdout.write(format_low_stock_message(items))
            return

        total_sent = 0
        total_failed = 0
        total_items = 0
        for restaurant in Restaurant.objects.filter(is_active=True):
            items = get_low_stock_items(restaurant)
            if not items:
                continue
            result = send_low_stock_alerts(restaurant, items)
            total_sent += result.get("sent", 0)
            total_failed += result.get("failed", 0)
            total_items += result.get("items", 0)

        self.stdout.write(
            self.style.WARNING(
                f"Low stock alert: {total_items} items, "
                f"{total_sent} sent, {total_failed} failed"
            )
        )

        logger.warning(
            "Low stock alert: %d items below threshold, sent=%d failed=%d",
            total_items,
            total_sent,
            total_failed,
        )
