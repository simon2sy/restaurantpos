from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.views import LoginView, LogoutView
from django.core.cache import cache
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters

from .forms import EmployeeCreateForm, EmployeeQRForm
from .models import EmployeeProfile, QR_TOKEN_VALIDITY_SECONDS
from .services import (
    build_qr_png_response,
    generate_employee_qr,
    record_activity,
)

# ------------------------------------------------------------------
# USERNAME / PASSWORD LOGIN & LOGOUT (hardened)
# ------------------------------------------------------------------

import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Brute-force protection: max failed logins per IP before lockout.
LOGIN_RATE_LIMIT = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 5)
LOGIN_LOCKOUT_SECONDS = getattr(settings, 'LOGIN_LOCKOUT_DURATION', 900)


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _login_attempts_key(ip):
    return f"login_failures_{ip}"


def _user_lockout_key(username):
    return f"user_lockout_{username}"


def _record_login_attempt(username, ip, success, user=None):
    """Record login attempt for security logging."""
    log_data = {
        'username': username,
        'ip_address': ip,
        'success': success,
        'timestamp': timezone.now().isoformat(),
    }
    if user:
        log_data['user_id'] = user.id

    if success:
        logger.info(f"Successful login: {username} from {ip}")
    else:
        logger.warning(f"Failed login attempt: {username} from {ip}")


def _check_user_lockout(username):
    """Check if a specific user account is locked out."""
    key = _user_lockout_key(username)
    return cache.get(key, 0) >= LOGIN_RATE_LIMIT


def _record_user_lockout(username):
    """Record a failed login attempt for a specific user."""
    key = _user_lockout_key(username)
    attempts = cache.get(key, 0)
    cache.set(key, attempts + 1, LOGIN_LOCKOUT_SECONDS)


def _clear_user_lockout(username):
    """Clear lockout for a user after successful login."""
    key = _user_lockout_key(username)
    cache.delete(key)


@method_decorator(sensitive_post_parameters(), name="dispatch")
@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class SecureLoginView(LoginView):
    """Login view with per-IP and per-user brute-force lockout.

    - Generic error messages only (no username enumeration).
    - Session key is rotated by Django's ``login()`` on success
      (prevents session fixation).
    - Successful login clears the failure counter.
    - Tracks both IP-based and user-based lockouts.
    """

    template_name = "registration/login.html"
    redirect_authenticated_user = True

    def dispatch(self, request, *args, **kwargs):
        ip = _client_ip(request)

        # Check IP-based rate limiting
        if (
            cache.get(_login_attempts_key(ip), 0)
            >= LOGIN_RATE_LIMIT
        ):
            logger.warning(f"IP rate limited: {ip}")
            return HttpResponse(
                "Too many failed sign-in attempts. "
                "Please try again in 15 minutes.",
                status=429,
            )

        # Check user-based rate limiting (if username is available)
        if request.method == 'POST':
            username = request.POST.get('username', '').strip()
            if username and _check_user_lockout(username):
                logger.warning(f"User account rate limited: {username}")
                # Still show generic message to prevent username enumeration
                return HttpResponse(
                    "Too many failed sign-in attempts. "
                    "Please try again in 15 minutes.",
                    status=429,
                )

        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        ip = _client_ip(self.request)
        username = form.cleaned_data.get('username', '')

        # Clear both IP and user lockout counters
        cache.delete(_login_attempts_key(ip))
        _clear_user_lockout(username)

        # Record successful login
        _record_login_attempt(username, ip, success=True, user=self.request.user)

        profile = getattr(self.request.user, "employee_profile", None)
        if profile is not None:
            record_activity(
                profile,
                "PASSWORD_LOGIN",
                self.request,
                detail=f"Employee authenticated with username/password from {ip}.",
            )
        else:
            # Customer login
            logger.info(f"Customer login: {username} from {ip}")

        return response

    def form_invalid(self, form):
        ip = _client_ip(self.request)
        username = form.cleaned_data.get('username', '') if hasattr(form, 'cleaned_data') else ''

        # Record failed attempt for IP
        key = _login_attempts_key(ip)
        attempts = cache.get(key, 0)
        cache.set(key, attempts + 1, LOGIN_LOCKOUT_SECONDS)

        # Record failed attempt for user (if username provided)
        if username:
            _record_user_lockout(username)

        # Record failed login attempt
        _record_login_attempt(username or 'unknown', ip, success=False)

        return super().form_invalid(form)


