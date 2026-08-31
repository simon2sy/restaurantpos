# Restaurant POS System — Project Documentation

**Last updated:** 26 Aug 2026
**Framework:** Django 6.1 + Channels (WebSockets) · Python 3.13
**Database:** PostgreSQL (falls back to SQLite) · **Realtime:** Daphne / ASGI

---

## 1. What This System Does

A full restaurant Point-of-Sale web app with three staff dashboards plus a
customer self-service ordering portal:

| Role | Dashboard | Capabilities |
|---|---|---|
| **Admin / Manager** | Admin Overview + Sales Reports | Sees everything: revenue, orders, kitchen queue, employees, filterable sales reports |
| **Kitchen** | Kitchen Display | Live order tickets (WebSocket), Start Cooking → Mark Ready |
| **Waiter / Cashier** | Floor plan (`/orders/seating/`) | Create orders per table/cabin, add food, take payment; live "food ready" alerts |
| **Customer** | Menu + Cart + Checkout | Self-register, browse menu, Add to Cart / Order Now, place COD delivery orders |

Delivery orders placed by customers appear automatically on the Kitchen board
(flagged 🛵 Delivery with customer name/phone) and in the Admin dashboard.

---

## 2. Authentication & Security

- **Username/password login** — hardened `SecureLoginView`:
  - Brute-force lockout: 5 failed attempts per IP → HTTP 429 for 15 min.
  - Generic error messages (no username enumeration).
  - CSRF protected, `never_cache`, sensitive-post-parameter handling.
  - Session key rotation on login (session-fixation protection).
- **QR code login** for staff:
  - Manager generates a personal QR per employee (7-day expiry, revocable)
    from the Employees page.
  - Scan opens `/accounts/qr-login/<uuid>/` which validates token, employee
    active status and user active status before creating a session.
  - Manual fallback on the login page: paste the QR code value
    (`/accounts/qr/` validates UUID format first).
- **Logout** is POST-only (`SecureLogoutView`); GET returns 405. Session is
  flushed server-side and the action is logged in the audit trail.
- **Session hardening**: 4-hour sessions, expire-on-browser-close,
  HttpOnly cookies, SameSite=Lax, and when `DEBUG=False`: Secure cookies,
  SSL redirect, HSTS preload.
- **Password validation**: Django's default validators enforced at signup.
- **Activity audit trail**: logins (QR + password), logout, payments, order
  events are recorded per employee.

### Customer accounts
`/accounts/register/` — public self-signup (full name, username, password).
Customers have NO employee profile, so role routing sends them to the
delivery-ordering area only; all staff views return 403 for them.

---

## 3. Role-Based Access Control

- `core/permissions.py`
  - `require_role(user, *roles)` — raises 403 unless superuser or the user's
    `EmployeeProfile.role` matches.
  - Decorator form: `@role_required(*ROLES)`.
- Role groups: `MANAGEMENT_ROLES=("MANAGER",)`,
  `CASHIER_ROLES=("WAITER","CASHIER","MANAGER")`,
  `KITCHEN_ROLES=("KITCHEN","MANAGER")`.
- Login redirects by role (`core.views.home`): admin/superuser/Manager →
  Admin Overview, KITCHEN → Kitchen board, WAITER/CASHIER/DELIVERY → floor
  plan, customer → delivery ordering.

---

## 4. Dashboards

### Admin Overview — `/restaurant/admin-dashboard/`
- Stat tiles: orders today, revenue today, open orders, unpaid orders,
  table/cabin occupancy, kitchen queue size, active employees.
- 🔥 Live kitchen queue as mini ticket cards (color-coded by state).
- 🧾 Recent orders as hover cards with payment/status pills.
- 👥 Employee avatar cards (disabled accounts grayed out).

### Kitchen Display — `/kitchen/`
- Ticket board grid; each ticket color-coded: blue=Pending, amber=Preparing,
  green=Ready.
- Full-width action buttons: "▶ Start Cooking" / "✓ Mark Ready".
- Live via WebSocket `/ws/kitchen/`: new tickets arrive automatically;
  delivery tickets show 🛵 badge + customer name/phone.
- Empty state ("Kitchen all caught up").

### Waiter floor plan — `/orders/seating/`
- Seat cards for tables & cabins with status chips (Available/Occupied/
  Reserved) and colored top borders.
- Available seat → big "＋ Create Order" button.
- Occupied seat → order info box + View / 💵 Payment (one-click CASH) /
  Method… buttons.
- Confirming payment completes the order AND frees the seat atomically.
- **🔔 Live "Food ready" notifications**: WebSocket `/ws/waiters/`; toast
  popup + green highlight on the matching seat card + two-note chime.

### Order flow pages (all styled)
- Create order / add items: category sections, item rows with qty + notes.
- Order detail: batch cards, sticky totals bar, Proceed-to-Payment CTA.
- Payment page: gradient total banner, tappable payment-method cards.

### Sales Reports — `/reports/` (admin/manager only)
- **Date filtering**: preset buttons (Today, Yesterday, Last 7 / 30 days,
  This month, All time) + custom From/To date range. Everything respects
  the filter; the header shows the active range.
- Summary tiles: total revenue, paid orders, avg order value, unpaid exposure.
- 💳 Revenue split Cash vs COD (bars), ⭐ Top selling items (top 8).
- 🍽 Category performance bars.
- 📅 Daily sales bar chart across the selected range (auto-filled missing
  days; hidden gracefully for ranges > 62 days).
