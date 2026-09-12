from django.urls import path

from .consumers import KitchenConsumer, WaiterConsumer, DashboardConsumer


# All WebSocket routes now derive the tenant from the authenticated user's
# profile, NOT from the URL. The URL patterns below are kept for backwards
# compatibility but the restaurant_id in the URL is ignored by the consumers.

websocket_urlpatterns = [
    # Mobile clients derive the tenant from the authenticated JWT.
    path(
        "ws/kitchen/",
        KitchenConsumer.as_asgi(),
    ),
    path(
        "ws/waiters/",
        WaiterConsumer.as_asgi(),
    ),
    path(
        "ws/dashboard/",
        DashboardConsumer.as_asgi(),
    ),
    # Tenant-scoped routes (restaurant_id in URL is ignored - tenant comes from auth)
    path(
        "ws/<int:restaurant_id>/kitchen/",
        KitchenConsumer.as_asgi(),
    ),
    path(
        "ws/<int:restaurant_id>/waiters/",
        WaiterConsumer.as_asgi(),
    ),
    path(
        "ws/<int:restaurant_id>/dashboard/",
        DashboardConsumer.as_asgi(),
    ),
]
