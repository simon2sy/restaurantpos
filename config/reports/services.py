"""Sales reporting and analytics — computed with ORM aggregation."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.utils import timezone

from orders.models import Order, OrderItem


def _order_base(start=None, end=None):
    qs = Order.objects.all()
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lte=end)
    return qs


def _day_bounds(offset_days=0):
    now = timezone.localtime()
    day = now - timedelta(days=offset_days)
    start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def _week_bounds(offset_weeks=0):
    now = timezone.localtime()
    start = now.replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - timedelta(days=(now.weekday() + 7 * offset_weeks))
    end = start + timedelta(weeks=1)
    return start, end


def _month_bounds(offset_months=0):
    now = timezone.localtime()
    year = now.year
    month = now.month - offset_months
    while month <= 0:
        month += 12
        year -= 1
    start = timezone.make_aware(
        now.replace(
            year=year, month=month, day=1,
            hour=0, minute=0, second=0, microsecond=0,
        )
    )
    if month == 12:
        end_year, end_month = year + 1, 1
    else:
        end_year, end_month = year, month + 1
    end = timezone.make_aware(
        now.replace(
            year=end_year, month=end_month, day=1,
            hour=0, minute=0, second=0, microsecond=0,
        )
    )
    return start, end


def daily_sales(date=None):
    """Aggregates for a single (default: today's) local day."""
    start, end = _day_bounds()
    qs = _order_base(start, end)

    paid = qs.filter(payment_status=Order.PaymentStatus.PAID)

    paid_orders = paid.count()
    total_sales = paid.aggregate(v=Sum("total"))["v"] or 0
    subtotal_agg = paid.aggregate(v=Sum("subtotal"))["v"] or 0
    discount_agg = paid.aggregate(v=Sum("discount"))["v"] or 0
    delivery_fee_agg = paid.aggregate(v=Sum("delivery_fee"))["v"] or 0

    cash = paid.filter(
        payment_method=Order.PaymentMethod.CASH
    ).aggregate(v=Sum("total"))["v"] or 0
    cod = paid.filter(
        payment_method=Order.PaymentMethod.COD
    ).aggregate(v=Sum("total"))["v"] or 0

    dine_in = paid.filter(
        order_type=Order.OrderType.DINE_IN
    ).count()
    delivery = paid.filter(
        order_type=Order.OrderType.DELIVERY
    ).count()

    total_orders = qs.count()
    unpaid = qs.filter(
        payment_status=Order.PaymentStatus.UNPAID
    ).count()

    avg = (
        total_sales / paid_orders
        if paid_orders else 0
    )

    return {
        "start": start,
        "end": end,
        "total_sales": Decimal(total_sales),
        "subtotal": Decimal(subtotal_agg),
        "discounts": Decimal(discount_agg),
        "delivery_fees": Decimal(delivery_fee_agg),
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "unpaid_orders": unpaid,
        "cash": Decimal(cash),
        "cod": Decimal(cod),
        "dine_in_orders": dine_in,
        "delivery_orders": delivery,
        "average_order_value": avg,
    }


def get_top_selling_items(limit=10, days=7):
    """Top selling menu items by quantity over the last N days."""
    start, _ = _day_bounds(days - 1)
    return (
        OrderItem.objects
        .filter(
            batch__order__created_at__gte=start,
            batch__order__payment_status=Order.PaymentStatus.PAID,
        )
        .values("menu_item__name")
        .annotate(quantity=Sum("quantity"))
        .order_by("-quantity")[:limit]
    )


def get_lowest_selling_items(limit=5, days=30):
    """Least selling items (have sales) over the last N days."""
    start, _ = _day_bounds(days - 1)
    return (
        OrderItem.objects
        .filter(
            batch__order__created_at__gte=start,
            batch__order__payment_status=Order.PaymentStatus.PAID,
        )
        .values("menu_item__name")
        .annotate(quantity=Sum("quantity"))
        .order_by("quantity")[:limit]
    )


def sales_series(start, end, bucket="day"):
    """Aggregate paid sales bucketed by day/week/month within [start, end]."""
    trunc = {
        "day": TruncDate,
        "week": TruncWeek,
        "month": TruncMonth,
    }[bucket]

    rows = (
        _order_base(start, end)
        .filter(payment_status=Order.PaymentStatus.PAID)
        .annotate(bucket=trunc("created_at"))
        .values("bucket")
        .annotate(sales=Sum("total"), count=Count("id"))
        .order_by("bucket")
    )

    result = []
    for row in rows:
        result.append(
            {
                "bucket": row["bucket"],
                "sales": Decimal(row["sales"]),
                "count": row["count"],
            }
        )
    return result


def payment_method_breakdown(start=None, end=None):
    return (
        _order_base(start, end)
        .filter(payment_status=Order.PaymentStatus.PAID)
        .values("payment_method")
        .annotate(total=Sum("total"))
        .order_by()
    )


def order_type_breakdown(start=None, end=None):
    return (
        _order_base(start, end)
        .filter(payment_status=Order.PaymentStatus.PAID)
        .values("order_type")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by()
    )