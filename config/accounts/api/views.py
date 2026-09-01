from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.models import EmployeeActivity, EmployeeProfile
from accounts.services import build_qr_png_response, generate_employee_qr, record_activity
from core.api_permissions import IsSuperUser, IsSuperUserOrManager

from .serializers import (
    CurrentUserSerializer,
    CustomerRegisterSerializer,
    EmployeeActivitySerializer,
    EmployeeCreateSerializer,
    EmployeeProfileSerializer,
    EmployeeUpdateSerializer,
    PasswordChangeSerializer,
)


# ============================================================
# AUTH ENDPOINTS
# ============================================================


class LoginView(APIView):
    """JWT login endpoint.

    POST /api/v1/auth/login/
    Body: { "username": "...", "password": "..." }
    Returns: { "access": "...", "refresh": "...", "user": {...} }
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = ["rest_framework.throttling.AnonRateThrottle"]

    def post(self, request):
        from django.core.cache import cache

        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not username or not password:
            return Response(
                {
                    "success": False,
                    "message": "Username and password are required.",
                    "errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check per-user lockout
        lockout_key = f"user_lockout_{username}"
        if cache.get(lockout_key, 0) >= 5:
            return Response(
                {
                    "success": False,
                    "message": "Too many failed sign-in attempts. Please try again in 15 minutes.",
                    "errors": {},
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = authenticate(username=username, password=password)

        if user is None:
            # Record failure
            attempts = cache.get(lockout_key, 0)
            cache.set(lockout_key, attempts + 1, 900)

            return Response(
                {
                    "success": False,
                    "message": "Invalid credentials.",
                    "errors": {},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {
                    "success": False,
                    "message": "Account is disabled.",
                    "errors": {},
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check employee profile is active (if exists)
        profile = getattr(user, "employee_profile", None)
        if profile and not profile.is_active:
            return Response(
                {
                    "success": False,
                    "message": "Employee account is disabled.",
                    "errors": {},
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Clear lockout on success
        cache.delete(lockout_key)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        # Add custom claims
        access_token["username"] = user.username
        access_token["first_name"] = user.first_name
        access_token["last_name"] = user.last_name
        if profile:
            access_token["role"] = profile.role
            access_token["is_employee"] = True
        else:
            access_token["role"] = None
            access_token["is_employee"] = False
        access_token["is_superuser"] = user.is_superuser

        # Record activity
        if profile:
            record_activity(
                profile, "API_LOGIN",
                detail=f"API login from {request.META.get('REMOTE_ADDR', 'unknown')}",
            )

        return Response(
            {
                "success": True,
                "message": "Login successful.",
                "data": {
                    "access": str(access_token),
                    "refresh": str(refresh),
                    "user": CurrentUserSerializer(user).data,
                },
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """Logout endpoint — blacklists the refresh token.

    POST /api/v1/auth/logout/
    Body: { "refresh": "..." }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        profile = getattr(request.user, "employee_profile", None)
        if profile:
            record_activity(
                profile, "API_LOGOUT",
                detail="Session terminated via API.",
            )

        return Response(
            {
                "success": True,
                "message": "Logged out successfully.",
                "errors": {},
            },
            status=status.HTTP_200_OK,
        )


