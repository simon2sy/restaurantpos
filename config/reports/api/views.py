from datetime import datetime, timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce, TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api_permissions import IsManager, IsSuperUserOrManager
from orders.models import Order, OrderItem
from reports.models import Expense
from reports.services import (
    daily_sales,
    get_top_selling_items,
    payment_method_breakdown,
    sales_series,
)

from .serializers import (
    ExpenseSerializer,
    PaymentMethodBreakdownSerializer,
    SalesBucketSerializer,
    SalesSummarySerializer,
    TopItemSerializer,
)


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _resolve_range(request):
    """Turn query params into a date range."""
    now = timezone.localtime()
    today = now.date()
    period = request.query_params.get("period", "today")
    from_d = _parse_date(request.query_params.get("from"))
    to_d = _parse_date(request.query_params.get("to"))

    def aware(d):
        return timezone.make_aware(datetime.combine(d, datetime.min.time()))

    def aware_end(d):
        return timezone.make_aware(datetime.combine(d, datetime.max.time()))

    if from_d and to_d:
        if from_d > to_d:
            from_d, to_d = to_d, from_d
        return aware(from_d), aware_end(to_d), from_d, to_d

    if period == "yesterday":
        day = today - timedelta(days=1)
        return aware(day), aware_end(day), day, day
    elif period == "7":
        start = today - timedelta(days=6)
        return aware(start), aware_end(today), start, today
    elif period == "30":
        start = today - timedelta(days=29)
        return aware(start), aware_end(today), start, today
    elif period == "month":
        start = today.replace(day=1)
        return aware(start), aware_end(today), start, today
    elif period == "all":
        return None, None, None, None
    else:  # today
        return aware(today), aware_end(today), today, today


