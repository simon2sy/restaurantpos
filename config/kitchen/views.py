from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from core.permissions import KITCHEN_ROLES, role_required
from orders.models import OrderBatch,Order
from menu.models import Category
from orders.services import create_order,create_order_batch
from .services import (
    mark_batch_ready,
    start_batch,
)


@login_required
@role_required(*KITCHEN_ROLES)
def kitchen_dashboard(request):

    batches = (
        OrderBatch.objects
        .filter(
            status__in=[
                OrderBatch.Status.PENDING,
                OrderBatch.Status.PREPARING,
            ]
        )
        .select_related(
            "order",
            "order__table",
            "order__cabin",
            "order__delivery",
        )
        .prefetch_related(
            "items__menu_item"
        )
        .order_by("created_at")
    )

    return render(
        request,
        "kitchen/dashboard.html",
        {
            "batches": batches,
        },
    )
@login_required
@role_required(*KITCHEN_ROLES)
def start_batch_view(request, batch_id):

    batch = get_object_or_404(
        OrderBatch,
        id=batch_id,
    )

    if request.method == "POST":
        start_batch(batch)

    return redirect(
        "kitchen:dashboard"
    )
@login_required
@role_required(*KITCHEN_ROLES)
def ready_batch_view(request, batch_id):

    batch = get_object_or_404(
        OrderBatch,
        id=batch_id,
    )

    if request.method == "POST":
        mark_batch_ready(batch)

    return redirect(
        "kitchen:dashboard"
    )
