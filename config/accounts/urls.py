from django.urls import path

from . import views


app_name = "accounts"


urlpatterns = [
    path(
        "login/",
        views.SecureLoginView.as_view(),
        name="login",
    ),
    path(
        "logout/",
        views.SecureLogoutView.as_view(),
        name="logout",
    ),
    path(
        "qr/",
        views.qr_entry,
        name="qr_entry",
    ),
    path(
        "register/",
        views.register,
        name="register",
    ),
    path(
        "qr-login/<uuid:token>/",
        views.qr_login,
        name="qr_login",
    ),
    # ---- Password management ----
    path(
        "password/change/",
        views.SecurePasswordChangeView.as_view(),
        name="password_change",
    ),
    path(
        "password/change/done/",
        views.PasswordChangeDoneView.as_view(),
        name="password_change_done",
    ),
    # ---- Admin: employee management (superuser) ----
    path(
        "employees/",
        views.employee_list,
        name="employee_list",
    ),
    path(
        "employees/create/",
        views.employee_create,
        name="employee_create",
    ),
    path(
        "employees/<int:pk>/",
        views.employee_qr,
        name="employee_qr",
    ),
    path(
        "employees/<int:pk>/toggle/",
        views.employee_toggle,
        name="employee_toggle",
    ),
    path(
        "employees/<int:pk>/qr.png",
        views.employee_qr_png,
        name="employee_qr_png",
    ),
]