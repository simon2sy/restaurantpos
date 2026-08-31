from io import BytesIO

import qrcode
from django.http import HttpResponse
from django.urls import reverse


def get_login_url_for_token(request, token):
    """Absolute secure login URL embedded in the QR.

    Only a token is present in the QR - no sensitive data.
    """
    return request.build_absolute_uri(
        reverse("accounts:qr_login", args=[token])
    )


def generate_employee_qr(employee, request):
    """Rotate the employee QR token and return (qr_image, login_url).

    The employee is recorded as having a fresh token. The returned QR is a
    PIL image. The login_url is the absolute URL encoded in it.
    """
    token = employee.rotate_qr_token()

    login_url = get_login_url_for_token(request, token)

    qr = qrcode.make(login_url)

    return qr, login_url


def build_qr_png_response(employee, request):
    """Render the employee's current QR as a PNG response.

    If there is no valid token yet, one is generated first. Otherwise the
    existing token is reused so the QR stays stable across views.
    """
    if employee.qr_token_valid:
        token = employee.qr_token
    else:
        token = employee.rotate_qr_token()

    login_url = get_login_url_for_token(request, token)

    qr = qrcode.make(login_url)

    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)

    return HttpResponse(
        buffer.getvalue(),
        content_type="image/png",
    )


def record_activity(employee, action, request=None, detail=""):
    """Persist an employee activity entry (best-effort, never raises)."""
    try:
        from .models import EmployeeActivity

        EmployeeActivity.objects.create(
            employee=employee,
            action=action,
            detail=detail,
            ip_address=_client_ip(request),
        )
    except Exception:
        # Activity logging should never break the primary flow.
        pass


def _client_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")