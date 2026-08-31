from datetime import datetime, timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.shortcuts import render
from django.utils import timezone

from core.permissions import MANAGEMENT_ROLES, require_role
from orders.models import Order, OrderItem


PAID = Order.PaymentStatus.PAID

# Presets shown as quick-filter buttons.
PERIODS = [
    ("today", "Today"),
    ("yesterday", "Yesterday"),
    ("7", "Last 7 days"),
    ("30", "Last 30 days"),
    ("month", "This month"),
    ("all", "All time"),
]

DAILY_CHART_MAX_DAYS = 62


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _resolve_range(request):
    """Turn GET params into a date range + label for filtering."""
    now = timezone.localtime()
    today = now.date()
    period = request.GET.get("period", "today")
    from_d = _parse_date(request.GET.get("from"))
    to_d = _parse_date(request.GET.get("to"))

    def aware(d):
        return timezone.make_aware(datetime.combine(d, datetime.min.time()))

    def aware_end(d):
        return timezone.make_aware(datetime.combine(d, datetime.max.time()))

    # Explicit custom range wins when both dates are valid.
    if from_d and to_d:
        if from_d > to_d:
            from_d, to_d = to_d, from_d
        return (
            aware(from_d), aware_end(to_d),
            f"{from_d.strftime('%d %b %Y')} — {to_d.strftime('%d %b %Y')}",
            "custom", from_d, to_d,
        )

    if period == "custom":
        target = from_d or to_d
        if target:
            return (
                aware(target), aware_end(target),
                target.strftime("%d %b %Y"),
                "custom", target, target,
            )
        period = "today"

    if period == "yesterday":
        day = today - timedelta(days=1)
        return (
            aware(day), aware_end(day),
            f"Yesterday ({day.strftime('%d %b %Y')})",
            "yesterday", day, day,
        )

    if period == "7":
        start = today - timedelta(days=6)
        return (
            aware(start), aware_end(today), "Last 7 days",
            "7", start, today,
        )

    if period == "30":
        start = today - timedelta(days=29)
        return (
            aware(start), aware_end(today), "Last 30 days",
            "30", start, today,
        )

    if period == "all":
        return None, None, "All time", "all", None, None

    if period == "month":
        start = today.replace(day=1)
        return (
            aware(start), aware_end(today),
            f"This month ({now.strftime('%B %Y')})",
            "month", start, today,
        )

    # default: today
    return (
        aware(today), aware_end(today),
        f"Today ({today.strftime('%d %b %Y')})",
        "today", today, today,
    )


@login_required
def report_dashboard(request):
    """Sales overview with date filtering: daily/monthly revenue,
    payment-method split and category performance."""
    require_role(request.user, *MANAGEMENT_ROLES)

    start_dt, end_dt, range_label, period, from_d, to_d = _resolve_range(request)

    paid_orders = Order.objects.filter(payment_status=PAID).exclude(
        status=Order.Status.CANCELLED,
    )
    if start_dt:
        paid_orders = paid_orders.filter(created_at__gte=start_dt)
    if end_dt:
        paid_orders = paid_orders.filter(created_at__lte=end_dt)

    # ── SUMMARY ──
    summary = paid_orders.aggregate(
        total_revenue=Sum("total"),
        total_orders=Count("id"),
    )
    summary["avg_order"] = (
        summary["total_revenue"] / summary["total_orders"]
        if summary["total_orders"]
        else 0
    )

    unpaid_stats = Order.objects.filter(
        payment_status=Order.PaymentStatus.UNPAID,
    ).exclude(status=Order.Status.CANCELLED).aggregate(
        count=Count("id"), amount=Sum("total"),
    )

    # ── PAYMENT METHOD SPLIT ──
    by_method = (
        paid_orders.values("payment_method")
        .annotate(revenue=Sum("total"), orders=Count("id"))
        .order_by("-revenue")
    )

    # ── DAILY BREAKDOWN inside the range (capped) ──
    span_days = (to_d - from_d).days + 1 if (from_d and to_d) else None
    show_daily = bool(start_dt) and (
        span_days is None or span_days <= DAILY_CHART_MAX_DAYS
    )

    days = []
    max_daily = 0
    if show_daily:
        daily_map = {
            r["day"]: r
            for r in (
                paid_orders.annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(revenue=Sum("total"), orders=Count("id"))
            )
        }
        day_cursor = from_d
        end_day = to_d
        while day_cursor <= end_day:
            entry = daily_map.get(day_cursor)
            revenue = entry["revenue"] if entry else 0
            max_daily = max(max_daily, revenue or 0)
            days.append({
                "day": day_cursor,
                "revenue": revenue,
                "orders": entry["orders"] if entry else 0,
            })
            day_cursor += timedelta(days=1)

    # ── MONTHLY BREAKDOWN ──
    monthly = (
        paid_orders.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(revenue=Sum("total"), orders=Count("id"))
        .order_by("-month")[:12]
    )
    max_monthly = max((m["revenue"] or 0 for m in monthly), default=0)

    # ── CATEGORY PERFORMANCE ──
    cat_items = OrderItem.objects.filter(batch__order__payment_status=PAID)
    if start_dt:
        cat_items = cat_items.filter(batch__order__created_at__gte=start_dt)
    if end_dt:
        cat_items = cat_items.filter(batch__order__created_at__lte=end_dt)

    by_category = (
        cat_items.exclude(batch__order__status=Order.Status.CANCELLED)
        .values("menu_item__category__name")
        .annotate(
            revenue=Sum(F("unit_price") * F("quantity")),
            items_sold=Sum("quantity"),
        )
        .order_by("-revenue")
    )
    max_category = max((c["revenue"] or 0 for c in by_category), default=0)

    # ── TOP SELLING ITEMS ──
    top_items = (
        cat_items.values("menu_item__name")
        .annotate(
            revenue=Sum(F("unit_price") * F("quantity")),
            items_sold=Sum("quantity"),
        )
        .order_by("-revenue")[:8]
    )
    max_top_item = max((t["revenue"] or 0 for t in top_items), default=0)

    # ── DETAILED LIST (latest 50 in range) ──
    detailed_orders = (
        paid_orders
        .select_related("table", "cabin", "delivery", "created_by")
        .prefetch_related("batches__items__menu_item")
        .order_by("-paid_at", "-created_at")[:50]
    )

    context = {
        "summary": summary,
        "unpaid_stats": unpaid_stats,
        "by_method": by_method,
        "days": days,
        "max_daily": max_daily,
        "show_daily": show_daily,
        "monthly": monthly,
        "max_monthly": max_monthly,
        "by_category": by_category,
        "max_category": max_category,
        "top_items": top_items,
        "max_top_item": max_top_item,
        "detailed_orders": detailed_orders,
        "range_label": range_label,
        "period": period,
        "periods": PERIODS,
        "filter_from": from_d.strftime("%Y-%m-%d") if from_d else "",
        "filter_to": to_d.strftime("%Y-%m-%d") if to_d else "",
    }
    return render(request, "reports/dashboard.html", context)
