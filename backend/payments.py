"""
Payment Engine — Strategy + Template Method OOP Pattern
Gateways: Razorpay (INR+USD+UPI), PayPal (USD)
All verification is server-side, no webhooks required.
"""
import hmac
import hashlib
import base64
from abc import ABC, abstractmethod
import razorpay
import httpx


class PaymentGateway(ABC):
    """Abstract base — Template Method pattern for all payment gateways."""

    @abstractmethod
    def create_order(self, amount: float, currency: str, token: str, description: str) -> dict:
        """Create a payment order on the gateway. Returns {order_id, ...gateway_data}."""

    @abstractmethod
    def verify_payment(self, payment_data: dict) -> tuple:
        """Verify payment proof. Returns (success: bool, details: dict)."""


class RazorpayGateway(PaymentGateway):
    """Razorpay integration — supports INR, USD, and built-in UPI method."""

    def __init__(self, key_id: str, key_secret: str):
        self._key_id = key_id
        self._key_secret = key_secret
        self._client = razorpay.Client(auth=(key_id, key_secret))

    @property
    def key_id(self):
        return self._key_id

    def create_order(self, amount: float, currency: str, token: str, description: str) -> dict:
        """Create Razorpay order. Amount is in major units (e.g. 500 for ₹500)."""
        # Razorpay expects amount in paise (INR) or cents (USD)
        amount_minor = int(round(amount * 100))
        order = self._client.order.create({
            "amount": amount_minor,
            "currency": currency.upper(),
            "receipt": token,
            "notes": {"description": description, "payment_token": token}
        })
        return {"order_id": order["id"], "amount": amount_minor, "currency": currency.upper()}

    def verify_payment(self, payment_data: dict) -> tuple:
        """Verify Razorpay payment using HMAC-SHA256 signature (no webhook needed)."""
        try:
            order_id = payment_data["razorpay_order_id"]
            payment_id = payment_data["razorpay_payment_id"]
            signature = payment_data["razorpay_signature"]

            # Manual HMAC verification (same as razorpay SDK utility)
            message = f"{order_id}|{payment_id}".encode()
            expected = hmac.new(self._key_secret.encode(), message, hashlib.sha256).hexdigest()

            if hmac.compare_digest(expected, signature):
                return True, {
                    "gateway_order_id": order_id,
                    "gateway_payment_id": payment_id,
                    "gateway_signature": signature
                }
            return False, {"error": "Signature verification failed"}
        except Exception as e:
            return False, {"error": str(e)}


class PayPalGateway(PaymentGateway):
    """PayPal integration — USD via REST API v2. No SDK dependency."""

    _SANDBOX_URL = "https://api-m.sandbox.paypal.com"
    _LIVE_URL = "https://api-m.paypal.com"

    def __init__(self, client_id: str, client_secret: str, mode: str = "sandbox"):
        self._client_id = client_id
        self._client_secret = client_secret
        self._base_url = self._SANDBOX_URL if mode == "sandbox" else self._LIVE_URL
        self._access_token = None

    @property
    def client_id(self):
        return self._client_id

    def _get_access_token(self) -> str:
        """OAuth2 client credentials grant for PayPal REST API."""
        if self._access_token:
            return self._access_token
        credentials = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{self._base_url}/v1/oauth2/token",
                headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
                data="grant_type=client_credentials"
            )
            resp.raise_for_status()
            self._access_token = resp.json()["access_token"]
        return self._access_token

    def create_order(self, amount: float, currency: str, token: str, description: str) -> dict:
        """Create PayPal order via REST API v2."""
        access_token = self._get_access_token()
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": token,
                "description": description,
                "amount": {"currency_code": currency.upper(), "value": f"{amount:.2f}"}
            }]
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{self._base_url}/v2/checkout/orders",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()
        return {"order_id": data["id"], "status": data["status"]}

    def verify_payment(self, payment_data: dict) -> tuple:
        """Capture PayPal order server-side after client approval."""
        try:
            order_id = payment_data["paypal_order_id"]
            access_token = self._get_access_token()
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    f"{self._base_url}/v2/checkout/orders/{order_id}/capture",
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                )
                resp.raise_for_status()
                data = resp.json()

            if data.get("status") == "COMPLETED":
                capture = data["purchase_units"][0]["payments"]["captures"][0]
                payer_email = data.get("payer", {}).get("email_address", "")
                return True, {
                    "gateway_order_id": order_id,
                    "gateway_payment_id": capture["id"],
                    "payer_email": payer_email
                }
            return False, {"error": f"PayPal order status: {data.get('status')}"}
        except Exception as e:
            return False, {"error": str(e)}


class PaymentProcessor:
    """Facade — orchestrates gateway selection, order creation, and verification."""

    def __init__(self, settings: dict):
        self._settings = settings

    def _build_razorpay(self) -> RazorpayGateway:
        return RazorpayGateway(
            key_id=self._settings.get("razorpay_key_id", ""),
            key_secret=self._settings.get("razorpay_key_secret", "")
        )

    def _build_paypal(self) -> PayPalGateway:
        return PayPalGateway(
            client_id=self._settings.get("paypal_client_id", ""),
            client_secret=self._settings.get("paypal_client_secret", ""),
            mode=self._settings.get("paypal_mode", "sandbox")
        )

    def get_gateway(self, gateway_name: str) -> PaymentGateway:
        """Factory method — returns the requested gateway instance."""
        factories = {"razorpay": self._build_razorpay, "upi": self._build_razorpay, "paypal": self._build_paypal}
        builder = factories.get(gateway_name)
        if not builder:
            raise ValueError(f"Unknown gateway: {gateway_name}")
        return builder()

    def get_client_config(self, form_config: dict) -> dict:
        """Return client-safe gateway configuration (no secrets exposed)."""
        config = {}
        if form_config.get("razorpay_enabled") or form_config.get("upi_enabled"):
            config["razorpay_key_id"] = self._settings.get("razorpay_key_id", "")
        if form_config.get("paypal_enabled"):
            config["paypal_client_id"] = self._settings.get("paypal_client_id", "")
            config["paypal_mode"] = self._settings.get("paypal_mode", "sandbox")
        return config
