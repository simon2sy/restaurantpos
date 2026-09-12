from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.tenant import ws_tenant_group


def broadcast_dashboard_update(restaurant, reason=""):
    """Send a 'stats_updated' ping to the admin dashboards of a specific restaurant.

    Best-effort: never raises. This lets the React Native dashboard refetch
    its stats in real time whenever an order/payment/expense changes.

    Args:
        restaurant: The Restaurant instance to broadcast to.
        reason: The reason for the update (e.g., "order", "expense").
    """
    if restaurant is None:
        return

    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            ws_tenant_group(restaurant, "dashboard"),
            {
                "type": "dashboard.update",
                "reason": reason,
            },
        )
    except Exception:
        # Realtime pings must never break the underlying flow.
        pass
