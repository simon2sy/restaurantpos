import json

from channels.generic.websocket import AsyncWebsocketConsumer


class KitchenConsumer(AsyncWebsocketConsumer):

    async def connect(self):

        self.room_group_name = "kitchen"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def kitchen_order(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "new_order",
                "batch_id": event["batch_id"],
                "batch_number": event["batch_number"],
                "order_number": event["order_number"],
                "table": event["table"],
                "cabin": event["cabin"],
                "items": event["items"],
                "order_type": event.get("order_type"),
                "delivery": event.get("delivery"),
            })
        )

    async def kitchen_status(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "batch_status",
                "batch_id": event["batch_id"],
                "status": event["status"],
            })
        )


class WaiterConsumer(AsyncWebsocketConsumer):
    """Pushes 'food ready' notifications to waiter dashboards."""

    async def connect(self):

        self.room_group_name = "waiters"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def order_ready(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "order_ready",
                "order_number": event["order_number"],
                "table": event.get("table"),
                "cabin": event.get("cabin"),
                "delivery": event.get("delivery"),
                "ready_at": event.get("ready_at"),
            })
        )


class DashboardConsumer(AsyncWebsocketConsumer):
    """Pushes 'stats_updated' pings to admin dashboards whenever
    orders / payments / expenses change, so the UI can refetch live."""

    async def connect(self):
        self.room_group_name = "dashboard"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def dashboard_update(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "stats_updated",
                "reason": event.get("reason", ""),
            })
        )