"""Set a known password for the main superuser account."""
from django.contrib.auth.models import User

admin = User.objects.filter(username="restaurant").first()
if admin:
    admin.set_password("Admin@123")
    admin.is_superuser = True
    admin.is_staff = True
    admin.is_active = True
    admin.save()
    print("restaurant password reset to Admin@123")
else:
    print("no user named restaurant")
