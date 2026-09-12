import json

from channels.generic.websocket import AsyncWebsocketConsumer

from core.tenant import get_ws_tenant, ws_tenant_group


class KitchenConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # SECURITY: Derive restaurant from the authenticated user's profile,
        # NOT from the URL. This prevents a Restaurant A user from joining
        # Restaurant B's kitchen group by manipulating the URL.
        self.restaurant = await get_ws_tenant(self.scope)

        if self.restaurant is None:
            # Reject connection if user has no valid restaurant assignment
            await self.close(code=4001)
            return

        self.room_group_name = ws_tenant_group(self.restaurant, "kitchen")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):

        if hasattr(self, "room_group_name"):
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
        # SECURITY: Derive restaurant from the authenticated user's profile
        self.restaurant = await get_ws_tenant(self.scope)

        if self.restaurant is None:
            await self.close(code=4001)
            return

        self.room_group_name = ws_tenant_group(self.restaurant, "waiters")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):

        if hasattr(self, "room_group_name"):
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

    async def order_served(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "order_served",
                "order_number": event["order_number"],
            })
        )


class DashboardConsumer(AsyncWebsocketConsumer):
    """Pushes 'stats_updated' pings to admin dashboards whenever
    orders / payments / expenses change, so the UI can refetch live.
    Also sends real-time payment notifications when payments are received."""

    async def connect(self):
        # SECURITY: Derive restaurant from the authenticated user's profile
        self.restaurant = await get_ws_tenant(self.scope)

        if self.restaurant is None:
            await self.close(code=4001)
            return

        self.room_group_name = ws_tenant_group(self.restaurant, "dashboard")
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):

        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def dashboard_update(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "stats_updated",
                "reason": event.get("reason", ""),
            })
        )

    async def payment_received(self, event):
        """Send real-time payment notification to dashboard."""
        await self.send(
            text_data=json.dumps({
                "type": "payment_received",
                "order_id": event.get("order_id"),
                "order_number": event.get("order_number"),
                "payment_method": event.get("payment_method"),
                "total": event.get("total"),
                "payer_name": event.get("payer_name"),
                "location": event.get("location"),
                "message": event.get("message"),
            })
        )
