from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import redirect, render
from django.utils import timezone

from accounts.models import EmployeeProfile
from orders.models import Order, OrderBatch, Table, Cabin

from .permissions import require_role


def _user_role(user):
    profile = getattr(user, "employee_profile", None)
    if profile is not None and profile.is_active:
        return profile.role
    return None


@login_required
def home(request):
    """Role-aware entry point: send every user to the dashboard that
    matches their job instead of a generic landing page."""

    # Superusers (and staff without a profile) get the admin dashboard.
    if request.user.is_superuser:
        return redirect("core:admin_dashboard")

    role = _user_role(request.user)

    if role == EmployeeProfile.Role.KITCHEN:
        return redirect("kitchen:dashboard")

    if role in (
        EmployeeProfile.Role.WAITER,
        EmployeeProfile.Role.CASHIER,
        EmployeeProfile.Role.DELIVERY,
    ):
        return redirect("orders:seating_dashboard")

    if role == EmployeeProfile.Role.MANAGER:
        return redirect("core:admin_dashboard")

    # Authenticated user without a staff profile = customer.
    # Send them straight to the delivery ordering page.
    if _user_role(request.user) is None:
        return redirect("delivery:create_order")

    # No usable profile -> generic page.
    return render(request, "pages/home.html")


@login_required
def admin_dashboard(request):
    """Admin/manager overview: everything happening in the restaurant."""

    now = timezone.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get the current restaurant from user's profile.
    # Every employee must have a restaurant assigned; if not, show an
    # error page instead of silently falling back to the default.
    profile = getattr(request.user, "employee_profile", None)
    if profile is not None and profile.restaurant is not None:
        restaurant = profile.restaurant
    else:
        from django.core.exceptions import ImproperlyConfigured
        from django.shortcuts import render as _render
        return _render(
            request,
            "pages/error.html",
            {
                "title": "Restaurant Not Assigned",
                "message": (
                    "Your account has not been assigned to a restaurant yet. "
                    "Please contact your administrator."
                ),
            },
            status=403,
        )

    todays_orders = Order.objects.filter(restaurant=restaurant, created_at__gte=today)

    stats = {
        "orders_today": todays_orders.count(),
        "revenue_today": (
            Order.objects.filter(restaurant=restaurant).annotate(revenue_ts=Coalesce("paid_at", "created_at")).filter(
                revenue_ts__gte=today,
                payment_status=Order.PaymentStatus.PAID,
            ).aggregate(total=Sum("total"))["total"]
            or 0
        ),
        "unpaid_orders": Order.objects.filter(
            restaurant=restaurant,
            payment_status=Order.PaymentStatus.UNPAID,
        ).exclude(status=Order.Status.CANCELLED).count(),
        "open_orders": Order.objects.filter(
            restaurant=restaurant,
            status__in=[
                Order.Status.OPEN,
                Order.Status.PREPARING,
                Order.Status.READY,
                Order.Status.SERVED,
            ]
        ).count(),
        "tables_occupied": Table.objects.filter(
            restaurant=restaurant,
            status=Table.Status.OCCUPIED
        ).count(),
        "tables_total": Table.objects.filter(restaurant=restaurant).count(),
        "cabins_occupied": Cabin.objects.filter(
            restaurant=restaurant,
            status=Cabin.Status.OCCUPIED
        ).count(),
        "cabins_total": Cabin.objects.filter(restaurant=restaurant).count(),
        "kitchen_pending": OrderBatch.objects.filter(
            restaurant=restaurant,
            status__in=[
                OrderBatch.Status.PENDING,
                OrderBatch.Status.PREPARING,
            ]
        ).count(),
        "active_employees": EmployeeProfile.objects.filter(
            restaurant=restaurant,
            is_active=True
        ).count(),
    }

    recent_orders = (
        Order.objects
        .filter(restaurant=restaurant)
        .select_related("table", "cabin", "created_by")
        .order_by("-created_at")[:10]
    )

    kitchen_queue = (
        OrderBatch.objects
        .filter(
            restaurant=restaurant,
            status__in=[
                OrderBatch.Status.PENDING,
                OrderBatch.Status.PREPARING,
                OrderBatch.Status.READY,
            ]
        )
        .select_related("order", "order__table", "order__cabin")
        .prefetch_related("items__menu_item")
        .order_by("created_at")[:15]
    )

    employees = (
        EmployeeProfile.objects
        .filter(restaurant=restaurant)
        .select_related("user")
        .order_by("user__first_name")
    )

    return render(
        request,
        "pages/admin_dashboard.html",
        {
            "stats": stats,
            "recent_orders": recent_orders,
            "kitchen_queue": kitchen_queue,
            "employees": employees,
            "today": today,
        },
    )
