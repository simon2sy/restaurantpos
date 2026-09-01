import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        data = {
            "success": False,
            "message": _get_message(response),
            "errors": response.data if isinstance(response.data, dict) else {"detail": response.data},
        }
        response.data = data
    else:
        # Unhandled exceptions (500s) — log the REAL error for debugging
        logger.error(
            "Unhandled exception in %s: %s",
            context.get("view", "?"),
            exc,
            exc_info=True,
        )
        # Also print to stderr so Render logs capture it
        print(f"[500] {context.get('view', '?')} -> {type(exc).__name__}: {exc}")

        response = Response(
            {
                "success": False,
                "message": "An internal server error occurred.",
                "errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def _get_message(response):
    if isinstance(response.data, dict):
        # DRF default error structure
        if "detail" in response.data:
            return str(response.data["detail"])
        # Validation errors
        if any(isinstance(v, list) for v in response.data.values()):
            first_key = next(iter(response.data))
            errors = response.data[first_key]
            if isinstance(errors, list) and errors:
                return str(errors[0])
        # Custom error from our serializers
        if "message" in response.data:
            return response.data["message"]
    elif isinstance(response.data, list) and response.data:
        return str(response.data[0])
    return "An error occurred."
