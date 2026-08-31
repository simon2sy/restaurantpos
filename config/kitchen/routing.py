from django.urls import path

from .consumers import KitchenConsumer, WaiterConsumer, DashboardConsumer


websocket_urlpatterns = [
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
]