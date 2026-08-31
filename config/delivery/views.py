from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from menu.models import Category
from orders.models import Order, PaymentMethod
from orders.services import create_order, create_order_batch

from .models import Delivery


@login_required
def create_delivery_order(request):

    if request.method == "POST":

        customer_name = request.POST.get(
            "customer_name"
        )

        customer_phone = request.POST.get(
            "customer_phone"
        )

        address = request.POST.get(
            "address"
        )

        landmark = request.POST.get(
            "landmark",
            "",
        )

        delivery_fee = 100

        # Store customer information temporarily
        # until food selection is completed.
        request.session["delivery_data"] = {
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "address": address,
            "landmark": landmark,
            "delivery_fee": delivery_fee,
        }

        return redirect(
            "delivery:select_food"
        )

    return render(
        request,
        "delivery/create_order.html",
    )


@login_required
def select_food(request):

    # --------------------------------
    # GET DELIVERY INFORMATION
    # --------------------------------

    delivery_data = request.session.get(
        "delivery_data"
    )

    if not delivery_data:

        return redirect(
            "delivery:create_order"
        )

    # Normalise the delivery fee coming from the form (string) to Decimal.
    from decimal import Decimal, InvalidOperation

    try:
        delivery_data["delivery_fee"] = Decimal(
            str(delivery_data.get("delivery_fee") or "0")
        )
    except InvalidOperation:
        delivery_data["delivery_fee"] = Decimal("0")

    # --------------------------------
    # GET AVAILABLE FOOD
    # --------------------------------

    categories = (
        Category.objects
        .filter(
            is_active=True,
            items__is_available=True,
        )
        .prefetch_related("items")
        .distinct()
    )

    # --------------------------------
    # HANDLE FOOD SUBMISSION
    # --------------------------------

    if request.method == "POST":

        items = []

        for category in categories:

            for menu_item in category.items.all():

                quantity = int(
                    request.POST.get(
                        f"quantity_{menu_item.id}",
                        0,
                    )
                )

                if quantity > 0:

                    items.append({
                        "menu_item": menu_item,
                        "quantity": quantity,
                        "notes": request.POST.get(
                            f"notes_{menu_item.id}",
                            "",
                        ),
                    })

        # --------------------------------
        # NO FOOD SELECTED
        # --------------------------------

        if not items:

            return render(
                request,
                "delivery/select_food.html",
                {
                    "categories": categories,
                    "error": (
                        "Select at least one food item."
                    ),
                },
            )

        # --------------------------------
        # CREATE ORDER
        # --------------------------------

        order = create_order(
    user=request.user,
    order_type=Order.OrderType.DELIVERY,
)

        order.save(
            update_fields=[
                "order_type",
            ]
        )

        # --------------------------------
        # CREATE DELIVERY RECORD
        # --------------------------------

        delivery = Delivery.objects.create(
            order=order,

            customer_name=delivery_data[
                "customer_name"
            ],

            customer_phone=delivery_data[
                "customer_phone"
            ],

            address=delivery_data[
                "address"
            ],

            landmark=delivery_data[
                "landmark"
            ],

            delivery_fee=delivery_data[
                "delivery_fee"
            ],
        )

        # --------------------------------
        # CREATE FOOD BATCH
        # --------------------------------

        create_order_batch(
            order=order,
            items=items,
        )

        # --------------------------------
        # ADD DELIVERY FEE
        # --------------------------------

        order.delivery_fee = (
            delivery.delivery_fee
        )

        order.total = (
            order.total +
            delivery.delivery_fee
        )

        # --------------------------------
        # SET PAYMENT METHOD
        # --------------------------------

        order.payment_method = (
            PaymentMethod.COD
        )

        order.payment_status = "UNPAID"

        # --------------------------------
        # SAVE ORDER
        # --------------------------------

        order.save(
            update_fields=[
                "delivery_fee",
                "total",
                "payment_method",
                "payment_status",
            ]
        )

        # --------------------------------
        # CLEAR SESSION
        # --------------------------------

        del request.session[
            "delivery_data"
        ]

        # --------------------------------
        # REDIRECT TO ORDER DETAIL
        # --------------------------------

        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    # --------------------------------
    # DISPLAY FOOD SELECTION
    # --------------------------------

    return render(
        request,
        "delivery/select_food.html",
        {
            "categories": categories,
        },
    )


@login_required
def delivery_dashboard(request):

    deliveries = (
        Delivery.objects
        .select_related("order")
        .prefetch_related(
            "order__batches__items__menu_item"
        )
        .order_by("-created_at")
    )

    return render(
        request,
        "delivery/dashboard.html",
        {
            "deliveries": deliveries,
        },
    )