class SalesReportView(APIView):
    """GET /api/v1/reports/sales/

    Returns comprehensive sales report with optional date filtering.
    """

    permission_classes = [IsSuperUserOrManager]

    def get(self, request):
        start_dt, end_dt, from_d, to_d = _resolve_range(request)

        paid_orders = Order.objects.annotate(revenue_ts=Coalesce("paid_at", "created_at")).filter(
            payment_status=Order.PaymentStatus.PAID
        ).exclude(status=Order.Status.CANCELLED)

        if start_dt:
            paid_orders = paid_orders.filter(revenue_ts__gte=start_dt)
        if end_dt:
            paid_orders = paid_orders.filter(revenue_ts__lte=end_dt)

        # Summary
        summary = paid_orders.aggregate(
            total_revenue=Sum("total"),
            total_orders=Count("id"),
        )
        summary["avg_order"] = (
            summary["total_revenue"] / summary["total_orders"]
            if summary["total_orders"]
            else 0
        )

        unpaid_stats = Order.objects.filter(
            payment_status=Order.PaymentStatus.UNPAID,
        ).exclude(status=Order.Status.CANCELLED).aggregate(
            count=Count("id"), amount=Sum("total")
        )

        # Payment method split
        by_method = (
            paid_orders.values("payment_method")
            .annotate(revenue=Sum("total"), orders=Count("id"))
            .order_by("-revenue")
        )

        # Daily breakdown
        DAILY_CHART_MAX_DAYS = 62
        span_days = (to_d - from_d).days + 1 if (from_d and to_d) else None
        show_daily = bool(start_dt) and (
            span_days is None or span_days <= DAILY_CHART_MAX_DAYS
        )

        days = []
        max_daily = 0
        if show_daily and from_d and to_d:
            daily_map = {
                r["day"]: r
                for r in (
                    paid_orders.annotate(day=TruncDate("revenue_ts"))
                    .values("day")
                    .annotate(revenue=Sum("total"), orders=Count("id"))
                )
            }
            day_cursor = from_d
            while day_cursor <= to_d:
                entry = daily_map.get(day_cursor)
                revenue = entry["revenue"] if entry else 0
                max_daily = max(max_daily, revenue or 0)
                days.append({
                    "date": str(day_cursor),
                    "revenue": str(revenue) if revenue else "0",
                    "orders": entry["orders"] if entry else 0,
                })
                day_cursor += timedelta(days=1)

        # Monthly breakdown
        monthly = list(
            paid_orders.annotate(month=TruncMonth("revenue_ts"))
            .values("month")
            .annotate(revenue=Sum("total"), orders=Count("id"))
            .order_by("-month")[:12]
        )
        for m in monthly:
            m["month"] = str(m["month"])
            m["revenue"] = str(m["revenue"]) if m["revenue"] else "0"

        # Category performance
        cat_items = OrderItem.objects.filter(batch__order__payment_status=Order.PaymentStatus.PAID)
        if start_dt:
            cat_items = cat_items.filter(batch__order__paid_at__gte=start_dt)
        if end_dt:
            cat_items = cat_items.filter(batch__order__paid_at__lte=end_dt)

        by_category = list(
            cat_items.exclude(batch__order__status=Order.Status.CANCELLED)
            .values("menu_item__category__name")
            .annotate(
                revenue=Sum(F("unit_price") * F("quantity")),
                items_sold=Sum("quantity"),
            )
            .order_by("-revenue")
        )
        for c in by_category:
            c["revenue"] = str(c["revenue"]) if c["revenue"] else "0"

        # Top selling items
        top_items = list(
            cat_items.values("menu_item__name")
            .annotate(
                revenue=Sum(F("unit_price") * F("quantity")),
                items_sold=Sum("quantity"),
            )
            .order_by("-revenue")[:8]
        )
        for t in top_items:
            t["revenue"] = str(t["revenue"]) if t["revenue"] else "0"

        # Detailed orders (latest 50)
        detailed = (
            paid_orders.select_related("table", "cabin", "delivery", "created_by")
            .prefetch_related("batches__items__menu_item")
            .order_by("-paid_at", "-created_at")[:50]
        )
        detailed_data = []
        for order in detailed:
            items_list = []
            for batch in order.batches.all():
                for item in batch.items.all():
                    items_list.append({
                        "name": item.menu_item.name,
                        "quantity": item.quantity,
                        "unit_price": str(item.unit_price),
                    })
            delivery = getattr(order, "delivery", None)
            detailed_data.append({
                "id": order.id,
                "order_number": order.order_number,
                "order_type": order.order_type,
                "total": str(order.total),
                "payment_method": order.payment_method,
                "paid_at": order.paid_at.isoformat() if order.paid_at else None,
                "table": order.table.number if order.table else None,
                "cabin": order.cabin.number if order.cabin else None,
                "customer_name": delivery.customer_name if delivery else None,
                "items": items_list,
            })

        return Response(
            {
                "success": True,
                "message": "Sales report loaded.",
                "data": {
                    "summary": {
                        "total_revenue": str(summary["total_revenue"] or 0),
                        "total_orders": summary["total_orders"] or 0,
                        "avg_order": str(summary["avg_order"] or 0),
                        "unpaid_count": unpaid_stats["count"] or 0,
                        "unpaid_amount": str(unpaid_stats["amount"] or 0),
                    },
                    "by_method": list(by_method),
                    "days": days,
                    "max_daily": str(max_daily),
                    "monthly": monthly,
                    "by_category": by_category,
                    "top_items": top_items,
                    "detailed_orders": detailed_data,
                },
            },
            status=status.HTTP_200_OK,
        )


