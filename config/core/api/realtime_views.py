"""
HTTP polling endpoint for real-time updates.

Used on hosts that cannot proxy WebSockets (e.g. Passenger on shared
hosting). The mobile/web clients poll GET /api/v1/realtime/pulse/ every
few seconds with a `since` cursor; the response is tiny and driven by
indexed `updated_at` lookups.

The emitted message shapes mirror kitchen/consumers.py so the frontend
handles both transports identically.
"""

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.api_permissions import IsAnyStaff
from core.models import Notification
from orders.models import Order, OrderBatch, OrderItem
from reports.models import Expense

# Cap on how many order-ready events a single pulse can replay, so a
# client that was offline for a while doesn't get a huge payload.
MAX_EVENTS_PER_PULSE = 20


def _has_changes(model, since):
    """True if any row of `model` was created/updated after `since`."""
    if since is None:
        return False
    return model.objects.filter(updated_at__gt=since).exists()


class RealtimePulseView(APIView):
    """GET /api/v1/realtime/pulse/?since=<ISO8601>&streams=kitchen,waiters,dashboard

    Response:
    {
        "now": "<server ISO timestamp — the cursor for the next poll>",
        "kitchen":   {"changed": true},
        "waiters":   {
            "notifications_count": 2,
            "events": [
                {"type": "order_ready", "order_number": 42, "table": 5,
                 "cabin": null, "delivery": false, "ready_at": "..."}
            ]
        },
        "dashboard": {"changed": true}
    }

    On the first call `since` is omitted: the server only returns the
    baseline cursor and no events.
    """

    permission_classes = [IsAnyStaff]
    # Pulse requests are high-frequency by design; give them their own
    # generous throttle scope instead of burning the global 1000/hour
    # user budget (3s polling alone is 1200/hour).
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "pulse"

    def get(self, request):
        raw_since = request.query_params.get("since")
        since = None
        if raw_since:
            since = parse_datetime(raw_since)
            if since is None:
                from rest_framework import status

                return Response(
                    {"detail": "Invalid 'since' datetime. Use ISO 8601."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if since is not None and timezone.is_naive(since):
                since = timezone.make_aware(since)

        streams_param = request.query_params.get("streams", "")
        streams = [s.strip() for s in streams_param.split(",") if s.strip()]
        if not streams:
            streams = ["kitchen", "waiters", "dashboard"]

        now = timezone.now()
        payload = {"now": now.isoformat()}

        if "kitchen" in streams:
            payload["kitchen"] = {
                "changed": (
                    _has_changes(Order, since)
                    or _has_changes(OrderBatch, since)
                    or _has_changes(OrderItem, since)
                ),
            }

        if "waiters" in streams:
            events = []
            count = Notification.objects.filter(dismissed=False).count()
            if since is not None:
                notifications = (
                    Notification.objects.select_related("order")
                    .filter(dismissed=False, created_at__gt=since)
                    .order_by("-created_at")[:MAX_EVENTS_PER_PULSE]
                )
                for n in notifications:
                    order = n.order
                    events.append(
                        {
                            "type": "order_ready",
                            "order_number": order.order_number,
                            "table": n.table_number,
                            "cabin": n.cabin_number,
                            "delivery": order.order_type == Order.OrderType.DELIVERY,
                            "ready_at": (
                                n.ready_at.isoformat() if n.ready_at else None
                            ),
                        }
                    )
            payload["waiters"] = {
                "notifications_count": count,
                "events": events,
            }

        if "dashboard" in streams:
            payload["dashboard"] = {
                "changed": (
                    _has_changes(Order, since)
                    or _has_changes(OrderBatch, since)
                    or _has_changes(OrderItem, since)
                    or _has_changes(Expense, since)
                    or _has_changes(Notification, since)
                ),
            }

        return Response(payload)