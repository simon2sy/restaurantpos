from django.contrib.auth.decorators import login_required, user_passes_test
from django.urls import path
from . import views

from .permissions import MANAGEMENT_ROLES, role_required

app_name = "core"
urlpatterns = [
    path('',views.home,name="home"),
    path(
        'admin-dashboard/',
        login_required(role_required(*MANAGEMENT_ROLES)(views.admin_dashboard)),
        name="admin_dashboard",
    ),
]