from django.urls import path

from . import views


app_name = "orders"


urlpatterns = [
    path(
        "seating/",
        views.seating_dashboard,
        name="seating_dashboard",
    ),

    path(
        "table/<int:table_id>/order/",
        views.create_table_order,
        name="create_table_order",
    ),

    path(
        "cabin/<int:cabin_id>/order/",
        views.create_cabin_order,
        name="create_cabin_order",
    ),

    path(
        "<int:order_id>/",
        views.order_detail,
        name="order_detail",
    ),
    path(
        "<int:order_id>/add-items/",
        views.add_items,
        name="add_items",
    ),
    path(
    "<int:order_id>/payment/",
    views.payment,
    name="payment",
),
]