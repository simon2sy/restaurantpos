from django.urls import path

from . import views

app_name = "kitchen_api"

urlpatterns = [
    path("", views.KitchenDashboardView.as_view(), name="dashboard"),
    path("batch/<int:batch_id>/start/", views.StartBatchView.as_view(), name="start_batch"),
    path("batch/<int:batch_id>/ready/", views.ReadyBatchView.as_view(), name="ready_batch"),
    path("batch/<int:batch_id>/complete/", views.CompleteBatchView.as_view(), name="complete_batch"),
]