@login_required
def cart_add(request, item_id):
    from django.core.exceptions import PermissionDenied
    from django.shortcuts import get_object_or_404
    from menu.models import MenuItem

    if not is_customer(request.user):
        raise PermissionDenied

    if request.method != "POST":
        return redirect("menu:menu_list")

    item = get_object_or_404(MenuItem, id=item_id, is_available=True)

    try:
        qty = int(request.POST.get("qty", 1))
    except (TypeError, ValueError):
        qty = 1
    qty = max(1, min(qty, 99))

    cart = _get_cart(request)
    key = str(item.id)
    cart[key] = int(cart.get(key, 0)) + qty
    _save_cart(request, cart)

    # "Order Now" jumps straight to checkout.
    if request.POST.get("order_now"):
        return redirect("delivery:checkout")

    return redirect("delivery:cart")


@login_required
def cart_update(request, item_id):
    from django.core.exceptions import PermissionDenied

    if not is_customer(request.user):
        raise PermissionDenied

    if request.method == "POST":
        cart = _get_cart(request)
        try:
            qty = int(request.POST.get("qty", 0))
        except (TypeError, ValueError):
            qty = 0

        key = str(item_id)
        if qty <= 0:
            cart.pop(key, None)
        else:
            cart[key] = min(qty, 99)
        _save_cart(request, cart)

    return redirect("delivery:cart")


@login_required
def cart_view(request):
    from django.core.exceptions import PermissionDenied

    if not is_customer(request.user):
        raise PermissionDenied

    lines, subtotal = _cart_lines(_get_cart(request))

    return render(
        request,
        "delivery/cart.html",
        {
            "lines": lines,
            "subtotal": subtotal,
        },
    )


# ============================================================
# CUSTOMER CART (session-based)
# ============================================================

def is_customer(user):
    """Customers are logged-in users without a staff profile."""
    return (
        user.is_authenticated
        and not user.is_superuser
        and not user.is_staff
        and not hasattr(user, "employee_profile")
    )


def _get_cart(request):
    """Cart is stored in the session as {menu_item_id: quantity}."""
    return request.session.get("cart", {})


def _save_cart(request, cart):
    request.session["cart"] = cart
    request.session.modified = True


def _cart_lines(cart):
    """Resolve the cart into display rows with prices."""
    from decimal import Decimal
    from menu.models import MenuItem

    ids = [int(i) for i in cart.keys() if str(i).isdigit()]
    items = MenuItem.objects.filter(id__in=ids).select_related("category")

    lines = []
    subtotal = Decimal("0")
    for item in items:
        qty = int(cart.get(str(item.id)) or 0)
        if qty <= 0:
            continue
        subtotal += item.price * qty
        lines.append({
            "item": item,
            "qty": qty,
            "line_total": item.price * qty,
        })
    return lines, subtotal


@login_required
def checkout(request):
    from decimal import Decimal
    from django.core.exceptions import PermissionDenied

    if not is_customer(request.user):
        raise PermissionDenied

    lines, subtotal = _cart_lines(_get_cart(request))

    if not lines:
        messages.info(request, "Your cart is empty — add some food first.")
        return redirect("menu:menu_list")

    error = None
    order = None

    if request.method == "POST":
        customer_name = (request.POST.get("customer_name") or "").strip()
        customer_phone = (request.POST.get("customer_phone") or "").strip()
        address = (request.POST.get("address") or "").strip()
        landmark = (request.POST.get("landmark") or "").strip()

        if not (customer_name and customer_phone and address):
            error = "Please fill in your name, phone and address."
        else:
            # Re-resolve the cart inside the transaction for accuracy.
            fresh_lines, fresh_subtotal = _cart_lines(_get_cart(request))
            if not fresh_lines:
                error = "Your cart is empty."
            else:
                order = create_order(
                    user=request.user,
                    order_type=Order.OrderType.DELIVERY,
                )
                order.save(update_fields=["order_type"])

                Delivery.objects.create(
                    order=order,
                    customer_name=customer_name,
                    customer_phone=customer_phone,
                    address=address,
                    landmark=landmark,
                    delivery_fee=Decimal("100"),
                )

                create_order_batch(
                    order=order,
                    items=[
                        {
                            "menu_item": l["item"],
                            "quantity": l["qty"],
                            "notes": "",
                        }
                        for l in fresh_lines
                    ],
                )

                # Cash on Delivery is currently the only payment method.
                order.payment_method = PaymentMethod.COD
                order.payment_status = Order.PaymentStatus.UNPAID

                # Add fixed delivery fee of Rs. 100
                delivery_fee = Decimal("100")
                order.delivery_fee = delivery_fee
                order.total = order.total + delivery_fee
                order.save(update_fields=["payment_method", "payment_status", "delivery_fee", "total"])

                # The cart is consumed once the order is placed.
                _save_cart(request, {})

                messages.success(
                    request,
                    f"Order #{order.order_number} placed! "
                    "Pay cash when it arrives.",
                )
                return redirect("orders:order_detail", order_id=order.id)

    return render(
        request,
        "delivery/checkout.html",
        {
            "lines": lines,
            "subtotal": subtotal,
            "error": error,
            "customer_name": request.user.get_full_name(),
        },
    )