from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView


def friendly_validation_message(detail):
    """Flatten DRF error detail into one readable sentence."""
    msgs = []

    def walk(value):
        if isinstance(value, (list, tuple)):
            for v in value:
                walk(v)
        elif isinstance(value, dict):
            for v in value.values():
                walk(v)
        else:
            msgs.append(str(value))

    walk(detail)
    return "; ".join(msgs) or "Invalid data."

from accounts.models import EmployeeProfile
from core.api_permissions import IsAnyStaff, IsCashierRole, IsSuperUserOrManager
from menu.models import Category, MenuItem
from orders.models import Cabin, Order, OrderBatch, Table
from orders.selectors import get_open_cabin_order, get_open_table_order
from orders.services import (
    add_items_to_order,
    cancel_order,
    complete_payment,
    create_order,
    create_order_batch,
    recalculate_order_total,
    transition_order_status,
)

from .serializers import (
    AddItemsToOrderSerializer,
    CabinCreateSerializer,
    CabinSerializer,
    CreateOrderSerializer,
    OrderDetailSerializer,
    OrderListSerializer,
    OrderItemSerializer,
    PaymentSerializer,
    TableCreateSerializer,
    TableSerializer,
)


# ============================================================
# SEATING / TABLES / CABINS
# ============================================================


