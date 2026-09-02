"""
daily_sales_summary — sends end-of-day sales summary via push notification.

Run daily at closing time (e.g. 11 PM) via cron or Render cron job.

    python manage.py daily_sales_summary

Or triggered on-demand via API:

    POST /api/v1/reports/daily-summary/trigger/
"""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

logger = logging.getLogger(__name__)


def build_summary_data():
    """Build the daily sales summary from today's data."""
    now = timezone.localtime()
    today = now.date()
    today_start = timezone.make_aware(
        timezone.datetime.combine(today, timezone.datetime.min.time())
    )
    today_end = timezone.make_aware(
        timezone.datetime.combine(today, timezone.datetime.max.time())
    )

    from orders.models import Order

    paid_today = Order.objects.filter(
        payment_status=Order.PaymentStatus.PAID,
        paid_at__date=today,
    ).exclude(status=Order.Status.CANCELLED)

    summary = paid_today.aggregate(
        total_revenue=Sum("total"),
        total_orders=Count("id"),
    )

    total_revenue = summary["total_revenue"] or 0
    total_orders = summary["total_orders"] or 0
    avg_order = total_revenue / total_orders if total_orders else 0

    # Payment method breakdown
    by_method = list(
        paid_today.values("payment_method")
        .annotate(revenue=Sum("total"), orders=Count("id"))
        .order_by("-revenue")
    )

    # Top items
    from orders.models import OrderItem

    top_items = list(
        OrderItem.objects.filter(
            batch__order__payment_status=Order.PaymentStatus.PAID,
            batch__order__paid_at__date=today,
        )
        .values("menu_item__name")
        .annotate(
            revenue=Sum("unit_price") * Sum("quantity"),
            items_sold=Sum("quantity"),
        )
        .order_by("-revenue")[:5]
    )

    # Unpaid orders
    unpaid_count = Order.objects.filter(
        payment_status=Order.PaymentStatus.UNPAID,
    ).exclude(status=Order.Status.CANCELLED).count()

    return {
        "date": str(today),
        "total_revenue": str(total_revenue),
        "total_orders": total_orders,
        "avg_order": str(round(avg_order, 2)),
        "by_method": by_method,
        "top_items": top_items,
        "unpaid_count": unpaid_count,
    }


def format_summary_message(data):
    """Format the summary into a readable push notification body."""
    date = data["date"]
    revenue = data["total_revenue"]
    orders = data["total_orders"]
    avg = data["avg_order"]
    unpaid = data["unpaid_count"]

    lines = [
        f"Daily Summary — {date}",
        "",
        f"Revenue: Rs. {revenue}",
        f"Orders: {orders}",
        f"Avg Order: Rs. {avg}",
    ]

    if unpaid > 0:
        lines.append(f"Unpaid: {unpaid}")

    if data["top_items"]:
        lines.append("")
        lines.append("Top Items:")
        for i, item in enumerate(data["top_items"][:3], 1):
            lines.append(f"  {i}. {item['menu_item__name']} — Rs. {item['revenue']}")

    return "\n".join(lines)


def send_summary_to_managers(data):
    """Send the daily summary push notification to all managers and superusers."""
    from accounts.models import EmployeeProfile
    from core.push import send_push_to_users

    # Get all managers
    managers = EmployeeProfile.objects.filter(
        role__in=[EmployeeProfile.Role.MANAGER],
        is_active=True,
    ).select_related("user")

    # Get superusers
    from django.contrib.auth.models import User

    superusers = User.objects.filter(is_superuser=True)

    # Combine
    users = list(set([m.user for m in managers] + list(superusers)))

    if not users:
        logger.warning("No managers or superusers to send daily summary to")
        return {"sent": 0, "failed": 0}

    title = f"Daily Summary — {data['date']}"
    body = format_summary_message(data)

    return send_push_to_users(
        users,
        title=title,
        body=body,
        data={"type": "daily_summary", "date": data["date"]},
        sound=False,  # Summary doesn't need sound
    )


class Command(BaseCommand):
    help = "Send end-of-day sales summary via push notification"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print summary without sending push notifications",
        )

    def handle(self, *args, **options):
        data = build_summary_data()

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS("=== DAILY SUMMARY (dry run) ==="))
            self.stdout.write(format_summary_message(data))
            return

        result = send_summary_to_managers(data)

        self.stdout.write(
            self.style.SUCCESS(
                f"Daily summary sent: {result['sent']} sent, {result['failed']} failed"
            )
        )

        # Also log to database for audit
        logger.info(
            "Daily summary: %s sent=%d failed=%d",
            data["date"],
            result["sent"],
            result["failed"],
        )
