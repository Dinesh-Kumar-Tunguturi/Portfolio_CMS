import os
import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Dict, Optional, List

from core import Database, EmailNotifier, WhatsAppNotifier
from payments import PaymentProcessor

app = FastAPI(title="Dynamic Form CMS")

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()

# --- Pydantic Schemas ---
class FormSchema(BaseModel):
    name: str
    slug: str
    email_enabled: int = 0
    email_subject: Optional[str] = ""
    email_body: Optional[str] = ""
    whatsapp_enabled: int = 0
    whatsapp_mode: Optional[str] = "text"
    whatsapp_body: Optional[str] = ""
    whatsapp_template_name: Optional[str] = ""
    whatsapp_language_code: Optional[str] = "en_US"
    smtp_host: Optional[str] = ""
    smtp_port: Optional[str] = ""
    smtp_user: Optional[str] = ""
    smtp_pass: Optional[str] = ""
    smtp_from_name: Optional[str] = ""
    whatsapp_token: Optional[str] = ""
    whatsapp_phone_number_id: Optional[str] = ""
    # Payment configuration
    payment_enabled: int = 0
    payment_amount: float = 0.0
    payment_currency: Optional[str] = "INR"
    razorpay_enabled: int = 0
    paypal_enabled: int = 0
    upi_enabled: int = 0

class SubmissionSchema(BaseModel):
    full_name: str
    email: EmailStr
    mobile: str

class SettingsSchema(BaseModel):
    settings: Dict[str, str]

class SendPaymentSchema(BaseModel):
    submission_id: int
    amount: float
    currency: str = "INR"

class CreateOrderSchema(BaseModel):
    gateway: str  # 'razorpay', 'paypal', 'upi'

class VerifyPaymentSchema(BaseModel):
    gateway: str
    # Razorpay fields
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    # PayPal fields
    paypal_order_id: Optional[str] = None

# --- Background Task Processor ---
def dispatch_notifications_task(sub_id: int, form_slug: str, payment_link: str = ""):
    """Asynchronously formats and sends plain-text email and Meta WhatsApp alerts."""
    # Create thread-safe database connection inside background worker
    local_db = Database()
    
    # 1. Fetch related data
    form = local_db.get_form_by_slug(form_slug)
    if not form:
        local_db.log(form_slug, "SYSTEM", "FAILED", f"Notifier could not find form: {form_slug}")
        return
        
    submissions = local_db.get_submissions()
    submission = next((s for s in submissions if s["id"] == sub_id), None)
    if not submission:
        local_db.log(form_slug, "SYSTEM", "FAILED", f"Notifier could not find submission ID: {sub_id}")
        return

    # Add form name and payment link dynamically for interpolation
    submission["form_name"] = form["name"]
    submission["payment_link"] = payment_link
    settings = local_db.get_settings()

    # 2. Process Email Notification
    if form.get("email_enabled") == 1:
        local_db.update_submission_status(sub_id, email_status="Sending")
        notifier = EmailNotifier()
        status, msg = notifier.send(submission["email"], submission, form, settings)
        local_db.update_submission_status(sub_id, email_status=status)
        local_db.log(form_slug, "EMAIL", status, msg)
    else:
        local_db.update_submission_status(sub_id, email_status="Disabled")

    # 3. Process WhatsApp Notification
    if form.get("whatsapp_enabled") == 1:
        local_db.update_submission_status(sub_id, whatsapp_status="Sending")
        notifier = WhatsAppNotifier()
        status, msg = notifier.send(submission["mobile"], submission, form, settings)
        local_db.update_submission_status(sub_id, whatsapp_status=status)
        local_db.log(form_slug, "WHATSAPP", status, msg)
    else:
        local_db.update_submission_status(sub_id, whatsapp_status="Disabled")

# --- API Routes ---
api_router = APIRouter(prefix="/api")

@api_router.get("/forms")
def list_forms():
    return db.get_forms()

@api_router.get("/forms/{slug}")
def get_form_config(slug: str):
    form = db.get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@api_router.post("/forms")
