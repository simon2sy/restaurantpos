from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.api_permissions import IsSuperUser, IsSuperUserOrManager
from core.models import Restaurant, RestaurantSettings
from core.tenant import get_tenant


# ============================================================
# RESTAURANT SERIALIZERS
# ============================================================

class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "address", "phone", "logo",
            "opening_hours", "default_delivery_fee",
            "receipt_footer", "is_active", "is_default",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(
        source="restaurant.name", read_only=True
    )

    class Meta:
        model = RestaurantSettings
        fields = [
            "restaurant", "restaurant_name", "name", "address",
            "phone", "logo", "opening_hours",
            "default_delivery_fee", "receipt_footer",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ============================================================
# RESTAURANT VIEWS
# ============================================================

class RestaurantListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/restaurants/

    List restaurants or create a new one.

    SECURITY:
    - Superusers see all restaurants and can create new ones.
    - Platform admins see all restaurants.
    - Managers see only their own assigned restaurant.
    """

    serializer_class = RestaurantSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUser()]
        return [IsSuperUserOrManager()]

    def get_queryset(self):
        # Superusers and platform admins see all restaurants
        if self.request.user.is_superuser:
            return Restaurant.objects.all().order_by("name")

        profile = getattr(self.request.user, "employee_profile", None)
        if profile and profile.role == "PLATFORM_ADMIN":
            return Restaurant.objects.all().order_by("name")

        # Regular managers see only their own restaurant
        restaurant = get_tenant(self.request)
        if restaurant is not None:
            return Restaurant.objects.filter(pk=restaurant.pk)

        return Restaurant.objects.none()


class RestaurantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/restaurants/<pk>/

    SECURITY:
    - Superusers and platform admins can access any restaurant.
    - Managers can only access their own assigned restaurant.
    """

    serializer_class = RestaurantSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUser()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUser()]
        return [IsSuperUserOrManager()]

    def get_queryset(self):
        # Superusers and platform admins see all restaurants
        if self.request.user.is_superuser:
            return Restaurant.objects.all()

        profile = getattr(self.request.user, "employee_profile", None)
        if profile and profile.role == "PLATFORM_ADMIN":
            return Restaurant.objects.all()

        # Regular managers see only their own restaurant
        restaurant = get_tenant(self.request)
        if restaurant is not None:
            return Restaurant.objects.filter(pk=restaurant.pk)

        return Restaurant.objects.none()


class RestaurantSettingsView(APIView):
    """GET/PUT /api/v1/restaurants/<pk>/settings/

    Get or update restaurant-specific settings.

    SECURITY: Managers can only access settings for their own restaurant.
    """

    permission_classes = [IsSuperUserOrManager]

    def _get_user_restaurant(self, request, pk):
        """Get the restaurant only if the user has access to it."""
        # Superusers and platform admins can access any restaurant
        if request.user.is_superuser:
            return Restaurant.objects.filter(pk=pk).first()

        profile = getattr(request.user, "employee_profile", None)
        if profile and profile.role == "PLATFORM_ADMIN":
            return Restaurant.objects.filter(pk=pk).first()

        # Regular managers can only access their own restaurant
        restaurant = get_tenant(request)
        if restaurant is not None and restaurant.pk == pk:
            return restaurant

        return None

    def get(self, request, pk):
        restaurant = self._get_user_restaurant(request, pk)
        if restaurant is None:
            return Response(
                {"success": False, "message": "Restaurant not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        settings_obj = RestaurantSettings.get(restaurant)
        return Response(
            {
                "success": True,
                "message": "Restaurant settings loaded.",
                "data": {
                    "restaurant_id": restaurant.id,
                    "restaurant_name": restaurant.name,
                    "name": settings_obj.name,
                    "address": settings_obj.address,
                    "phone": settings_obj.phone,
                    "opening_hours": settings_obj.opening_hours,
                    "default_delivery_fee": str(settings_obj.default_delivery_fee),
                    "receipt_footer": settings_obj.receipt_footer,
                },
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request, pk):
        restaurant = self._get_user_restaurant(request, pk)
        if restaurant is None:
            return Response(
                {"success": False, "message": "Restaurant not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        settings_obj = RestaurantSettings.get(restaurant)

        for field in ["name", "address", "phone", "opening_hours", "receipt_footer"]:
            if field in request.data:
                setattr(settings_obj, field, request.data[field])

        if "default_delivery_fee" in request.data:
            settings_obj.default_delivery_fee = request.data["default_delivery_fee"]

        settings_obj.save()

        return Response(
            {
                "success": True,
                "message": "Restaurant settings updated.",
                "data": {
                    "restaurant_id": restaurant.id,
                    "restaurant_name": restaurant.name,
                    "name": settings_obj.name,
                    "address": settings_obj.address,
                    "phone": settings_obj.phone,
                    "opening_hours": settings_obj.opening_hours,
                    "default_delivery_fee": str(settings_obj.default_delivery_fee),
                    "receipt_footer": settings_obj.receipt_footer,
                },
            },
            status=status.HTTP_200_OK,
        )
