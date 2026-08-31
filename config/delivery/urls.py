from django.urls import path

from . import views

app_name = "delivery"

urlpatterns = [

    path(
        "create/",
        views.create_delivery_order,
        name="create_order",
    ),
path(
    "select-food/",
    views.select_food,
    name="select_food",
),
path(
    "cart/",
    views.cart_view,
    name="cart",
),
path(
    "cart/add/<int:item_id>/",
    views.cart_add,
    name="cart_add",
),
path(
    "cart/update/<int:item_id>/",
    views.cart_update,
    name="cart_update",
),
path(
    "checkout/",
    views.checkout,
    name="checkout",
),
]