def create_form(data: FormSchema):
    try:
        form_id = db.create_form(data.dict())
        return {"status": "success", "id": form_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Form creation failed (perhaps slug already exists?): {str(e)}")

@api_router.put("/forms/{id}")
def update_form(id: int, data: FormSchema):
    try:
        db.update_form(id, data.dict())
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/forms/{id}")
def delete_form(id: int):
    db.delete_form(id)
    return {"status": "success"}

@api_router.get("/submissions")
def list_submissions():
    return db.get_submissions()

@api_router.get("/settings")
def get_settings():
    return db.get_settings()

@api_router.post("/settings")
def update_settings(payload: SettingsSchema):
    db.save_settings(payload.settings)
    return {"status": "success"}

@api_router.get("/logs")
def list_logs():
    return db.get_logs()

# Public submission endpoint (Zero Lag: queues alerts and returns 200 immediately)
@api_router.post("/public/form/{slug}/submit")
def submit_form(slug: str, data: SubmissionSchema, bg_tasks: BackgroundTasks, request: Request):
    form = db.get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=404, detail="Form configuration does not exist")
    
    # Save lead data to DB
    sub_id = db.create_submission(slug, data.full_name, data.email, data.mobile)
    
    payment_link = ""
    # Generate payment automatically if payment enabled
    if form.get("payment_enabled") == 1:
        amount = form.get("payment_amount", 0.0)
        currency = form.get("payment_currency", "INR")
        token = db.create_payment(
            submission_id=sub_id,
            form_slug=slug,
            amount=amount,
            currency=currency
        )
        # Dynamically build the absolute payment link using request origin/referer/base_url
        origin = request.headers.get("origin")
        if not origin:
            referer = request.headers.get("referer")
            if referer:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                origin = f"{parsed.scheme}://{parsed.netloc}"
            else:
                origin = str(request.base_url).rstrip("/")
        
        payment_link = f"{origin}/pay/{token}"
        db.log(slug, "PAYMENT", "PENDING",
               f"Automatic payment link generated: {currency} {amount} for submission #{sub_id}")
    
    # Delegate to Background Task for non-blocking notification dispatch
    bg_tasks.add_task(dispatch_notifications_task, sub_id, slug, payment_link)
    
    return {"status": "success", "message": "Submission recorded", "submission_id": sub_id}

# ============================================================
# PAYMENT API ROUTES
# ============================================================

@api_router.get("/payments")
def list_payments():
    """Dashboard: list all payment records with joined submission data."""
    return db.get_payments()

@api_router.get("/payments/stats")
def payment_stats():
    """Dashboard: aggregate payment analytics."""
    return db.get_payment_stats()

