from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import DeviceToken


class DeviceTokenRegisterView(APIView):
    """POST /api/v1/notifications/device-token/

    Register a device token (Expo push token) for the authenticated user.
    If the token already exists, reactivate it and update the platform.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token", "").strip()
        platform = request.data.get("platform", "android").strip()

        if not token:
            return Response(
                {"success": False, "message": "Token is required.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if platform not in ("android", "ios", "web"):
            return Response(
                {"success": False, "message": "Platform must be android, ios, or web.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device_token, created = DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "is_active": True,
            },
        )

        action = "registered" if created else "updated"
        return Response(
            {
                "success": True,
                "message": f"Device token {action}.",
                "data": {
                    "id": device_token.id,
                    "platform": device_token.platform,
                },
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DeviceTokenDeleteView(APIView):
    """DELETE /api/v1/notifications/device-token/

    Deactivate the device token (e.g. on logout).
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        token = request.data.get("token", "").strip()

        if not token:
            return Response(
                {"success": False, "message": "Token is required.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = DeviceToken.objects.filter(
            token=token,
            user=request.user,
        ).update(is_active=False)

        return Response(
            {
                "success": True,
                "message": "Device token deactivated." if deleted_count else "Token not found.",
            },
            status=status.HTTP_200_OK,
        )
