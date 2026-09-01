from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import (
    Cabin,
    Order,
    OrderBatch,
    OrderItem,
    Table,
)

from kitchen.services import notify_kitchen


# ============================================================
# CREATE ORDER
# ============================================================

@transaction.atomic
def create_order(
    *,
    user,
    table=None,
    cabin=None,
    order_type=Order.OrderType.DINE_IN,
):

    # ========================================================
    # DELIVERY
    # ========================================================

    if order_type == Order.OrderType.DELIVERY:

        # Delivery orders cannot have seating
        if table is not None or cabin is not None:
            raise ValueError(
                "A delivery order cannot have a table or cabin."
            )

    # ========================================================
    # DINE IN
    # ========================================================

    elif order_type == Order.OrderType.DINE_IN:

        if table is not None and cabin is not None:
            raise ValueError(
                "An order cannot have both table and cabin."
            )

        if table is None and cabin is None:
            raise ValueError(
                "A dine-in order requires a table or cabin."
            )

        # ----------------------------------------------------
        # TABLE
        # ----------------------------------------------------

        if table is not None:

            # Lock the row for the duration of the transaction to prevent
            # two concurrent orders from claiming the same table.
            table = (
                Table.objects
                .select_for_update()
                .get(pk=table.pk)
            )

            if table.status != Table.Status.AVAILABLE:
                raise ValueError(
                    "Table is not available."
                )

            table.status = Table.Status.OCCUPIED

            table.save(
                update_fields=["status"]
            )

        # ----------------------------------------------------
        # CABIN
        # ----------------------------------------------------

        if cabin is not None:

            # Lock the row for the duration of the transaction to prevent
            # two concurrent orders from claiming the same cabin.
            cabin = (
                Cabin.objects
                .select_for_update()
                .get(pk=cabin.pk)
            )

            if cabin.status != Cabin.Status.AVAILABLE:
                raise ValueError(
                    "Cabin is not available."
                )

            cabin.status = Cabin.Status.OCCUPIED

            cabin.save(
                update_fields=["status"]
            )

    # ========================================================
    # INVALID TYPE
    # ========================================================

    else:

        raise ValueError(
            "Invalid order type."
        )

    # ========================================================
    # CREATE ORDER
    # ========================================================

    order = Order.objects.create(
        order_type=order_type,
        table=table,
        cabin=cabin,
        created_by=user,
    )

    return order
# ============================================================
# CREATE ORDER BATCH
# ============================================================

@transaction.atomic
def create_order_batch(
    *,
    order,
    items,
):
    """
    Creates a new batch of food items for an order.

    This is used both when:
        1. Creating the first order
        2. Adding more food later
    """

    last_batch = (
        order.batches
        .order_by("-batch_number")
        .first()
    )

    batch_number = (
        last_batch.batch_number + 1
        if last_batch
        else 1
    )

    batch = OrderBatch.objects.create(
        order=order,
        batch_number=batch_number,
    )

    # --------------------------------------------------------
    # CREATE ORDER ITEMS
    # --------------------------------------------------------

    for item in items:

        menu_item = item["menu_item"]

        quantity = item["quantity"]

        notes = item.get(
            "notes",
            "",
        )

        # Guard against non-positive quantities.
        if quantity is None or quantity < 1:
            raise ValueError(
                "Quantity must be at least 1."
            )

        # Make sure food is still available
        if not menu_item.is_available:

            raise ValueError(
                f"{menu_item.name} is unavailable."
            )

        OrderItem.objects.create(
            batch=batch,
            menu_item=menu_item,
            quantity=quantity,
            unit_price=menu_item.price,
            notes=notes,
        )

    # --------------------------------------------------------
    # RECALCULATE TOTAL
    # --------------------------------------------------------

    recalculate_order_total(order)

    # --------------------------------------------------------
    # NOTIFY KITCHEN
    # --------------------------------------------------------

    # Notify kitchen only after the database
    # transaction successfully commits.
    transaction.on_commit(
        lambda: notify_kitchen(batch)
    )

    return batch


# ============================================================
# RECALCULATE ORDER TOTAL
# ============================================================