@api_router.post("/payments/send")
def send_payment_link(payload: SendPaymentSchema, bg_tasks: BackgroundTasks, request: Request):
    """Admin action: create payment record for a submission and send payment link via notifications."""
    submission = db.get_submission_by_id(payload.submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    form = db.get_form_by_slug(submission["form_slug"])
    if not form:
        raise HTTPException(status_code=404, detail="Form configuration not found")

    if not form.get("payment_enabled"):
        raise HTTPException(status_code=400, detail="Payment is not enabled for this form")

    # Create PENDING payment — ACID atomic insert
    token = db.create_payment(
        submission_id=payload.submission_id,
        form_slug=submission["form_slug"],
        amount=payload.amount,
        currency=payload.currency
    )

    db.log(submission["form_slug"], "PAYMENT", "PENDING",
           f"Payment link created: {payload.currency} {payload.amount} for submission #{payload.submission_id}")

    # Build payment link and dispatch notifications with it
    # The frontend base URL is dynamically injected from the request origin/referer/base_url
    origin = request.headers.get("origin")
    if not origin:
        referer = request.headers.get("referer")
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"
        else:
            origin = str(request.base_url).rstrip("/")

    payment_link = f"{origin}/pay/{token}"

    # Re-dispatch notifications with payment link injected
    bg_tasks.add_task(dispatch_notifications_task, payload.submission_id, submission["form_slug"], payment_link)

    return {"status": "success", "payment_token": token, "payment_link": payment_link}

@api_router.get("/payments/{token}")
def get_payment_details(token: str):
    """Public: get payment info for the payment page (no secrets exposed)."""
    payment = db.get_payment_by_token(token)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link not found or expired")

    form = db.get_form_by_slug(payment["form_slug"])
    if not form:
        raise HTTPException(status_code=404, detail="Form configuration missing")

    settings = db.get_settings()
    processor = PaymentProcessor(settings)
    client_config = processor.get_client_config(form)

    # Force UPI to be active and inject key if currency is USD
    if payment["currency"] == "USD":
        client_config["razorpay_key_id"] = settings.get("razorpay_key_id", "")

    return {
        "payment_token": payment["payment_token"],
        "amount": payment["amount"],
        "currency": payment["currency"],
        "status": payment["status"],
        "form_name": form["name"],
        "description": form.get("name", "Payment"),
        "razorpay_enabled": bool(form.get("razorpay_enabled")),
        "paypal_enabled": bool(form.get("paypal_enabled")),
        "upi_enabled": bool(form.get("upi_enabled")),
        **client_config
    }

@api_router.post("/payments/{token}/create-order")
def create_payment_order(token: str, payload: CreateOrderSchema):
    """Create a gateway-specific order for the payment page to use."""
    payment = db.get_payment_by_token(token)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["status"] == "PAID":
        raise HTTPException(status_code=400, detail="Payment already completed")

    form = db.get_form_by_slug(payment["form_slug"])
    settings = db.get_settings()
    processor = PaymentProcessor(settings)

    gateway_name = payload.gateway
    amount = payment["amount"]
    currency = payment["currency"]

    # Auto-convert USD to INR at rate of 83.0 if checkout is via UPI or Razorpay
    if gateway_name in ["upi", "razorpay"] and currency == "USD":
        amount = amount * 83.0
        currency = "INR"

    try:
        gateway = processor.get_gateway(gateway_name)
        order = gateway.create_order(
            amount=amount,
            currency=currency,
            token=token,
            description=form.get("name", "Payment")
        )
        # Update payment with gateway order ID
        db.update_payment_status(
            token, "PROCESSING",
            gateway=payload.gateway,
            gateway_order_id=order.get("order_id")
        )
        db.log(payment["form_slug"], "PAYMENT", "PROCESSING",
               f"{payload.gateway} order created: {order.get('order_id')}")
        return {"status": "success", **order}
    except Exception as e:
        db.log(payment["form_slug"], "PAYMENT", "FAILED", f"Order creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gateway order creation failed: {str(e)}")

@api_router.post("/payments/{token}/verify")
def verify_payment(token: str, payload: VerifyPaymentSchema):
    """Verify and capture payment — server-side, no webhook required."""
    payment = db.get_payment_by_token(token)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["status"] == "PAID":
        return {"status": "already_paid", "message": "This payment was already completed"}

    settings = db.get_settings()
    processor = PaymentProcessor(settings)

    try:
        gateway = processor.get_gateway(payload.gateway)
        success, details = gateway.verify_payment(payload.dict())

        if success:
            # ACID: atomic status update to PAID with full audit trail
            db.update_payment_status(
                token, "PAID",
                gateway=payload.gateway,
                gateway_order_id=details.get("gateway_order_id"),
                gateway_payment_id=details.get("gateway_payment_id"),
                gateway_signature=details.get("gateway_signature"),
                payer_email=details.get("payer_email")
            )
            db.log(payment["form_slug"], "PAYMENT", "PAID",
                   f"{payload.gateway} payment verified: {details.get('gateway_payment_id', 'N/A')}")
            return {"status": "success", "message": "Payment verified and captured"}
        else:
            db.update_payment_status(token, "FAILED", gateway=payload.gateway)
            db.log(payment["form_slug"], "PAYMENT", "FAILED",
                   f"{payload.gateway} verification failed: {details.get('error', 'Unknown')}")
            raise HTTPException(status_code=400, detail=f"Payment verification failed: {details.get('error')}")
    except HTTPException:
        raise
    except Exception as e:
        db.log(payment["form_slug"], "PAYMENT", "FAILED", f"Verification exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment verification error: {str(e)}")

app.include_router(api_router)

# Mount Frontend Build directory if built (for single port execution)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