@method_decorator(never_cache, name="dispatch")
class SecureLogoutView(LogoutView):
    """Logout: POST-only (Django default), session flushed server-side."""

    def dispatch(self, request, *args, **kwargs):
        profile = getattr(request.user, "employee_profile", None) \
            if request.user.is_authenticated else None
        response = super().dispatch(request, *args, **kwargs)
        if profile is not None:
            record_activity(
                profile,
                "LOGOUT",
                request,
                detail="Session terminated.",
            )
        # Defence-in-depth: drop any leftover session data.
        if hasattr(request, "session"):
            request.session.flush()
        return response


# ------------------------------------------------------------------
# CUSTOMER REGISTRATION / LOGIN (public - for placing delivery orders)
# ------------------------------------------------------------------

# Registration rate limiting
REGISTER_RATE_LIMIT = 3  # Max registrations per IP per hour
REGISTER_LOCKOUT_SECONDS = 3600  # 1 hour


def _register_attempts_key(ip):
    return f"register_attempts_{ip}"


def register(request):
    """Public self-service sign-up for customers who want to place
    delivery orders. Customers get a normal user account WITHOUT an
    employee profile, so they only see the customer ordering area."""
    from django import forms
    from django.contrib.auth.models import User

    if request.user.is_authenticated:
        return redirect("core:home")

    # Check registration rate limiting
    ip = _client_ip(request)
    if cache.get(_register_attempts_key(ip), 0) >= REGISTER_RATE_LIMIT:
        messages.error(
            request,
            "Too many registration attempts. Please try again later.",
        )
        return redirect("accounts:login")

    class CustomerSignupForm(forms.Form):
        full_name = forms.CharField(
            max_length=150,
            widget=forms.TextInput(
                attrs={"placeholder": "Full name", "autofocus": True}
            ),
        )
        username = forms.CharField(
            max_length=150,
            widget=forms.TextInput(attrs={"placeholder": "Choose a username"}),
        )
        password1 = forms.CharField(
            label="Password",
            strip=False,
            widget=forms.PasswordInput(
                attrs={"placeholder": "Password", "autocomplete": "new-password"}
            ),
        )
        password2 = forms.CharField(
            label="Confirm password",
            strip=False,
            widget=forms.PasswordInput(
                attrs={
                    "placeholder": "Repeat password",
                    "autocomplete": "new-password",
                }
            ),
        )

        def clean_username(self):
            username = self.cleaned_data["username"].strip()
            if " " in username:
                raise forms.ValidationError("Username cannot contain spaces.")
            if len(username) < 3:
                raise forms.ValidationError("Username must be at least 3 characters.")
            if not username.isalnum():
                raise forms.ValidationError("Username can only contain letters and numbers.")
            if User.objects.filter(username__iexact=username).exists():
                raise forms.ValidationError("That username is already taken.")
            return username

        def clean(self):
            cleaned = super().clean()
            p1 = cleaned.get("password1")
            p2 = cleaned.get("password2")
            if p1 and p2 and p1 != p2:
                raise forms.ValidationError("Passwords do not match.")
            if p1:
                from django.contrib.auth.password_validation import validate_password

                validate_password(p1)
            return cleaned

    if request.method == "POST":
        form = CustomerSignupForm(request.POST)
        if form.is_valid():
            user = User.objects.create_user(
                username=form.cleaned_data["username"],
                password=form.cleaned_data["password1"],
                first_name=form.cleaned_data["full_name"].split(" ")[0],
                last_name=" ".join(form.cleaned_data["full_name"].split(" ")[1:]),
            )

            # Record successful registration
            logger.info(f"New customer registered: {user.username} from {ip}")

            # Clear rate limiting on success
            cache.delete(_register_attempts_key(ip))

            login(request, user)
            messages.success(
                request,
                "Welcome! Your account is ready — place your first order below.",
            )
            return redirect("delivery:create_order")
        else:
            # Record failed registration attempt
            key = _register_attempts_key(ip)
            attempts = cache.get(key, 0)
            cache.set(key, attempts + 1, REGISTER_LOCKOUT_SECONDS)
    else:
        form = CustomerSignupForm()

    return render(
        request,
        "accounts/register.html",
        {"form": form},
    )