def recalculate_order_total(order):

    subtotal = Decimal("0.00")

    items = OrderItem.objects.filter(
        batch__order=order,
        status__in=[
            OrderItem.Status.PENDING,
            OrderItem.Status.PREPARING,
            OrderItem.Status.READY,
            OrderItem.Status.SERVED,
        ],
    )

    for item in items:

        subtotal += item.line_total

    total = (
        subtotal
        - order.discount
        + order.delivery_fee
    )

    order.subtotal = subtotal

    order.total = total

    order.save(
        update_fields=[
            "subtotal",
            "total",
        ]
    )

    return order


# ============================================================
# COMPLETE PAYMENT
# ============================================================

@transaction.atomic
def complete_payment(
    *,
    order,
    payment_method,
    user=None,
    request=None,
):

    # --------------------------------------------------------
    # ALREADY PAID
    # --------------------------------------------------------

    if order.payment_status == Order.PaymentStatus.PAID:

        raise ValueError(
            "This order has already been paid."
        )

    # --------------------------------------------------------
    # CANCELLED ORDER
    # --------------------------------------------------------

    if order.status == Order.Status.CANCELLED:

        raise ValueError(
            "Cancelled orders cannot be paid."
        )

    # --------------------------------------------------------
    # PAYMENT
    # --------------------------------------------------------

    order.payment_method = payment_method

    order.payment_status = Order.PaymentStatus.PAID

    order.paid_at = timezone.now()

    order.status = Order.Status.COMPLETED

    order.save(
        update_fields=[
            "payment_method",
            "payment_status",
            "paid_at",
            "status",
        ]
    )

    # Clear any live "food ready" alerts for this order on waiter dashboards.
    from kitchen.services import notify_waiters_served
    try:
        notify_waiters_served(order)
    except Exception:
        pass

    # --------------------------------------------------------
    # RELEASE TABLE
    # --------------------------------------------------------

    if order.table:

        order.table.status = Table.Status.AVAILABLE

        order.table.save(
            update_fields=["status"]
        )

    # --------------------------------------------------------
    # RELEASE CABIN
    # --------------------------------------------------------

    if order.cabin:

        order.cabin.status = Cabin.Status.AVAILABLE

        order.cabin.save(
            update_fields=["status"]
        )

    # --------------------------------------------------------
    # INVENTORY + AUDIT
    # --------------------------------------------------------

    deduct_inventory(order)

    from core.services import log_action
    log_action(
        user, "PAYMENT_COMPLETED",
        f"Order #{order.order_number} ({payment_method})",
        {"total": str(order.total)},
        request=request,
    )

    return order
# ============================================================
# ORDER STATUS ENGINE
# ============================================================

# Valid order-level transitions keyed by current status.
VALID_ORDER_TRANSITIONS = {
    Order.Status.OPEN: [
        Order.Status.PREPARING,
        Order.Status.READY,
        Order.Status.SERVED,
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ],
    Order.Status.PREPARING: [
        Order.Status.READY,
        Order.Status.SERVED,
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ],
    Order.Status.READY: [
        Order.Status.SERVED,
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ],
    Order.Status.SERVED: [
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ],
    Order.Status.COMPLETED: [],
    Order.Status.CANCELLED: [],
}


def can_transition(current, new):
    return new in VALID_ORDER_TRANSITIONS.get(current, [])


