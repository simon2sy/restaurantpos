from django.urls import include, path

urlpatterns = [
    path("v1/auth/", include("accounts.api.auth_urls")),
    path("v1/accounts/", include("accounts.api.urls")),
    path("v1/menu/", include("menu.api.urls")),
    path("v1/orders/", include("orders.api.urls")),
    path("v1/kitchen/", include("kitchen.api.urls")),
    path("v1/delivery/", include("delivery.api.urls")),
    path("v1/reports/", include("reports.api.urls")),
    path("v1/notifications/", include("core.api.urls")),
]
