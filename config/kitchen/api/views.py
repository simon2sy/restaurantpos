from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api_permissions import IsKitchenRole
from orders.models import OrderBatch

from kitchen.services import mark_batch_ready, start_batch, complete_batch

from .serializers import KitchenBatchSerializer


class KitchenDashboardView(APIView):
    """GET /api/v1/kitchen/

    Returns all pending and preparing batches for the kitchen dashboard.
    """

    permission_classes = [IsKitchenRole]

    def get(self, request):
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
            .prefetch_related("items__menu_item")
            .order_by("created_at")
        )

        return Response(
            {
                "success": True,
                "message": "Kitchen dashboard loaded.",
                "data": KitchenBatchSerializer(batches, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class StartBatchView(APIView):
    """POST /api/v1/kitchen/batch/<batch_id>/start/

    Mark a batch as PREPARING.
    """

    permission_classes = [IsKitchenRole]

    def post(self, request, batch_id):
        try:
            batch = OrderBatch.objects.select_related("order").get(pk=batch_id)
        except OrderBatch.DoesNotExist:
            return Response(
                {"success": False, "message": "Batch not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            batch = start_batch(batch)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Batch #{batch.batch_number} started.",
                "data": KitchenBatchSerializer(batch).data,
            },
            status=status.HTTP_200_OK,
        )


class ReadyBatchView(APIView):
    """POST /api/v1/kitchen/batch/<batch_id>/ready/

    Mark a batch as READY (notifies waiters).
    """

    permission_classes = [IsKitchenRole]

    def post(self, request, batch_id):
        try:
            batch = OrderBatch.objects.select_related("order").get(pk=batch_id)
        except OrderBatch.DoesNotExist:
            return Response(
                {"success": False, "message": "Batch not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            batch = mark_batch_ready(batch)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Batch #{batch.batch_number} is ready.",
                "data": KitchenBatchSerializer(batch).data,
            },
            status=status.HTTP_200_OK,
        )


class CompleteBatchView(APIView):
    """POST /api/v1/kitchen/batch/<batch_id>/complete/

    Mark a batch as COMPLETED.
    """

    permission_classes = [IsKitchenRole]

    def post(self, request, batch_id):
        try:
            batch = OrderBatch.objects.select_related("order").get(pk=batch_id)
        except OrderBatch.DoesNotExist:
            return Response(
                {"success": False, "message": "Batch not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            batch = complete_batch(batch)
        except ValueError as e:
            return Response(
                {"success": False, "message": str(e), "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": f"Batch #{batch.batch_number} completed.",
                "data": KitchenBatchSerializer(batch).data,
            },
            status=status.HTTP_200_OK,
        )