def notify_waiters_served(order):
    """Tell waiter dashboards an order has been served so any live
    'food ready' banners for it are removed. Also dismisses any
    persisted ORDER_READY notifications for the order."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from core.models import Notification

    Notification.objects.filter(
        order=order,
        dismissed=False,
    ).update(dismissed=True, dismissed_at=timezone.now())

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        "waiters",
        {
            "type": "order_served",
            "order_number": order.order_number,
        },
    )


def transition_order_status(order, new_status):
    """Advance an order's status, rejecting invalid transitions."""
    if order.payment_status == Order.PaymentStatus.PAID and \
            new_status not in (Order.Status.COMPLETED, Order.Status.CANCELLED):
        raise ValueError(
            "Paid orders cannot change status."
        )

    if order.status == Order.Status.CANCELLED:
        raise ValueError("Cancelled orders are terminal.")

    if order.status == Order.Status.COMPLETED:
        raise ValueError("Completed orders are terminal.")

    if new_status == Order.Status.CANCELLED and \
            order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Paid orders cannot be cancelled.")

    if not can_transition(order.status, new_status):
        raise ValueError(
            f"Invalid order transition from "
            f"{order.status} to {new_status}."
        )

    order.status = new_status
    order.save(update_fields=["status"])

    # Once food has been served/completed, clear any live "food ready"
    # alerts for this order on waiter dashboards.
    if new_status in (Order.Status.SERVED, Order.Status.COMPLETED):
        from kitchen.services import notify_waiters_served
        try:
            notify_waiters_served(order)
        except Exception:
            pass

    return order


# ============================================================
# RELEASE SEATING
# ============================================================

def release_table(table):
    if table is None:
        return
    table.status = Table.Status.AVAILABLE
    table.save(update_fields=["status"])


def release_cabin(cabin):
    if cabin is None:
        return
    cabin.status = Cabin.Status.AVAILABLE
    cabin.save(update_fields=["status"])


# ============================================================
# ADD FOOD LATER (new batch on existing order)
# ============================================================

def add_items_to_order(order, items, user=None, request=None):
    if order.status in (
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ):
        raise ValueError("This order is closed and cannot accept more food.")

    batch = create_order_batch(order=order, items=items)

    from core.services import log_action
    log_action(
        user, "FOOD_ADDED",
        f"Order #{order.order_number} Batch #{batch.batch_number}",
        request=request,
    )

    return batch


# ============================================================
# INVENTORY DEDUCTION (recipes)
# ============================================================

def deduct_inventory(order):
    """Deduct recipe ingredients for served/ready items in an order."""
    from django.db.models import Sum

    from menu.models import Ingredient, RecipeItem, StockMovement

    quantities = (
        OrderItem.objects
        .filter(
            batch__order=order,
            status__in=[
                OrderItem.Status.SERVED,
                OrderItem.Status.READY,
            ],
        )
        .values("menu_item")
        .annotate(total=Sum("quantity"))
    )

    if not quantities:
        return

    item_ids = [q["menu_item"] for q in quantities]

    ingredients = {
        ing.id: ing
        for ing in Ingredient.objects.filter(
            recipe_items__menu_item_id__in=item_ids,
        )
    }

    movements = []
    for row in quantities:
        served = row["total"]
        recipes = RecipeItem.objects.filter(menu_item_id=row["menu_item"])
        for recipe in recipes:
            ingredient = ingredients.get(recipe.ingredient_id)
            if ingredient is None:
                continue
            delta = recipe.quantity * served
            ingredient.current_stock = ingredient.current_stock - delta
            ingredient.save(update_fields=["current_stock"])
            movements.append(
                StockMovement(
                    ingredient=ingredient,
                    movement_type=StockMovement.MovementType.DEDUCTION,
                    quantity=delta,
                    note=f"Order #{order.order_number}",
                )
            )

    if movements:
        StockMovement.objects.bulk_create(movements)


# ============================================================
# CANCEL ORDER
# ============================================================

@transaction.atomic
def cancel_order(order, user=None):
    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("Paid orders cannot be cancelled.")
    if order.status == Order.Status.CANCELLED:
        raise ValueError("Order is already cancelled.")

    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])

    # Close any pending/preparing batches so they clear off the kitchen board.
    OrderBatch.objects.filter(
        order=order,
        status__in=[
            OrderBatch.Status.PENDING,
            OrderBatch.Status.PREPARING,
        ],
    ).update(status=OrderBatch.Status.COMPLETED)

    release_table(order.table)
    release_cabin(order.cabin)

    # Clear any live "food ready" alerts for this order on waiter dashboards.
    from kitchen.services import notify_waiters_served
    try:
        notify_waiters_served(order)
    except Exception:
        pass

    from core.services import log_action
    log_action(
        user, "ORDER_CANCELLED",
        f"Order #{order.order_number}",
        request=getattr(user, "_request", None),
    )

    return order
