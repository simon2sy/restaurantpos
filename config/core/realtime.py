from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def broadcast_dashboard_update(reason=""):
    """Send a 'stats_updated' ping to all connected admin dashboards.

    Best-effort: never raises. This lets the React Native dashboard refetch
    its stats in real time whenever an order/payment/expense changes.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            "dashboard",
            {
                "type": "dashboard.update",
                "reason": reason,
            },
        )
    except Exception:
        # Realtime pings must never break the underlying flow.
        pass