from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import EmployeeProfile
from core.api_permissions import IsAnyStaff, IsDeliveryRole, IsSuperUserOrManager
from delivery.models import Delivery, DeliveryPerson
from delivery.services import (
    assign_delivery,
    change_delivery_status,
    confirm_delivery,
    get_due_deliveries,
)
from menu.models import MenuItem
from orders.models import Order, PaymentMethod
from orders.services import create_order, create_order_batch

from .serializers import (
    AssignDeliverySerializer,
    CreateDeliveryOrderSerializer,
    DeliveryPersonSerializer,
    DeliverySerializer,
    DeliveryStatusSerializer,
)


# ============================================================
# DELIVERY PERSON CRUD
# ============================================================


class DeliveryPersonListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/delivery/persons/"""

    serializer_class = DeliveryPersonSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return DeliveryPerson.objects.filter(is_active=True).order_by("name")


class DeliveryPersonDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/delivery/persons/<pk>/"""

    queryset = DeliveryPerson.objects.all()
    serializer_class = DeliveryPersonSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]


# ============================================================
# DELIVERY ORDERS
# ============================================================


class DeliveryListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/delivery/

    List all deliveries or create a new delivery order.
    """

    serializer_class = DeliverySerializer

    def get_permissions(self):
        return [IsAnyStaff()]

    def get_queryset(self):
        qs = Delivery.objects.select_related("order", "assigned_person").order_by("-created_at")
        delivery_status = self.request.query_params.get("status")
        if delivery_status:
            qs = qs.filter(status=delivery_status)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateDeliveryOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid data.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Resolve menu items
        items = []
        for item_data in data["items"]:
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
            # Create delivery order
            order = create_order(
                user=request.user,
                order_type=Order.OrderType.DELIVERY,
            )
            order.save(update_fields=["order_type"])

            # Create delivery record
            delivery = Delivery.objects.create(
                order=order,
                customer_name=data["customer_name"],
                customer_phone=data["customer_phone"],
                address=data["address"],
                landmark=data.get("landmark", ""),
                delivery_fee=data.get("delivery_fee", 0),
            )

            # Create food batch
            create_order_batch(order=order, items=items)

            # Apply delivery fee and payment method
            order.delivery_fee = delivery.delivery_fee
            order.total = order.total + delivery.delivery_fee
            order.payment_method = PaymentMethod.COD
            order.payment_status = Order.PaymentStatus.UNPAID
            order.save(update_fields=["delivery_fee", "total", "payment_method", "payment_status"])

        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Delivery order #{order.order_number} created.",
                "data": DeliverySerializer(delivery).data,
            },
            status=status.HTTP_201_CREATED,
        )


class DeliveryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET /api/v1/delivery/<pk>/"""

    queryset = Delivery.objects.select_related("order", "assigned_person")
    serializer_class = DeliverySerializer
    permission_classes = [IsAnyStaff]


# ============================================================
# DUE DELIVERIES
# ============================================================


class DueDeliveriesView(APIView):
    """GET /api/v1/delivery/due/

    Returns all deliveries that are pending, assigned, or out for delivery.
    """

    permission_classes = [IsAnyStaff]

    def get(self, request):
        deliveries = get_due_deliveries()
        return Response(
            {
                "success": True,
                "message": "Due deliveries loaded.",
                "data": DeliverySerializer(deliveries, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# ASSIGN DELIVERY
# ============================================================


class AssignDeliveryView(APIView):
    """POST /api/v1/delivery/<pk>/assign/

    Assign a delivery person to a delivery.
    """

    permission_classes = [IsSuperUserOrManager]

    def post(self, request, pk):
        try:
            delivery = Delivery.objects.get(pk=pk)
        except Delivery.DoesNotExist:
            return Response(
                {"success": False, "message": "Delivery not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AssignDeliverySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid data.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            person = DeliveryPerson.objects.get(
                pk=serializer.validated_data["delivery_person_id"], is_active=True
            )
        except DeliveryPerson.DoesNotExist:
            return Response(
                {"success": False, "message": "Delivery person not found or inactive.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            assign_delivery(delivery, person)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Delivery assigned to {person.name}.",
                "data": DeliverySerializer(delivery).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# CHANGE DELIVERY STATUS
# ============================================================


class DeliveryStatusChangeView(APIView):
    """PATCH /api/v1/delivery/<pk>/status/

    Change delivery status (e.g. OUT_FOR_DELIVERY, DELIVERED).
    """

    permission_classes = [IsAnyStaff]

    def patch(self, request, pk):
        try:
            delivery = Delivery.objects.get(pk=pk)
        except Delivery.DoesNotExist:
            return Response(
                {"success": False, "message": "Delivery not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = DeliveryStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid data.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_status = serializer.validated_data["status"]

        try:
            if new_status == Delivery.Status.DELIVERED:
                confirm_delivery(delivery)
            else:
                change_delivery_status(delivery, new_status)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Delivery status changed to {new_status}.",
                "data": DeliverySerializer(delivery).data,
            },
            status=status.HTTP_200_OK,
        )
