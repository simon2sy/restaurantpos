from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, Client

from accounts.models import EmployeeProfile


def _make_user(username, password="Strong-Passw0rd!", **profile_kwargs):
    user = User.objects.create_user(
        username=username,
        password=password,
        first_name=username.title(),
    )
    if profile_kwargs is not None:
        EmployeeProfile.objects.create(
            user=user,
            role=profile_kwargs.pop("role", EmployeeProfile.Role.WAITER),
            **profile_kwargs,
        )
    return user


class LoginSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()

    def test_login_page_reachable(self):
        response = self.client.get("/accounts/login/")
        self.assertEqual(response.status_code, 200)

    def test_failed_login_then_success(self):
        _make_user("alice")
        response = self.client.post(
            "/accounts/login/",
            {"username": "alice", "password": "wrong"},
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/accounts/login/",
            {"username": "alice", "password": "Strong-Passw0rd!"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "/restaurant/")

    def test_brute_force_lockout(self):
        _make_user("bob")
        for _ in range(5):
            self.client.post(
                "/accounts/login/",
                {"username": "bob", "password": "wrong"},
            )

        # 6th attempt from the same IP is blocked outright.
        response = self.client.post(
            "/accounts/login/",
            {"username": "bob", "password": "Strong-Passw0rd!"},
        )
        self.assertEqual(response.status_code, 429)

    def test_logout_requires_post_and_ends_session(self):
        _make_user("carol")
        self.client.post(
            "/accounts/login/",
            {"username": "carol", "password": "Strong-Passw0rd!"},
        )
        # GET logout is not allowed (POST-only logout).
        response = self.client.get("/accounts/logout/")
        self.assertEqual(response.status_code, 405)

        response = self.client.post("/accounts/logout/")
        self.assertEqual(response.status_code, 302)


class RoleRoutingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.superuser = User.objects.create_superuser(
            "admin", password="Strong-Passw0rd!"
        )
        self.waiter = _make_user(
            "waiter1", role=EmployeeProfile.Role.WAITER
        )
        self.kitchen = _make_user(
            "kitchen1", role=EmployeeProfile.Role.KITCHEN
        )

    def _login(self, username):
        self.client = Client()
        self.client.post(
            "/accounts/login/",
            {"username": username, "password": "Strong-Passw0rd!"},
        )

    def test_superuser_sees_admin_dashboard(self):
        self._login("admin")
        response = self.client.get("/restaurant/", follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Admin Dashboard")

    def test_waiter_routed_to_floor_plan(self):
        self._login("waiter1")
        response = self.client.get("/restaurant/", follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Tables")

    def test_kitchen_routed_to_kitchen_dashboard(self):
        self._login("kitchen1")
        response = self.client.get("/restaurant/", follow=True)
        self.assertEqual(response.status_code, 200)

    def test_kitchen_cannot_open_floor_plan(self):
        self._login("kitchen1")
        response = self.client.get("/orders/seating/")
        self.assertEqual(response.status_code, 403)

    def test_waiter_cannot_open_kitchen(self):
        self._login("waiter1")
        response = self.client.get("/kitchen/")
        self.assertEqual(response.status_code, 403)

    def test_waiter_cannot_open_admin_dashboard(self):
        self._login("waiter1")
        response = self.client.get("/restaurant/admin-dashboard/")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_redirected_to_login(self):
        client = Client()
        response = client.get("/restaurant/admin-dashboard/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response.url)

    def test_site_root_redirects_anonymous_to_login(self):
        client = Client()
        response = client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response.url)

    def test_site_root_sends_logged_in_user_to_dashboard(self):
        _make_user("waiter9", role=EmployeeProfile.Role.WAITER)
        self.client = Client()
        self.client.post(
            "/accounts/login/",
            {"username": "waiter9", "password": "Strong-Passw0rd!"},
        )
        response = self.client.get("/", follow=True)
        self.assertEqual(response.status_code, 200)


class SeatingPaymentTests(TestCase):
    """The floor plan offers a Payment button for occupied seats and
    confirming the payment frees the seat again."""

    def setUp(self):
        cache.clear()
        self.waiter = _make_user("waiterpay", role=EmployeeProfile.Role.WAITER)
        self.client = Client()
        self.client.post(
            "/accounts/login/",
            {"username": "waiterpay", "password": "Strong-Passw0rd!"},
        )

    def test_payment_button_frees_seat(self):
        from orders.models import Table
        from orders.services import create_order

        table = Table.objects.create(number=1)
        order = create_order(user=self.waiter, table=table)

        # Table is now occupied and shows the payment shortcut.
        response = self.client.get("/orders/seating/")
        self.assertContains(response, "Payment")
        self.assertContains(response, f"#{order.order_number}")

        # Confirming payment completes the order...
        response = self.client.post(
            f"/orders/{order.id}/payment/",
            {"payment_method": "CASH"},
        )
        self.assertEqual(response.status_code, 302)

        order.refresh_from_db()
        table.refresh_from_db()
        self.assertEqual(order.payment_status, order.PaymentStatus.PAID)

        # ...and the seat is available again.
        self.assertEqual(table.status, table.Status.AVAILABLE)

        # No payment button anymore (seat is free).
        response = self.client.get("/orders/seating/")
        self.assertNotContains(response, "Order #%s" % order.order_number)


class QrLoginEntryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()

    def test_qr_entry_page_shows_on_login(self):
        response = self.client.get("/accounts/login/")
        self.assertContains(response, "log in with QR")

    def test_invalid_token_rejected(self):
        response = self.client.post(
            "/accounts/qr/",
            {"token": "not-a-uuid"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response.url)

    def test_valid_token_redirects_to_qr_login(self):
        import uuid
        token = uuid.uuid4()
        response = self.client.post(
            "/accounts/qr/",
            {"token": str(token)},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn(f"/accounts/qr-login/{token}", response.url)


class CustomerOrderTests(TestCase):
    """Customers can self-register, place a delivery order, and that order
    appears on the kitchen board and admin dashboard flagged as delivery."""

    def setUp(self):
        cache.clear()
        self.client = Client()
        User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        _make_user("kitch", role=EmployeeProfile.Role.KITCHEN)

    def _register_customer(self, username="customer1"):
        return self.client.post("/accounts/register/", {
            "full_name": "Test Customer",
            "username": username,
            "password1": "Strong-Passw0rd!",
            "password2": "Strong-Passw0rd!",
        })

    def test_register_page_reachable(self):
        response = self.client.get("/accounts/register/")
        self.assertEqual(response.status_code, 200)

    def test_register_creates_customer_and_redirects(self):
        response = self._register_customer()
        # Auto-logged in and sent to the delivery ordering page.
        self.assertRedirects(response, "/delivery/create/")
        from django.contrib.auth.models import User
        user = User.objects.get(username="customer1")
        self.assertFalse(hasattr(user, "employee_profile"))
        self.assertTrue(user.is_authenticated)

    def test_duplicate_username_rejected(self):
        self._register_customer()
        self.client = Client()
        response = self._register_customer()
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already taken")

    def test_customer_sees_customer_nav_not_staff_links(self):
        self._register_customer()
        response = self.client.get("/delivery/create/")
        self.assertContains(response, "Order Delivery")
        self.assertNotContains(response, "Tables &amp; Cabins")

    def test_customer_delivery_order_reaches_kitchen_and_admin(self):
        from menu.models import Category, MenuItem
        from orders.models import Order

        category = Category.objects.create(name="Mains")
        item = MenuItem.objects.create(
            category=category,
            name="Burger",
            price=500,
            is_available=True,
        )

        self._register_customer()

        # Step 1: customer details
        response = self.client.post("/delivery/create/", {
            "customer_name": "Ali Raza",
            "customer_phone": "0300-1234567",
            "address": "House 5, Street 2",
            "landmark": "",
            "delivery_fee": "100",
        })
        self.assertRedirects(response, "/delivery/select-food/")

        # Step 2: pick food
        response = self.client.post("/delivery/select-food/", {
            f"quantity_{item.id}": "2",
            f"notes_{item.id}": "extra spicy",
        })
        self.assertEqual(response.status_code, 302)

        order = Order.objects.order_by("-id").first()
        self.assertEqual(order.order_type, Order.OrderType.DELIVERY)

        # Kitchen board (logged in as kitchen staff) shows it as Delivery.
        self.client = Client()
        self.client.post("/accounts/login/", {
            "username": "kitch", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/kitchen/")
        self.assertContains(response, "Delivery")
        self.assertContains(response, "Ali Raza")

        # Admin dashboard also lists it.
        self.client = Client()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/restaurant/admin-dashboard/", follow=True)
        self.assertContains(response, f"#{order.order_number}")
        self.assertContains(response, "Delivery")


class CustomerCartTests(TestCase):
    """Menu shows Add to Cart / Order Now for customers; the cart checkout
    places a COD delivery order that reaches kitchen + admin."""

    def setUp(self):
        cache.clear()
        self.client = Client()
        User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        _make_user("kitch", role=EmployeeProfile.Role.KITCHEN)

        from menu.models import Category, MenuItem
        self.category = Category.objects.create(name="Mains")
        self.item1 = MenuItem.objects.create(
            category=self.category, name="Burger", price=500,
            is_available=True,
        )
        self.item2 = MenuItem.objects.create(
            category=self.category, name="Pizza", price=900,
            is_available=True,
        )

    def _register_customer(self):
        return self.client.post("/accounts/register/", {
            "full_name": "Cart User",
            "username": "cartuser",
            "password1": "Strong-Passw0rd!",
            "password2": "Strong-Passw0rd!",
        })

    def test_menu_shows_cart_buttons_for_customers(self):
        self._register_customer()
        response = self.client.get("/menu/")
        self.assertContains(response, "Add to Cart")
        self.assertContains(response, "Order Now")

    def test_add_to_cart_and_view(self):
        self._register_customer()
        self.client.post(f"/delivery/cart/add/{self.item1.id}/", {"qty": "2"})
        response = self.client.get("/delivery/cart/")
        self.assertContains(response, "Burger")
        self.assertContains(response, "1000")  # 2 x 500

    def test_order_now_goes_to_checkout(self):
        self._register_customer()
        response = self.client.post(
            f"/delivery/cart/add/{self.item2.id}/",
            {"qty": "1", "order_now": "1"},
        )
        self.assertRedirects(response, "/delivery/checkout/")

    def test_checkout_places_cod_delivery_order(self):
        from orders.models import Order

        self._register_customer()
        self.client.post(f"/delivery/cart/add/{self.item1.id}/", {"qty": "2"})

        response = self.client.post("/delivery/checkout/", {
            "customer_name": "Sara Khan",
            "customer_phone": "0311-9876543",
            "address": "Flat 3, Tower A",
            "landmark": "",
            "payment_method": "COD",
        })
        self.assertEqual(response.status_code, 302)

        order = Order.objects.order_by("-id").first()
        self.assertEqual(order.order_type, Order.OrderType.DELIVERY)
        from orders.models import PaymentMethod
        self.assertEqual(order.payment_method, PaymentMethod.COD)

        # Cart is emptied after placing the order.
        response = self.client.get("/delivery/cart/")
        self.assertNotContains(response, "Burger")

        # Kitchen sees it as a delivery ticket with customer info.
        self.client = Client()
        self.client.post("/accounts/login/", {
            "username": "kitch", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/kitchen/")
        self.assertContains(response, "Sara Khan")
        self.assertContains(response, "Delivery")

        # Admin dashboard lists it too.
        self.client = Client()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/restaurant/admin-dashboard/", follow=True)
        self.assertContains(response, f"#{order.order_number}")

    def test_staff_cannot_use_cart(self):
        _make_user("waiterx", role=EmployeeProfile.Role.WAITER)
        self.client.post("/accounts/login/", {
            "username": "waiterx", "password": "Strong-Passw0rd!",
        })
        response = self.client.post(
            f"/delivery/cart/add/{self.item1.id}/", {"qty": "1"},
        )
        self.assertEqual(response.status_code, 403)


class SalesReportTests(TestCase):
    """Admin/manager-only sales report with daily/monthly trends,
    payment-method split and category performance."""

    def setUp(self):
        cache.clear()
        self.client = Client()
        User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.staff = _make_user("waiterr", role=EmployeeProfile.Role.WAITER)

    def _create_paid_cash_order(self):
        from orders.models import Table
        from orders.services import complete_payment, create_order

        table = Table.objects.create(number=10)
        order = create_order(user=self.staff, table=table)
        complete_payment(order=order, payment_method="CASH")
        return order

    def test_admin_sees_report_with_sales(self):
        self._create_paid_cash_order()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/reports/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sales Reports")
        self.assertContains(response, "Daily Sales Trend")
        self.assertContains(response, "Monthly Summary")

    def test_waiter_cannot_access_reports(self):
        self.client.post("/accounts/login/", {
            "username": "waiterr", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/reports/")
        self.assertEqual(response.status_code, 403)

    def test_customer_cannot_access_reports(self):
        self.client.post("/accounts/register/", {
            "full_name": "C C", "username": "cust9",
            "password1": "Strong-Passw0rd!", "password2": "Strong-Passw0rd!",
        })
        response = self.client.get("/reports/")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_redirected_to_login(self):
        response = Client().get("/reports/")
        self.assertEqual(response.status_code, 302)

    def test_filter_today_shows_range_label(self):
        self._create_paid_cash_order()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/reports/?period=today")
        self.assertContains(response, "Today (")
        # The order placed today is included.
        self.assertNotEqual(
            response.context["summary"]["total_orders"], 0,
        )

    def test_filter_yesterday_excludes_todays_order(self):
        self._create_paid_cash_order()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        response = self.client.get("/reports/?period=yesterday")
        self.assertEqual(response.context["summary"]["total_orders"], 0)
        self.assertIn("Yesterday", response.context["range_label"])

    def test_custom_date_range(self):
        from datetime import timedelta
        from django.utils import timezone as tz
        self._create_paid_cash_order()
        self.client.post("/accounts/login/", {
            "username": "admin", "password": "Strong-Passw0rd!",
        })
        today = tz.localtime().date()
        start = today - timedelta(days=2)
        response = self.client.get(
            f"/reports/?period=custom&from={start}&to={today}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Custom range active")
        # Order falls inside the custom window.
        self.assertNotEqual(
            response.context["summary"]["total_orders"], 0,
        )


class WaiterReadyNotificationTests(TestCase):
    """Marking a batch ready in the kitchen pushes an 'order_ready'
    notification to the waiters channel group."""

    def setUp(self):
        cache.clear()

    def _make_order_with_batch(self, status):
        from django.contrib.auth.models import User
        from menu.models import Category, MenuItem
        from orders.models import Table
        from orders.services import create_order, create_order_batch

        user = User.objects.create_user("w", password="x")
        table = Table.objects.create(number=1)
        order = create_order(user=user, table=table)

        cat = Category.objects.create(name="C")
        item = MenuItem.objects.create(
            category=cat, name="Tea", price=50, is_available=True,
        )
        batch = create_order_batch(
            order=order,
            items=[{"menu_item": item, "quantity": 1, "notes": ""}],
        )
        if status == "PREPARING":
            from kitchen.services import start_batch
            start_batch(batch)
        return batch

    def test_mark_ready_notifies_waiters_group(self):
        from unittest.mock import patch

        from kitchen.services import mark_batch_ready
        from orders.models import OrderBatch

        batch = self._make_order_with_batch("PREPARING")

        calls = []

        async def fake_group_send(group, message):
            calls.append((group, message))

        fake_layer = type(
            "L", (), {"group_send": staticmethod(fake_group_send)},
        )()

        with patch(
            "kitchen.services.get_channel_layer", return_value=fake_layer,
        ):
            mark_batch_ready(batch)

            # Both kitchen-status and waiter notifications go through
            # group_send; one of them must target the "waiters" group.
            groups = [group for group, _ in calls]
            self.assertIn("waiters", groups)
            self.assertIn("kitchen", groups)

            ready_calls = [msg for group, msg in calls if group == "waiters"]
            payload = ready_calls[0]
            self.assertEqual(payload["type"], "order_ready")
            self.assertEqual(
                payload["order_number"], batch.order.order_number,
            )
            self.assertEqual(payload["table"], 1)

        batch.refresh_from_db()
        self.assertEqual(batch.status, OrderBatch.Status.READY)