def qr_entry(request):
    """Manual QR-code login: an employee types/pastes the code from their
    QR (e.g. when they cannot scan it on the same device). Redirects to the
    existing secure ``qr_login`` endpoint which performs all validation."""
    if request.method != "POST":
        return redirect("accounts:login")

    token = (request.POST.get("token") or "").strip()

    # Basic format check before redirecting - keeps the URL pattern happy.
    import uuid as _uuid

    try:
        validated = str(_uuid.UUID(token))
    except (ValueError, AttributeError):
        messages.error(
            request,
            "That doesn't look like a valid QR code.",
        )
        return redirect("accounts:login")

    return redirect("accounts:qr_login", token=validated)

# ------------------------------------------------------------------
# QR LOGIN (public - the token endpoint an employee scans)
# ------------------------------------------------------------------

# Maximum failed attempts from a single IP before rate limiting.
QR_LOGIN_RATE_LIMIT = 5
QR_LOGIN_WINDOW_SECONDS = 900  # 15 minutes


def _ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _log_failed_attempt(request):
    key = f"qr_login_{_ip(request)}"
    attempts = cache.get(key, 0)
    cache.set(key, attempts + 1, QR_LOGIN_WINDOW_SECONDS)


def qr_login(request, token):
    """Authenticate an employee from a scanned QR token.

    Validates server-side: token exists (not revoked), not expired, and both
    the employee profile and linked user are active. A session is created only
    after all checks pass. Attempts are rate-limited per IP.
    """
    if cache.get(f"qr_login_{_ip(request)}", 0) >= QR_LOGIN_RATE_LIMIT:
        return HttpResponse(
            "Too many attempts. Please try again later.",
            status=429,
        )

    try:
        employee = EmployeeProfile.objects.select_related("user").get(
            qr_token=token,
        )
    except EmployeeProfile.DoesNotExist:
        _log_failed_attempt(request)
        return HttpResponse(
            "Invalid or expired QR code.",
            status=403,
        )

    if not employee.qr_token_valid:
        _log_failed_attempt(request)
        return HttpResponse(
            "Invalid or expired QR code.",
            status=403,
        )

    # Token is valid - establish the session.
    login(request, employee.user)

    record_activity(
        employee,
        "QR_LOGIN",
        request,
        detail="Employee authenticated via QR.",
    )

    cache.delete(f"qr_login_{_ip(request)}")

    return redirect("core:home")
# ------------------------------------------------------------------
# ADMIN: EMPLOYEE MANAGEMENT (superuser only)
# ------------------------------------------------------------------

def _is_superuser(user):
    return user.is_authenticated and user.is_superuser


@login_required
@user_passes_test(_is_superuser)
def employee_list(request):
    employees = (
        EmployeeProfile.objects
        .select_related("user")
        .prefetch_related("activities")
        .order_by("user__first_name")
    )
    return render(
        request,
        "accounts/employee_list.html",
        {"employees": employees},
    )


@login_required
@user_passes_test(_is_superuser)
def employee_create(request):
    if request.method == "POST":
        form = EmployeeCreateForm(request.POST)
        if form.is_valid():
            employee = form.save()
            record_activity(
                employee,
                "EMPLOYEE_CREATED",
                request,
                "Employee profile created.",
            )
            messages.success(
                request,
                f"Added {employee.user.get_full_name()}. "
                "Generate a QR code to let them sign in.",
            )
            return redirect("accounts:employee_qr", pk=employee.pk)

        messages.error(request, "Please correct the errors below.")
    else:
        form = EmployeeCreateForm()

    return render(
        request,
        "accounts/employee_create.html",
        {"form": form},
    )