class ProfileView(APIView):
    """GET /api/v1/auth/me/ — Returns the authenticated user's profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "success": True,
                "message": "Profile retrieved.",
                "data": CurrentUserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )


class PasswordChangeAPIView(APIView):
    """POST /api/v1/auth/password/change/"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "success": True,
                    "message": "Password changed successfully.",
                    "errors": {},
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                "success": False,
                "message": "Password change failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class CustomerRegisterAPIView(APIView):
    """POST /api/v1/auth/register/ — Public customer registration."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = ["rest_framework.throttling.AnonRateThrottle"]

    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            access_token["username"] = user.username
            access_token["first_name"] = user.first_name
            access_token["last_name"] = user.last_name
            access_token["role"] = None
            access_token["is_employee"] = False
            access_token["is_superuser"] = False

            return Response(
                {
                    "success": True,
                    "message": "Registration successful.",
                    "data": {
                        "access": str(access_token),
                        "refresh": str(refresh),
                        "user": CurrentUserSerializer(user).data,
                    },
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {
                "success": False,
                "message": "Registration failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# EMPLOYEE MANAGEMENT (superuser only)
# ============================================================


class EmployeeListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/accounts/employees/

    List all employees (GET) or create one (POST).
    """

    queryset = EmployeeProfile.objects.select_related("user").order_by("user__first_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeCreateSerializer
        return EmployeeProfileSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUser()]
        return [IsSuperUserOrManager()]

    def create(self, request, *args, **kwargs):
        create_serializer = EmployeeCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        employee = create_serializer.save()
        record_activity(employee, "EMPLOYEE_CREATED", detail="Employee profile created via API.")
        return Response(
            {
                "success": True,
                "message": f"Employee '{employee}' created successfully.",
                "data": EmployeeProfileSerializer(employee).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def get_queryset(self):
        qs = EmployeeProfile.objects.select_related("user").order_by("user__first_name")
        # Non-superuser managers can only see active employees
        if not self.request.user.is_superuser:
            qs = qs.filter(is_active=True)
        return qs


class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/accounts/employees/<pk>/"""

    queryset = EmployeeProfile.objects.select_related("user")
    serializer_class = EmployeeProfileSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUser()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUser()]
        return [IsSuperUserOrManager()]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeUpdateSerializer
        return EmployeeProfileSerializer

    def perform_destroy(self, instance):
        # Never allow deleting the last active admin
        if instance.user.is_superuser and instance.is_active:
            active_superusers = EmployeeProfile.objects.filter(
                user__is_superuser=True, is_active=True,
            ).exclude(pk=instance.pk).count()
            if active_superusers == 0:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Cannot delete the last active administrator.")
        instance.user.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"success": True, "message": "Employee deleted.", "errors": {}},
            status=status.HTTP_200_OK,
        )


class EmployeeToggleView(APIView):
    """POST /api/v1/accounts/employees/<pk>/toggle/ — Enable/disable employee."""

    permission_classes = [IsSuperUser]

    def post(self, request, pk):
        try:
            employee = EmployeeProfile.objects.select_related("user").get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {"success": False, "message": "Employee not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Never disable the last active admin
        if employee.user.is_superuser and employee.is_active:
            active_superusers = EmployeeProfile.objects.filter(
                user__is_superuser=True, is_active=True,
            ).exclude(pk=employee.pk).count()
            if active_superusers == 0:
                return Response(
                    {"success": False, "message": "Cannot disable the last active administrator.", "errors": {}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        employee.is_active = not employee.is_active
        employee.save(update_fields=["is_active"])

        action = "EMPLOYEE_DISABLED" if not employee.is_active else "EMPLOYEE_ENABLED"
        record_activity(employee, action, detail=f"Employee {'disabled' if not employee.is_active else 'enabled'} via API.")

        return Response(
            {
                "success": True,
                "message": f"Employee is now {'active' if employee.is_active else 'disabled'}.",
                "data": EmployeeProfileSerializer(employee).data,
            },
            status=status.HTTP_200_OK,
        )


class EmployeeQRView(APIView):
    """GET/POST /api/v1/accounts/employees/<pk>/qr/

    GET: Get current QR info
    POST: Generate/regenerate/revoke QR
    """

    permission_classes = [IsSuperUser]

    def get(self, request, pk):
        try:
            employee = EmployeeProfile.objects.select_related("user").get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {"success": False, "message": "Employee not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "success": True,
                "message": "QR info retrieved.",
                "data": {
                    "employee_id": employee.pk,
                    "qr_token": str(employee.qr_token) if employee.qr_token else None,
                    "qr_token_valid": employee.qr_token_valid,
                    "qr_token_expires_at": employee.qr_token_expires_at,
                },
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        try:
            employee = EmployeeProfile.objects.select_related("user").get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {"success": False, "message": "Employee not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        action = request.data.get("action", "generate")

        if action in ("generate", "regenerate"):
            token = employee.rotate_qr_token()
            activity = "QR_GENERATED" if action == "generate" else "QR_REGENERATED"
            record_activity(employee, activity, detail=f"QR code {action}d via API.")

            return Response(
                {
                    "success": True,
                    "message": f"QR code generated.",
                    "data": {
                        "qr_token": str(token),
                        "qr_token_expires_at": employee.qr_token_expires_at,
                    },
                },
                status=status.HTTP_200_OK,
            )
        elif action == "revoke":
            employee.revoke_qr_token()
            record_activity(employee, "QR_REVOKED", detail="QR code revoked via API.")

            return Response(
                {
                    "success": True,
                    "message": "QR code revoked.",
                    "errors": {},
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"success": False, "message": "Invalid action. Use: generate, regenerate, or revoke.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class EmployeeQRImageView(APIView):
    """GET /api/v1/accounts/employees/<pk>/qr/image/

    Returns the employee's login QR code as a PNG image.
    If the employee has no valid token yet, one is generated first.
    """

    permission_classes = [IsSuperUser]

    def get(self, request, pk):
        try:
            employee = EmployeeProfile.objects.select_related("user").get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return Response(
                {"success": False, "message": "Employee not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return build_qr_png_response(employee, request)


class QRLoginAPIView(APIView):
    """POST /api/v1/auth/qr-login/

    Authenticate via QR token — same logic as web qr_login view.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = ["rest_framework.throttling.AnonRateThrottle"]

    def post(self, request):
        from django.core.cache import cache
        from django.contrib.auth import login

        token = request.data.get("token", "").strip()

        # Rate limit
        ip = request.META.get("REMOTE_ADDR", "0.0.0.0")
        rate_key = f"api_qr_login_{ip}"
        if cache.get(rate_key, 0) >= 5:
            return Response(
                {"success": False, "message": "Too many attempts. Try again later.", "errors": {}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Validate UUID format
        import uuid as _uuid
        try:
            token_uuid = _uuid.UUID(token)
        except (ValueError, AttributeError):
            cache.set(rate_key, cache.get(rate_key, 0) + 1, 900)
            return Response(
                {"success": False, "message": "Invalid QR token format.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = EmployeeProfile.objects.select_related("user").get(qr_token=token_uuid)
        except EmployeeProfile.DoesNotExist:
            cache.set(rate_key, cache.get(rate_key, 0) + 1, 900)
            return Response(
                {"success": False, "message": "Invalid or expired QR code.", "errors": {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not employee.qr_token_valid:
            cache.set(rate_key, cache.get(rate_key, 0) + 1, 900)
            return Response(
                {"success": False, "message": "Invalid or expired QR code.", "errors": {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Issue JWT tokens
        user = employee.user
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        access_token["username"] = user.username
        access_token["first_name"] = user.first_name
        access_token["last_name"] = user.last_name
        access_token["role"] = employee.role
        access_token["is_employee"] = True
        access_token["is_superuser"] = user.is_superuser

        record_activity(employee, "QR_LOGIN", detail="Employee authenticated via QR API.")

        cache.delete(rate_key)

        return Response(
            {
                "success": True,
                "message": "QR login successful.",
                "data": {
                    "access": str(access_token),
                    "refresh": str(refresh),
                    "user": CurrentUserSerializer(user).data,
                },
            },
            status=status.HTTP_200_OK,
        )


class EmployeeActivityListView(generics.ListAPIView):
    """GET /api/v1/accounts/employees/<pk>/activities/"""

    serializer_class = EmployeeActivitySerializer
    permission_classes = [IsSuperUserOrManager]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return EmployeeActivity.objects.filter(employee_id=pk).order_by("-created_at")[:50]