- 🗓 Monthly revenue rows with proportion bars.
- 📋 Detailed list of latest 50 paid orders (items, totals, method).

---

## 5. Customer Ordering (Menu → Cart → COD Checkout)

- **Menu page** (`/menu/`): app-themed category cards; every item has
  **🛒 Add to Cart** and **⚡ Order Now** buttons — visible to customers
  only (staff see a clean reference menu).
- **Cart** (`/delivery/cart/`): session-based (no extra DB tables);
  update quantities, remove items, subtotal + total lines.
- **Checkout** (`/delivery/checkout/`): delivery details form + payment
  method locked to **💵 Cash on Delivery**. Places a DELIVERY order,
  creates the Delivery record and kitchen batch, clears the cart.
- Cart badge count in customer nav; staff are blocked (403) from cart APIs.
- Placed orders flow to Kitchen (🛵 Delivery badge) and Admin dashboards.

---

## 6. Real-Time Events (Channels)

| Endpoint | Group | Purpose |
|---|---|---|
| `/ws/kitchen/` | `kitchen` | New order tickets, batch status changes |
| `/ws/waiters/` | `waiters` | `order_ready` events when kitchen marks food ready |

- `notify_kitchen(batch)` pushes new batches (incl. delivery info).
- `mark_batch_ready()` → `notify_batch_status()` (kitchen board) +
  `notify_waiters_ready()` (waiter toasts / seat highlight / chime).
- Channel layer: Redis if `REDIS_URL` set, else InMemory (dev).

---

## 7. UI / UX

- Single design system (`static/css/app.css`): cards, stat tiles, seat
  cards, kitchen tickets, payment options, status chips, bar charts, forms,
  toasts, empty states. Gradient page headers on every dashboard.
- **Mobile app experience**: PWA manifest (`standalone` display), theme
  color, generated icons; installable via browser "Add to Home Screen".
  Mobile bottom tab navigation (role-filtered), large touch targets,
  safe-area insets, responsive grids and scrollable tables.
- Static files served under any ASGI server via **WhiteNoise** (compressed,
  cache-busting). Run `collectstatic --noinput` after changing static files.

---

## 8. Key URLs

| URL | Purpose |
|---|---|
| `/accounts/login/`, `/accounts/register/` | Staff login (+ QR section) / customer signup |
| `/accounts/logout/` | POST-only logout |
| `/accounts/qr-login/<uuid>/`, `/accounts/qr/` | QR login endpoints |
| `/accounts/employees/…` | Admin: manage employees & their QR codes |
| `/restaurant/` | Role router → correct dashboard |
| `/restaurant/admin-dashboard/` | Admin overview |
| `/orders/seating/` | Waiter floor plan (tables & cabins) |
| `/orders/<id>/`, `/orders/<id>/add-items/`, `/orders/<id>/payment/` | Order detail / add food / pay |
| `/kitchen/` | Kitchen display |
| `/menu/` | Menu with cart buttons |
| `/delivery/create/`, `/delivery/cart/`, `/delivery/checkout/` | Delivery ordering (staff + customers) |
| `/reports/` | Filterable sales reports |
| `/ws/kitchen/`, `/ws/waiters/` | WebSocket endpoints |

---

## 9. Testing

`python manage.py test core.tests --keepdb` — **35 tests, all passing**:

- Login security: lockout after 5 failures, POST-only logout, redirect flows.
- Role routing: each role lands on its dashboard; cross-role access → 403.
- Root URL `/` routes anonymous users to login, logged-in users to their
  dashboard.
- Seating/payment: occupied table shows Payment button; paying frees the seat.
- QR login entry: invalid token rejected, valid token forwards correctly.
- Customers: registration, duplicate-username rejection, customer-only nav,
  delivery order reaching kitchen + admin.
- Cart: add/update, Order Now → checkout, COD order creation, cart cleared
  afterwards, staff blocked from cart.
- Reports: admin access with data sections, waiter/customer 403, anonymous
  redirect, Today/Yesterday filters, custom date range.
- Waiter notification: marking a batch READY pushes an `order_ready` payload
  to the waiters group with correct order number/table.

---

## 10. Running the Project

```bash
# Development (serves static files AND WebSockets):
python manage.py runserver

# Production-style:
python manage.py collectstatic --noinput
daphne -p 8000 config.asgi:application     # whitenoise serves /static/

# Tests:
python manage.py test core.tests --keepdb
```

Environment variables (`.env`): `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`,
optional PostgreSQL settings (`DB_NAME`, …), optional `REDIS_URL` for the
production channel layer, `CSRF_TRUSTED_ORIGINS`.

> Note: in production mode (`DEBUG=False`) secure cookies/HSTS/SSL-redirect
> are enabled — serve behind HTTPS.

---

## 11. Known Design Decisions

- Cart is session-based (per-device); no DB cart model needed yet.
- Payment methods currently limited to CASH (in-house) and COD (delivery).
- Delivery fee defaults to Rs. 0 for customer cart orders (staff flow can
  still enter a fee).
- Quick-pay button on floor plan always uses CASH; use "Method…" link to
  choose explicitly.
- Daily chart capped at 62 days; longer ranges rely on the monthly view.