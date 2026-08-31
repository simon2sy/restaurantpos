from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api_permissions import IsAnyStaff
from core.models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    """GET /api/v1/notifications/

    Returns undismissed notifications for the authenticated user.
    Pass ?all=1 to include dismissed notifications.
    """

    permission_classes = [IsAnyStaff]

    def get(self, request):
        qs = Notification.objects.select_related("order").filter(dismissed=False)

        if request.query_params.get("all") == "1":
            qs = Notification.objects.select_related("order").all()

        notifications = qs[:50]  # safety cap

        return Response(
            {
                "success": True,
                "message": "Notifications loaded.",
                "data": NotificationSerializer(notifications, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationDismissView(APIView):
    """POST /api/v1/notifications/<id>/dismiss/

    Marks a single notification as dismissed.
    """

    permission_classes = [IsAnyStaff]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk)
        except Notification.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Notification not found.",
                    "errors": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not notification.dismissed:
            notification.dismiss()

        return Response(
            {
                "success": True,
                "message": "Notification dismissed.",
                "data": NotificationSerializer(notification).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationDismissAllView(APIView):
    """POST /api/v1/notifications/dismiss-all/

    Dismisses every undismissed notification at once —
    useful when the waiter has acknowledged all pending alerts.
    """

    permission_classes = [IsAnyStaff]

    def post(self, request):
        now = timezone.now()
        updated = Notification.objects.filter(dismissed=False).update(
            dismissed=True, dismissed_at=now
        )

        return Response(
            {
                "success": True,
                "message": f"{updated} notification(s) dismissed.",
                "data": {"dismissed_count": updated},
            },
            status=status.HTTP_200_OK,
        )
