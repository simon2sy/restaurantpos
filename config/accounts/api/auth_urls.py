from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "auth_api"

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("register/", views.CustomerRegisterAPIView.as_view(), name="register"),
    path("me/", views.ProfileView.as_view(), name="me"),
    path("password/change/", views.PasswordChangeAPIView.as_view(), name="password_change"),
    path("qr-login/", views.QRLoginAPIView.as_view(), name="qr_login"),
]
