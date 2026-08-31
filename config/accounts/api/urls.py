from django.urls import path

from . import views

app_name = "accounts_api"

urlpatterns = [
    path("employees/", views.EmployeeListCreateView.as_view(), name="employee_list"),
    path("employees/<int:pk>/", views.EmployeeDetailView.as_view(), name="employee_detail"),
    path("employees/<int:pk>/toggle/", views.EmployeeToggleView.as_view(), name="employee_toggle"),
    path("employees/<int:pk>/qr/", views.EmployeeQRView.as_view(), name="employee_qr"),
    path("employees/<int:pk>/qr/image/", views.EmployeeQRImageView.as_view(), name="employee_qr_image"),
    path("employees/<int:pk>/activities/", views.EmployeeActivityListView.as_view(), name="employee_activities"),
]
