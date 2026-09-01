from django.urls import path

from . import views
from . import device_token_views

app_name = "notifications_api"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="list"),
    path(
        "<int:pk>/dismiss/",
        views.NotificationDismissView.as_view(),
        name="dismiss",
    ),
    path(
        "dismiss-all/",
        views.NotificationDismissAllView.as_view(),
        name="dismiss_all",
    ),
    # Device token registration for push notifications
    path(
        "device-token/",
        device_token_views.DeviceTokenRegisterView.as_view(),
        name="device_token_register",
    ),
    path(
        "device-token/delete/",
        device_token_views.DeviceTokenDeleteView.as_view(),
        name="device_token_delete",
    ),
]
