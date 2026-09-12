# Add restaurant FK to EmployeeProfile and create RestaurantEmployee model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_multi_restaurant_support'),
        ('accounts', '0002_employeeprofile_qr_token_expires_at_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeprofile',
            name='restaurant',
            field=models.ForeignKey(
                blank=True,
                help_text='The restaurant this employee belongs to.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='employees',
                to='core.restaurant',
            ),
        ),
        migrations.CreateModel(
            name='RestaurantEmployee',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    choices=[
                        ('MANAGER', 'Manager'),
                        ('WAITER', 'Waiter'),
                        ('KITCHEN', 'Kitchen'),
                        ('DELIVERY', 'Delivery'),
                        ('CASHIER', 'Cashier'),
                    ],
                    max_length=20,
                )),
                ('is_active', models.BooleanField(default=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='restaurant_employees', to='core.restaurant')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='restaurant_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Restaurant Employee',
                'verbose_name_plural': 'Restaurant Employees',
                'unique_together': {('restaurant', 'user')},
            },
        ),
        migrations.AlterField(
            model_name='employeeprofile',
            name='qr_token',
            field=models.UUIDField(blank=True, editable=False, null=True),
        ),
    ]
