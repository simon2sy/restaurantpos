# Multi-restaurant support: add restaurant FK and field alterations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_multi_restaurant_support'),
        ('orders', '0005_order_orders_orde_order_t_1378c7_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='table',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tables',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name='table',
            unique_together={('restaurant', 'number')},
        ),
        migrations.AlterField(
            model_name='table',
            name='number',
            field=models.PositiveIntegerField(),
        ),
        migrations.AddField(
            model_name='cabin',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='cabins',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name='cabin',
            unique_together={('restaurant', 'number')},
        ),
        migrations.AlterField(
            model_name='cabin',
            name='number',
            field=models.PositiveIntegerField(),
        ),
        migrations.AddField(
            model_name='order',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='orders',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='order',
            name='order_number',
            field=models.PositiveIntegerField(editable=False),
        ),
        migrations.AlterField(
            model_name='order',
            name='payment_method',
            field=models.CharField(
                blank=True,
                choices=[('CASH', 'Cash'), ('COD', 'Cash on Delivery'), ('ONLINE', 'Online')],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='orderbatch',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='order_batches',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='orderitem',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='order_items',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
    ]
