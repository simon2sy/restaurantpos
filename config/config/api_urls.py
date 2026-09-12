from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from core.api.realtime_views import RealtimePulseView
from core.api.restaurant_views import RestaurantListCreateView, RestaurantDetailView, RestaurantSettingsView

urlpatterns = [
    # API documentation
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("v1/auth/", include("accounts.api.auth_urls")),
    path("v1/accounts/", include("accounts.api.urls")),
    path("v1/menu/", include("menu.api.urls")),
    path("v1/orders/", include("orders.api.urls")),
    path("v1/kitchen/", include("kitchen.api.urls")),
    path("v1/delivery/", include("delivery.api.urls")),
    path("v1/reports/", include("reports.api.urls")),
    path("v1/notifications/", include("core.api.urls")),
    # Restaurant management
    path("v1/restaurants/", RestaurantListCreateView.as_view(), name="restaurant_list"),
    path("v1/restaurants/<int:pk>/", RestaurantDetailView.as_view(), name="restaurant_detail"),
    path("v1/restaurants/<int:pk>/settings/", RestaurantSettingsView.as_view(), name="restaurant_settings"),

    # HTTP polling fallback for hosts without WebSocket support (Passenger)
    path("v1/realtime/pulse/", RealtimePulseView.as_view(), name="realtime_pulse"),
]
