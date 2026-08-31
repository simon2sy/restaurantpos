from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404

from core.permissions import CASHIER_ROLES, role_required
from .models import Table, Cabin
from menu.models import Category
from .models import Table
from orders.models import Order
from .selectors import get_open_cabin_order, get_open_table_order
from .services import create_order,create_order_batch,complete_payment

@login_required
@role_required(*CASHIER_ROLES)
def seating_dashboard(request):

    tables = list(
        Table.objects.filter(
            is_active=True
        ).order_by("number")
    )

    cabins = list(
        Cabin.objects.filter(
            is_active=True
        ).order_by("number")
    )

    # Attach each seat's currently open order so the template can offer
    # a payment shortcut for occupied tables/cabins.
    for table in tables:
        table.open_order = get_open_table_order(table)

    for cabin in cabins:
        cabin.open_order = get_open_cabin_order(cabin)

    return render(
        request,
        "orders/seating_dashboard.html",
        {
            "tables": tables,
            "cabins": cabins,
            "tables_available": sum(
                1 for t in tables if t.status == Table.Status.AVAILABLE
            ),
        },
    )
    
@login_required
def create_table_order(request, table_id):

    table = get_object_or_404(
        Table,
        id=table_id,
        is_active=True,
    )

    if table.status != Table.Status.AVAILABLE:
        return redirect(
            "orders:seating_dashboard"
        )

    categories = (
        Category.objects
        .filter(
            is_active=True,
            items__is_available=True,
        )
        .prefetch_related("items")
        .distinct()
    )

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

        if not items:

            return render(
                request,
                "orders/create_order.html",
                {
                    "table": table,
                    "categories": categories,
                    "error": "Select at least one food item.",
                },
            )

        order = create_order(
            user=request.user,
            table=table,
        )

        create_order_batch(
            order=order,
            items=items,
        )

        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    # GET request
    return render(
        request,
        "orders/create_order.html",
        {
            "table": table,
            "categories": categories,
        },
    )
    
    
@login_required
def order_detail(request, order_id):

    order = get_object_or_404(
        Order.objects
        .select_related(
            "table",
            "cabin",
            "created_by",
        )
        .prefetch_related(
            "batches__items__menu_item"
        ),
        id=order_id,
    )

    return render(
        request,
        "orders/order_detail.html",
        {
            "order": order,
        },
    )
    
@login_required
@role_required(*CASHIER_ROLES)
def create_cabin_order(request, cabin_id):

    cabin = get_object_or_404(
        Cabin,
        id=cabin_id,
        is_active=True,
    )

    if request.method == "POST":

        try:
            order = create_order(
                user=request.user,
                cabin=cabin,
            )

            return redirect(
                "orders:order_detail",
                order_id=order.id,
            )

        except ValueError as error:

            return render(
                request,
                "orders/seating_dashboard.html",
                {
                    "tables": Table.objects.filter(
                        is_active=True
                    ),
                    "cabins": Cabin.objects.filter(
                        is_active=True
                    ),
                    "error": str(error),
                },
            )

    return redirect(
        "orders:seating_dashboard"
    )
@login_required
@role_required(*CASHIER_ROLES)
def add_items(request, order_id):

    order = get_object_or_404(
        Order,
        id=order_id,
    )

    if order.status in [
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ]:
        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    categories = (
        Category.objects
        .filter(
            is_active=True,
            items__is_available=True,
        )
        .prefetch_related("items")
        .distinct()
    )

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

        if not items:

            return render(
                request,
                "orders/add_items.html",
                {
                    "order": order,
                    "categories": categories,
                    "error": "Select at least one food item.",
                },
            )

        batch = create_order_batch(
            order=order,
            items=items,
        )

        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    return render(
        request,
        "orders/add_items.html",
        {
            "order": order,
            "categories": categories,
        },
    )
@login_required
@role_required(*CASHIER_ROLES)
def payment(request, order_id):

    order = get_object_or_404(
        Order,
        id=order_id,
    )

    if order.payment_status == "PAID":
        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    if request.method == "POST":

        payment_method = request.POST.get(
            "payment_method"
        )

        if payment_method not in [
            "CASH",
            "COD",
        ]:
            return render(
                request,
                "orders/payment.html",
                {
                    "order": order,
                    "error": "Invalid payment method.",
                },
            )

        complete_payment(
            order=order,
            payment_method=payment_method,
        )

        return redirect(
            "orders:order_detail",
            order_id=order.id,
        )

    return render(
        request,
        "orders/payment.html",
        {
            "order": order,
        },
    )