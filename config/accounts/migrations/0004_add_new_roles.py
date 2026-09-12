from django.db import migrations, models


class Migration(migrations.Migration):
    """Add PLATFORM_ADMIN and RESTAURANT_ADMIN role choices.

    This is a no-op for the database schema (CharField choices are enforced
    at the application level), but Django tracks it for consistency.
    """

    dependencies = [
        ("accounts", "0003_multi_restaurant_support"),
    ]

    operations = [
        migrations.AlterField(
            model_name="employeeprofile",
            name="role",
            field=models.CharField(
                choices=[
                    ("PLATFORM_ADMIN", "Platform Admin"),
                    ("RESTAURANT_ADMIN", "Restaurant Admin"),
                    ("MANAGER", "Manager"),
                    ("WAITER", "Waiter"),
                    ("KITCHEN", "Kitchen"),
                    ("DELIVERY", "Delivery"),
                    ("CASHIER", "Cashier"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="restaurantemployee",
            name="role",
            field=models.CharField(
                choices=[
                    ("PLATFORM_ADMIN", "Platform Admin"),
                    ("RESTAURANT_ADMIN", "Restaurant Admin"),
                    ("MANAGER", "Manager"),
                    ("WAITER", "Waiter"),
                    ("KITCHEN", "Kitchen"),
                    ("DELIVERY", "Delivery"),
                    ("CASHIER", "Cashier"),
                ],
                max_length=20,
            ),
        ),
    ]

