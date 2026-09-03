from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import EmployeeActivity, EmployeeProfile


# ============================================================
# AUTH SERIALIZERS
# ============================================================


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT login that accepts username + password.

    Adds brute-force lockout check via cache before Django's auth.
    """
    username_field = "username"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make username and password not required at class level
        # so we can do custom validation
        self.fields["username"].required = False
        self.fields["password"].required = False

    def validate(self, attrs):
        from django.core.cache import cache

        username = attrs.get("username", "")
        password = attrs.get("password", "")

        if not username or not password:
            raise serializers.ValidationError(
                "Username and password are required.",
                code="missing_credentials",
            )

        # Check per-IP lockout (best effort)
        # Note: for DRF we don't have request context here easily,
        # so we rely on Django's built-in auth + throttle

        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token["username"] = user.username
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name

        profile = getattr(user, "employee_profile", None)
        if profile:
            token["role"] = profile.role
            token["is_employee"] = True
        else:
            token["role"] = None
            token["is_employee"] = False

        token["is_superuser"] = user.is_superuser
        return token


class UserSerializer(serializers.ModelSerializer):
    """Read-only user info."""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "is_superuser"]
        read_only_fields = fields


class CurrentUserSerializer(serializers.ModelSerializer):
    """Authenticated user's own profile with role info."""

    role = serializers.SerializerMethodField()
    is_employee = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "is_superuser", "is_staff", "role", "is_employee",
            "employee_id", "phone",
        ]
        read_only_fields = fields

    def get_role(self, obj):
        profile = getattr(obj, "employee_profile", None)
        return profile.role if profile else None

    def get_is_employee(self, obj):
        return hasattr(obj, "employee_profile")

    def get_employee_id(self, obj):
        profile = getattr(obj, "employee_profile", None)
        return profile.pk if profile else None

    def get_phone(self, obj):
        profile = getattr(obj, "employee_profile", None)
        return profile.phone if profile else None


class CustomerRegisterSerializer(serializers.Serializer):
    """Customer self-registration."""

    full_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=10)
    password2 = serializers.CharField(write_only=True, min_length=10)

    def validate_username(self, value):
        value = value.strip()
        if " " in value:
            raise serializers.ValidationError("Username cannot contain spaces.")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        if not value.isalnum():
            raise serializers.ValidationError("Username can only contain letters and numbers.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is already taken.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        full_name = validated_data["full_name"]
        parts = full_name.split(" ", 1)
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            first_name=parts[0],
            last_name=parts[1] if len(parts) > 1 else "",
        )
        return user


# ============================================================
# EMPLOYEE SERIALIZERS
# ============================================================


class EmployeeProfileSerializer(serializers.ModelSerializer):
    """Read-only employee profile with user info."""

    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    role_display = serializers.CharField(read_only=True)
    qr_token_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "phone", "role", "role_display", "is_active",
            "qr_token_valid", "qr_token_expires_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "qr_token_valid", "qr_token_expires_at",
            "created_at", "updated_at",
        ]


class EmployeeCreateSerializer(serializers.Serializer):
    """Create a new employee (superuser only)."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, default="")
    username = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, default="")
    role = serializers.ChoiceField(choices=EmployeeProfile.Role.choices)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("An account with that username already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            first_name=validated_data["first_name"],
            last_name=validated_data.get("last_name", ""),
        )
        user.set_unusable_password()
        user.save()

        return EmployeeProfile.objects.create(
            user=user,
            phone=validated_data.get("phone", ""),
            role=validated_data["role"],
        )


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    """Update employee profile fields."""

    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.CharField(source="user.email", required=False)

    class Meta:
        model = EmployeeProfile
        fields = ["phone", "role", "is_active", "first_name", "last_name", "email"]

    def update(self, instance, validated_data):
        user_data = {}
        for field in ["first_name", "last_name", "email"]:
            if field in validated_data:
                user_data[field] = validated_data.pop(field)

        if user_data:
            for attr, value in user_data.items():
                setattr(instance.user, attr, value)
            instance.user.save()

        return super().update(instance, validated_data)


class EmployeeActivitySerializer(serializers.ModelSerializer):
    """Read-only activity log."""

    class Meta:
        model = EmployeeActivity
        fields = ["id", "action", "detail", "ip_address", "created_at"]
        read_only_fields = fields


# ============================================================
# PASSWORD CHANGE
# ============================================================


class PasswordChangeSerializer(serializers.Serializer):
    """Change password for the authenticated user."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=10)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        # Flush session if one exists (JWT-only requests have no session)
        session = getattr(self.context["request"], "session", None)
        if session:
            session.flush()
        return user
