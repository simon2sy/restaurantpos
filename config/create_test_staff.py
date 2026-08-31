"""One-off script: create test waiter and kitchen staff users."""
from django.contrib.auth.models import User
from accounts.models import EmployeeProfile

USERS = [
    # username, first, last, role, password
    ("waiter1", "Test", "Waiter", EmployeeProfile.Role.WAITER, "Waiter@123"),
    ("kitchen1", "Test", "Kitchen", EmployeeProfile.Role.KITCHEN, "Kitchen@123"),
]

for username, first, last, role, password in USERS:
    user, user_created = User.objects.get_or_create(
        username=username,
        defaults={
            "first_name": first,
            "last_name": last,
            "email": f"{username}@test.com",
        },
    )
    # Test accounts: always reset password/status so credentials are known
    user.set_password(password)
    user.is_staff = True
    user.is_active = True
    user.save()

    profile, profile_created = EmployeeProfile.objects.get_or_create(
        user=user,
        defaults={"role": role, "phone": "9999999999", "is_active": True},
    )
    if not profile_created and profile.role != role:
        profile.role = role
        profile.save(update_fields=["role"])

    print(
        f"{username}: user={'created' if user_created else 'exists'}, "
        f"profile={'created' if profile_created else 'exists'}, role={profile.role}"
    )

print("\nAll employee profiles now in DB:")
for uname, r in EmployeeProfile.objects.values_list("user__username", "role"):
    print(f"  {uname} -> {r}")
