# Multi-restaurant support migration
# Adds Restaurant model, restaurant FK to AuditLog, Notification,
# and transforms RestaurantSettings to use restaurant as primary key.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_add_device_token_model'),
    ]

    operations = [
        # Create the Restaurant model
        migrations.CreateModel(
            name='Restaurant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='Restaurant POS', max_length=200)),
                ('address', models.TextField(blank=True)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('logo', models.ImageField(blank=True, null=True, upload_to='restaurants/logos/')),
                ('opening_hours', models.CharField(blank=True, max_length=200)),
                ('default_delivery_fee', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('receipt_footer', models.CharField(blank=True, max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('is_default', models.BooleanField(default=False, help_text='If true, this restaurant is used as fallback for legacy data.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Restaurant',
                'verbose_name_plural': 'Restaurants',
                'ordering': ['name'],
            },
        ),
        # Add restaurant FK to AuditLog (nullable for backwards compat)
        migrations.AddField(
            model_name='auditlog',
            name='restaurant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='audit_logs',
                to='core.restaurant',
            ),
        ),
        # Add restaurant FK to Notification (nullable for backwards compat)
        migrations.AddField(
            model_name='notification',
            name='restaurant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='core.restaurant',
            ),
        ),
    ]
