from django.urls import path

from . import views

app_name = "delivery_api"

urlpatterns = [
    path("", views.DeliveryListCreateView.as_view(), name="delivery_list"),
    path("<int:pk>/", views.DeliveryDetailView.as_view(), name="delivery_detail"),
    path("due/", views.DueDeliveriesView.as_view(), name="due_deliveries"),
    path("<int:pk>/assign/", views.AssignDeliveryView.as_view(), name="assign_delivery"),
    path("<int:pk>/status/", views.DeliveryStatusChangeView.as_view(), name="delivery_status"),
    path("persons/", views.DeliveryPersonListCreateView.as_view(), name="person_list"),
    path("persons/<int:pk>/", views.DeliveryPersonDetailView.as_view(), name="person_detail"),
]
