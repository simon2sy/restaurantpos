"""
Read-only queries for orders.

Selectors encapsulate complex, re-usable reads so views stay thin.
Every query returned here is a lazy QuerySet unless otherwise noted.
"""

from django.db.models import F, Q, Sum

from .models import Order, OrderBatch, OrderItem


# Statuses that count as an "active" / in-progress order.
OPEN_STATUSES = [
    Order.Status.OPEN,
    Order.Status.PREPARING,
    Order.Status.READY,
    Order.Status.SERVED,
]


def _active_orders():
    """All orders that are still in progress (not completed/cancelled)."""
    return (
        Order.objects
        .select_related("table", "cabin", "created_by")
        .filter(status__in=OPEN_STATUSES)
    )


def get_active_orders():
    """All currently active orders, newest first."""
    return _active_orders().order_by("-created_at")


def get_open_table_order(table):
    """The active order currently open on a given table, or None."""
    if table is None:
        return None
    return (
        table.orders
        .filter(status__in=OPEN_STATUSES)
        .order_by("-created_at")
        .select_related("table", "cabin", "created_by")
        .first()
    )


def get_open_cabin_order(cabin):
    """The active order currently open on a given cabin, or None."""
    if cabin is None:
        return None
    return (
        cabin.orders
        .filter(status__in=OPEN_STATUSES)
        .order_by("-created_at")
        .select_related("table", "cabin", "created_by")
        .first()
    )


def get_orders_for_table(table):
    """All orders (active + historical) for a table."""
    return Order.objects.filter(table=table).order_by("-created_at")


def get_orders_for_cabin(cabin):
    """All orders (active + historical) for a cabin."""
    return Order.objects.filter(cabin=cabin).order_by("-created_at")


def get_order_detail(order_id):
    """Fetch a single order with all related data for detail views."""
    return (
        Order.objects
        .select_related("table", "cabin", "created_by")
        .prefetch_related(
            "batches__items__menu_item",
        )
        .filter(id=order_id)
        .first()
    )


def get_kitchen_batches():
    """Batches awaiting/preparing in the kitchen, oldest first."""
    return (
        OrderBatch.objects
        .filter(
            status__in=[
                OrderBatch.Status.PENDING,
                OrderBatch.Status.PREPARING,
            ]
        )
        .select_related("order", "order__table", "order__cabin")
        .prefetch_related("items__menu_item")
        .order_by("created_at")
    )


def get_order_summary_totals():
    """Total item quantity and aggregate line totals per order.

    Returns a dict of {order_id: {total_amount, total_quantity}} built via
    ORM aggregation - avoids Python loops over all order items.
    """
    return {
        row["batch__order_id"]: row
        for row in (
            OrderItem.objects
            .filter(status__in=[
                OrderItem.Status.PENDING,
                OrderItem.Status.PREPARING,
                OrderItem.Status.READY,
                OrderItem.Status.SERVED,
            ])
            .values("batch__order_id")
            .annotate(
                total_amount=Sum(F("quantity") * F("unit_price")),
                total_quantity=Sum("quantity"),
            )
            .order_by("batch__order_id")
        )
    }