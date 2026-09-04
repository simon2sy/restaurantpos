"""
Push notification service — sends FCM push notifications via the Expo Push API.

Expo handles the FCM/APNs delivery, so we only need to POST to
https://exp.host/--/api/v2/push/send with the Expo push token.

Requires:
    pip install requests   (already in requirements.txt)

Environment variable:
    None required — Expo Push API is free and needs no API key.
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_notification(token, title, body, data=None, sound=True, priority="high"):
    """Send a single push notification via Expo Push API.

    Args:
        token: Expo push token (e.g. ExponentPushToken[xxx])
        title: Notification title
        body: Notification body text
        data: Optional dict of custom data passed to the app
        sound: Whether to play a sound (default True) - can be boolean or string sound filename
        priority: Push priority — "high" for order alerts, "default" otherwise

    Returns:
        dict with 'status' key ('ok' or 'error')
    """
    if not token:
        return {"status": "error", "message": "No token provided"}

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "priority": priority,
    }

    if data:
        payload["data"] = data

    # Expo Push API expects sound as a string or omitted (not boolean).
    # Custom sound bundled via the expo-notifications plugin.
    if sound:
        # Determine sound file and channel based on notification type
        notification_type = data.get("type") if data else None
        if notification_type == "payment_received":
            payload["sound"] = "payment_done.mp3"
            payload["channelId"] = "general"
        elif notification_type == "new_order":
            payload["sound"] = "order_received.mp3"
            payload["channelId"] = "general"
        else:
            # Default sound for order_ready and other notifications
            payload["sound"] = "order_ready.mp3"
            payload["channelId"] = "order-ready"

    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=payload,
            timeout=10,
        )
        result = response.json()

        if response.status_code == 200 and result.get("data", {}).get("status") == "ok":
            logger.info("Push sent to %s: %s", token[:30], title)
            return {"status": "ok"}
        else:
            logger.warning("Push failed for %s: %s", token[:30], result)
            return {"status": "error", "message": str(result)}

    except requests.RequestException as e:
        logger.error("Push notification network error: %s", e)
        return {"status": "error", "message": str(e)}


def send_push_to_users(users, title, body, data=None, sound=True):
    """Send push notifications to all active device tokens for a list of users.

    Args:
        users: QuerySet or list of User objects
        title: Notification title
        body: Notification body text
        data: Optional dict of custom data
        sound: Whether to play a sound

    Returns:
        dict with 'sent' and 'failed' counts
    """
    from core.models import DeviceToken

    # Convert to list if it's a QuerySet
    users = list(users)
    
    tokens = DeviceToken.objects.filter(
        user__in=users,
        is_active=True,
    ).select_related("user")
    
    # Log for debugging
    logger.info(f"Sending push notification '{title}' to {len(users)} users")
    logger.info(f"Found {tokens.count()} active device tokens")
    
    sent = 0
    failed = 0

    for token_obj in tokens:
        result = send_push_notification(token_obj.token, title, body, data=data, sound=sound)
        if result["status"] == "ok":
            sent += 1
            logger.info(f"Push sent to {token_obj.user.username}: {title}")
        else:
            failed += 1
            logger.warning(f"Push failed for {token_obj.user.username}: {result}")
            # If token is invalid, deactivate it
            if "DeviceNotRegistered" in str(result.get("message", "")):
                DeviceToken.objects.filter(token=token_obj.token).update(is_active=False)

    logger.info(f"Push notification results: {sent} sent, {failed} failed")
    return {"sent": sent, "failed": failed}


def send_push_to_role(role, title, body, data=None, sound=True):
    """Send push notifications to all active employees with a specific role.

    Args:
        role: Employee role string (e.g. 'WAITER', 'KITCHEN')
        title: Notification title
        body: Notification body text
        data: Optional dict of custom data
        sound: Whether to play a sound

    Returns:
        dict with 'sent' and 'failed' counts
    """
    from accounts.models import EmployeeProfile
    from core.models import DeviceToken

    employees = EmployeeProfile.objects.filter(
        role=role,
        is_active=True,
    ).select_related("user")

    users = [emp.user for emp in employees]
    
    # Log for debugging
    logger.info(f"Sending push notification to role '{role}': {len(users)} users found")
    
    # Check which users have device tokens
    users_with_tokens = DeviceToken.objects.filter(
        user__in=users,
        is_active=True,
    ).values_list("user__username", flat=True)
    
    logger.info(f"Users with active device tokens for role '{role}': {list(users_with_tokens)}")

    return send_push_to_users(users, title, body, data=data, sound=sound)
