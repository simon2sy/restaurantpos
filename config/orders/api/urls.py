from django.urls import path

from . import views

app_name = "orders_api"

urlpatterns = [
    path("", views.OrderListCreateView.as_view(), name="order_list"),
    path("<int:pk>/", views.OrderDetailView.as_view(), name="order_detail"),
    path("<int:order_id>/add-items/", views.AddItemsView.as_view(), name="add_items"),
    path("<int:pk>/status/", views.OrderStatusView.as_view(), name="order_status"),
    path("<int:order_id>/payment/", views.PaymentView.as_view(), name="payment"),
    # Seating
    path("seating/", views.SeatingDashboardView.as_view(), name="seating_dashboard"),
    path("tables/", views.TableListCreateView.as_view(), name="table_list"),
    path("tables/<int:pk>/", views.TableDetailView.as_view(), name="table_detail"),
    path("cabins/", views.CabinListCreateView.as_view(), name="cabin_list"),
    path("cabins/<int:pk>/", views.CabinDetailView.as_view(), name="cabin_detail"),
]