class SeatingDashboardView(APIView):
    """GET /api/v1/orders/seating/

    Returns all tables and cabins with their current status and open order info.
    """

    permission_classes = [IsCashierRole]

    def get(self, request):
        tables = list(Table.objects.filter(is_active=True).order_by("number"))
        cabins = list(Cabin.objects.filter(is_active=True).order_by("number"))

        for table in tables:
            table._open_order = get_open_table_order(table)

        for cabin in cabins:
            cabin._open_order = get_open_cabin_order(cabin)

        return Response(
            {
                "success": True,
                "message": "Seating dashboard loaded.",
                "data": {
                    "tables": TableSerializer(tables, many=True).data,
                    "cabins": CabinSerializer(cabins, many=True).data,
                    "tables_available": sum(
                        1 for t in tables if t.status == Table.Status.AVAILABLE
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# TABLE CRUD
# ============================================================


class TableListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/orders/tables/"""

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TableCreateSerializer
        return TableSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Table.objects.order_by("number")


class TableDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/orders/tables/<pk>/"""

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return TableCreateSerializer
        return TableSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUserOrManager()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Table.objects.all()


# ============================================================
# CABIN CRUD
# ============================================================


class CabinListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/orders/cabins/"""

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CabinCreateSerializer
        return CabinSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Cabin.objects.order_by("number")


class CabinDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/orders/cabins/<pk>/"""

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CabinCreateSerializer
        return CabinSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUserOrManager()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Cabin.objects.all()


# ============================================================
# ORDERS
# ============================================================


class OrderListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/orders/

    List orders or create a new order.
    """

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateOrderSerializer
        return OrderListSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCashierRole()]
        return [IsAnyStaff()]

    def get_queryset(self):
        qs = Order.objects.select_related(
            "table", "cabin", "created_by"
        ).order_by("-created_at")

        # Filter by status
        order_status = self.request.query_params.get("status")
        if order_status:
            qs = qs.filter(status=order_status)

        # Filter by order type
        order_type = self.request.query_params.get("type")
        if order_type:
            qs = qs.filter(order_type=order_type)

        # Filter by payment status
        payment_status = self.request.query_params.get("payment_status")
        if payment_status:
            qs = qs.filter(payment_status=payment_status)

        # Filter by served state: served=true -> SERVED/COMPLETED,
        # served=false -> everything not yet served
        served = self.request.query_params.get("served")
        if served == "true":
            qs = qs.filter(
                status__in=[Order.Status.SERVED, Order.Status.COMPLETED]
            )
        elif served == "false":
            qs = qs.exclude(
                status__in=[Order.Status.SERVED, Order.Status.COMPLETED]
            )

        # Filter by day: ?date=YYYY-MM-DD (orders created that day)
        date_str = self.request.query_params.get("date")
        if date_str:
            from datetime import datetime, time as dtime
            try:
                day = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                raise DRFValidationError(
                    {"date": "Invalid date. Use YYYY-MM-DD."}
                )
            from django.utils import timezone as tz
            start = tz.make_aware(dtime.combine(day, dtime.min))
            end = tz.make_aware(dtime.combine(day, dtime.max))
            qs = qs.filter(created_at__range=(start, end))

        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as exc:
            return Response(
                {
                    "success": False,
                    "message": friendly_validation_message(exc.detail),
                    "errors": exc.detail,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        order_type = data.get("order_type", Order.OrderType.DINE_IN)

        try:
            if order_type == Order.OrderType.DELIVERY:
                order = create_order(
                    user=request.user,
                    order_type=Order.OrderType.DELIVERY,
                )
                order.save(update_fields=["order_type"])
            else:
                table = Table.objects.get(pk=data["table_id"]) if data.get("table_id") else None
                cabin = Cabin.objects.get(pk=data["cabin_id"]) if data.get("cabin_id") else None
                order = create_order(
                    user=request.user,
                    table=table,
                    cabin=cabin,
                )
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Order #{order.order_number} created.",
                "data": OrderDetailSerializer(order).data,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/DELETE /api/v1/orders/<pk>/"""

    queryset = Order.objects.select_related(
        "table", "cabin", "created_by"
    ).prefetch_related("batches__items__menu_item")
    serializer_class = OrderDetailSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsCashierRole()]
        return [IsAnyStaff()]

    def perform_destroy(self, instance):
        try:
            cancel_order(instance, user=self.request.user)
        except ValueError as e:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(str(e))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {
                "success": True,
                "message": f"Order #{instance.order_number} cancelled.",
                "data": OrderDetailSerializer(instance).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# ADD ITEMS TO ORDER
# ============================================================


class AddItemsView(APIView):
    """POST /api/v1/orders/<order_id>/add-items/

    Add a batch of food items to an existing order.
    """

    permission_classes = [IsCashierRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response(
                {"success": False, "message": "Order not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if order.status in (Order.Status.COMPLETED, Order.Status.CANCELLED):
            return Response(
                {"success": False, "message": "This order is closed.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AddItemsToOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": friendly_validation_message(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = []
        for item_data in serializer.validated_data["items"]:
            try:
                menu_item = MenuItem.objects.get(
                    pk=item_data["menu_item_id"], is_available=True
                )
            except MenuItem.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": f"Menu item {item_data['menu_item_id']} not found or unavailable.",
                        "errors": {},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            items.append({
                "menu_item": menu_item,
                "quantity": item_data["quantity"],
                "notes": item_data.get("notes", ""),
            })

        try:
            batch = add_items_to_order(
                order=order,
                items=items,
                user=request.user,
                request=request,
            )
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Batch #{batch.batch_number} added to Order #{order.order_number}.",
                "data": {
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "order_number": order.order_number,
                    "total": str(order.total),
                },
            },
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# ORDER STATUS TRANSITION
# ============================================================


class OrderStatusView(APIView):
    """PATCH /api/v1/orders/<pk>/status/

    Transition order status.
    """

    permission_classes = [IsCashierRole]

    def patch(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response(
                {"success": False, "message": "Order not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_status = request.data.get("status")
        if not new_status:
            return Response(
                {"success": False, "message": "Status is required.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            transition_order_status(order, new_status)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Order status changed to {new_status}.",
                "data": OrderDetailSerializer(order).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# PAYMENT
# ============================================================


class PaymentView(APIView):
    """POST /api/v1/orders/<order_id>/payment/

    Complete payment for an order.
    """

    permission_classes = [IsCashierRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response(
                {"success": False, "message": "Order not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": friendly_validation_message(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            complete_payment(
                order=order,
                payment_method=serializer.validated_data["payment_method"],
                user=request.user,
                request=request,
            )
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Payment completed for Order #{order.order_number}.",
                "data": OrderDetailSerializer(order).data,
            },
            status=status.HTTP_200_OK,
        )