@login_required
@user_passes_test(_is_superuser)
def employee_toggle(request, pk):
    employee = get_object_or_404(
        EmployeeProfile.objects.select_related("user"),
        pk=pk,
    )

    if request.method == "POST":
        # Never disable the last active administrator.
        if employee.user.is_superuser and employee.is_active:
            active_superusers = EmployeeProfile.objects.filter(
                user__is_superuser=True,
                is_active=True,
            ).exclude(pk=employee.pk).count()
            if active_superusers == 0:
                messages.error(
                    request,
                    "Cannot disable the last active administrator.",
                )
                return redirect("accounts:employee_list")

        employee.is_active = not employee.is_active
        employee.save(update_fields=["is_active"])

        record_activity(
            employee,
            "EMPLOYEE_DISABLED" if not employee.is_active else "EMPLOYEE_ENABLED",
            request,
            f"Employee {'disabled' if not employee.is_active else 'enabled'}.",
        )

        messages.success(
            request,
            f"{employee.user.get_full_name()} is now "
            f"{'disabled' if not employee.is_active else 'active'}.",
        )

    return redirect("accounts:employee_list")


@login_required
@user_passes_test(_is_superuser)
def employee_qr(request, pk):
    employee = get_object_or_404(
        EmployeeProfile.objects.select_related("user"),
        pk=pk,
    )

    action_form = EmployeeQRForm(request.POST or None)

    if request.method == "POST" and action_form.is_valid():
        action = action_form.cleaned_data["action"]

        if action in ("generate", "regenerate"):
            generate_employee_qr(employee, request)
            record_activity(
                employee,
                "QR_GENERATED" if action == "generate" else "QR_REGENERATED",
                request,
            )
            messages.success(request, "QR code generated.")
        elif action == "revoke":
            employee.revoke_qr_token()
            record_activity(employee, "QR_REVOKED", request)
            messages.success(request, "QR code revoked.")

        return redirect("accounts:employee_qr", pk=employee.pk)

    if employee.qr_token_valid:
        qr_url = reverse("accounts:employee_qr_png", args=[employee.pk])
    else:
        qr_url = None

    return render(
        request,
        "accounts/employee_qr.html",
        {
            "employee": employee,
            "qr_url": qr_url,
            "validity_seconds": QR_TOKEN_VALIDITY_SECONDS,
            "activities": employee.activities.all()[:20],
            "form": action_form,
        },
    )


@login_required
@user_passes_test(_is_superuser)
def employee_qr_png(request, pk):
    employee = get_object_or_404(
        EmployeeProfile.objects.select_related("user"),
        pk=pk,
    )

    # build_qr_png_response generates a token only when none is valid.
    return build_qr_png_response(employee, request)


# ------------------------------------------------------------------
# PASSWORD CHANGE (authenticated users)
# ------------------------------------------------------------------

from django.contrib.auth.views import PasswordChangeView
from django.contrib.auth.forms import PasswordChangeForm


@method_decorator(login_required, name="dispatch")
class SecurePasswordChangeView(PasswordChangeView):
    """Secure password change view with additional security features."""

    form_class = PasswordChangeForm
    template_name = "accounts/password_change.html"
    success_url = reverse_lazy("accounts:password_change_done")

    def form_valid(self, form):
        response = super().form_valid(form)

        # Log the password change
        profile = getattr(self.request.user, "employee_profile", None)
        if profile:
            record_activity(
                profile,
                "PASSWORD_CHANGED",
                self.request,
                detail="Password changed successfully.",
            )

        # Invalidate all other sessions for this user (optional security measure)
        self.request.session.flush()

        messages.success(
            self.request,
            "Your password has been changed successfully.",
        )

        return response


from django.views.generic import TemplateView


@method_decorator(login_required, name="dispatch")
class PasswordChangeDoneView(TemplateView):
    """Password change confirmation page."""
    template_name = "accounts/password_change_done.html"