class DashboardStatsView(APIView):
    """GET /api/v1/reports/dashboard/

    Quick stats for the admin dashboard.
    """

    permission_classes = [IsSuperUserOrManager]

    def get(self, request):
        from orders.models import Table, Cabin, OrderBatch
        from accounts.models import EmployeeProfile

        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        todays_orders = Order.objects.filter(created_at__gte=today)

        stats = {
            "orders_today": todays_orders.count(),
            "revenue_today": str(
                Order.objects.annotate(revenue_ts=Coalesce("paid_at", "created_at")).filter(
                    revenue_ts__gte=today,
                    payment_status=Order.PaymentStatus.PAID,
                ).aggregate(total=Sum("total"))["total"] or 0
            ),
            "unpaid_orders": Order.objects.filter(
                payment_status=Order.PaymentStatus.UNPAID,
            ).exclude(status=Order.Status.CANCELLED).count(),
            "open_orders": Order.objects.filter(
                status__in=[
                    Order.Status.OPEN,
                    Order.Status.PREPARING,
                    Order.Status.READY,
                    Order.Status.SERVED,
                ]
            ).count(),
            "tables_occupied": Table.objects.filter(status=Table.Status.OCCUPIED).count(),
            "tables_total": Table.objects.count(),
            "cabins_occupied": Cabin.objects.filter(status=Cabin.Status.OCCUPIED).count(),
            "cabins_total": Cabin.objects.count(),
            "kitchen_pending": OrderBatch.objects.filter(
                status__in=[OrderBatch.Status.PENDING, OrderBatch.Status.PREPARING]
            ).count(),
            "active_employees": EmployeeProfile.objects.filter(is_active=True).count(),
        }

        return Response(
            {
                "success": True,
                "message": "Dashboard stats loaded.",
                "data": stats,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# EXPENSES
# ============================================================


def _expense_range(request):
    """Reuse the sales-report date-range resolution for expenses."""
    from reports.api.views import _resolve_range  # same module

    return _resolve_range(request)


class ExpenseListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/reports/expenses/

    List expenses (optionally filtered with ?period=today|7|month|all)
    or record a new expense. Managers/admins only.
    """

    serializer_class = ExpenseSerializer
    permission_classes = [IsSuperUserOrManager]

    def get_queryset(self):
        qs = Expense.objects.select_related("recorded_by")
        start_dt, end_dt, _, _ = _resolve_range(self.request)
        if start_dt:
            qs = qs.filter(spent_on__gte=start_dt.date())
        if end_dt:
            qs = qs.filter(spent_on__lte=end_dt.date())
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Expense recorded.",
                "data": response.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        qs = self.filter_queryset(self.get_queryset())
        total = qs.aggregate(total=Sum("amount"))["total"] or 0
        return Response(
            {
                "success": True,
                "message": "Expenses loaded.",
                "data": {
                    "total": str(total),
                    "count": qs.count(),
                    "results": response.data["results"]
                    if isinstance(response.data, dict)
                    else response.data,
                },
            }
        )


class ExpenseSummaryView(APIView):
    """GET /api/v1/reports/expenses/summary/?period=today|7|month

    Returns the total expense amount for the given period.
    """

    permission_classes = [IsSuperUserOrManager]

    def get(self, request):
        start_dt, end_dt, _, _ = _resolve_range(request)
        qs = Expense.objects.all()
        if start_dt:
            qs = qs.filter(spent_on__gte=start_dt.date())
        if end_dt:
            qs = qs.filter(spent_on__lte=end_dt.date())
        total = qs.aggregate(total=Sum("amount"))["total"] or 0
        return Response(
            {
                "success": True,
                "message": "Expense summary loaded.",
                "data": {"total": str(total), "count": qs.count()},
            }
        )


# ============================================================
# DAILY SUMMARY TRIGGER
# ============================================================


class DailySummaryTriggerView(APIView):
    """POST /api/v1/reports/daily-summary/trigger/

    On-demand trigger for the daily sales summary push notification.
    Superuser only.
    """

    permission_classes = [IsSuperUserOrManager]

    def post(self, request):
        from core.management.commands.daily_sales_summary import (
            build_summary_data,
            send_summary_to_managers,
            format_summary_message,
        )

        data = build_summary_data()

        if request.data.get("dry_run"):
            return Response(
                {
                    "success": True,
                    "message": "Dry run — no notifications sent.",
                    "data": data,
                },
                status=status.HTTP_200_OK,
            )

        result = send_summary_to_managers(data)

        return Response(
            {
                "success": True,
                "message": f"Daily summary sent to {result['sent']} devices.",
                "data": {
                    "summary": data,
                    "sent": result["sent"],
                    "failed": result["failed"],
                },
            },
            status=status.HTTP_200_OK,
        )
