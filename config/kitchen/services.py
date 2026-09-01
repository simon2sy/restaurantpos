from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from orders.models import Order, OrderBatch


def start_batch(batch):

    if batch.status != OrderBatch.Status.PENDING:
        raise ValueError(
            "This batch cannot be started."
        )

    batch.status = OrderBatch.Status.PREPARING
    batch.started_at = timezone.now()

    batch.save(
        update_fields=[
            "status",
            "started_at",
        ]
    )

    # Reflect progress on the parent order.
    order = batch.order
    if order.status == Order.Status.OPEN:
        order.status = Order.Status.PREPARING
        order.save(update_fields=["status"])

    notify_batch_status(batch)

    return batch


def mark_batch_ready(batch):

    if batch.status != OrderBatch.Status.PREPARING:
        raise ValueError(
            "Only preparing batches can be marked ready."
        )

    batch.status = OrderBatch.Status.READY
    batch.ready_at = timezone.now()

    batch.save(
        update_fields=[
            "status",
            "ready_at",
        ]
    )

    # Reflect readiness on the parent order.
    order = batch.order
    if order.status in (Order.Status.OPEN, Order.Status.PREPARING):
        order.status = Order.Status.READY
        order.save(update_fields=["status"])

    notify_batch_status(batch)
    notify_waiters_ready(batch)

    return batch


def notify_waiters_ready(batch):
    """Push a 'food is ready' notification to waiter dashboards.

    Persists the notification to the database so waiters who are
    temporarily offline can still see it when they reconnect.
    """
    from core.models import Notification

    order = batch.order
    delivery = getattr(order, "delivery", None)
    table_num = order.table.number if order.table_id else None
    cabin_num = order.cabin.number if order.cabin_id else None

    # --- Build human-readable message ---
    if delivery:
        location = f"Delivery → {delivery.customer_name}"
    elif table_num:
        location = f"Table {table_num}"
    elif cabin_num:
        location = f"Cabin {cabin_num}"
    else:
        location = "Order"

    message = f"Order #{order.order_number} is ready! ({location})"

    # --- Persist so offline waiters see it on reconnect ---
    Notification.objects.create(
        notification_type=Notification.Type.ORDER_READY,
        order=order,
        batch=batch,
        message=message,
        table_number=table_num,
        cabin_number=cabin_num,
        ready_at=batch.ready_at,
    )

    # --- Real-time push via WebSocket ---
    channel_layer = get_channel_layer()

    if channel_layer is not None:
        async_to_sync(
            channel_layer.group_send
        )(
            "waiters",
            {
                "type": "order_ready",
                "order_id": order.id,
                "order_number": order.order_number,
                "table": table_num,
                "cabin": cabin_num,
                "delivery": (
                    {
                        "customer_name": delivery.customer_name,
                        "customer_phone": delivery.customer_phone,
                    }
                    if delivery
                    else None
                ),
                "ready_at": batch.ready_at.strftime("%H:%M")
                if batch.ready_at
                else "",
            },
        )

    # --- FCM push notification to all waiters (best-effort) ---
    try:
        from core.push import send_push_to_role
        send_push_to_role(
            role="WAITER",
            title="🍽️ Order Ready!",
            body=message,
            data={
                "type": "order_ready",
                "order_id": order.id,
                "order_number": order.order_number,
                "batch_id": batch.id,
            },
            sound=True,
        )
    except Exception:
        # Push notifications are best-effort; never block kitchen workflow.
        pass


def complete_batch(batch):

    if batch.status != OrderBatch.Status.READY:
        raise ValueError(
            "Only ready batches can be completed."
        )

    batch.status = OrderBatch.Status.COMPLETED
    batch.save(update_fields=["status"])

    notify_batch_status(batch)

    return batch



def notify_kitchen(batch):

    channel_layer = get_channel_layer()

    if channel_layer is None:
        raise RuntimeError(
            "CHANNEL_LAYERS is not configured."
        )

    items = [
        {
            "name": item.menu_item.name,
            "quantity": item.quantity,
            "notes": item.notes or "",
        }
        for item in batch.items.select_related(
            "menu_item"
        ).all()
    ]

    order = batch.order

    delivery_info = None
    if getattr(order, "delivery", None) is not None:
        delivery_info = {
            "customer_name": order.delivery.customer_name,
            "customer_phone": order.delivery.customer_phone,
        }

    async_to_sync(
        channel_layer.group_send
    )(
        "kitchen",
        {
            "type": "kitchen_order",
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "order_number": batch.order.order_number,
            "order_type": order.order_type,
            "table": (
                batch.order.table.number
                if batch.order.table_id
                else None
            ),
            "cabin": (
                batch.order.cabin.number
                if batch.order.cabin_id
                else None
            ),
            "delivery": delivery_info,
            "items": items,
        },
    )

def notify_batch_status(batch):

    channel_layer = get_channel_layer()

    if channel_layer is None:
        raise RuntimeError(
            "CHANNEL_LAYERS is not configured."
        )

    async_to_sync(
        channel_layer.group_send
    )(
        "kitchen",
        {
            "type": "kitchen_status",
            "batch_id": batch.id,
            "status": batch.status,
        },
    )