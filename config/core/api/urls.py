from django.urls import path

from . import views

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
]
