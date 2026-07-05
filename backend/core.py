import os
import re
import uuid
import sqlite3
import smtplib
from email.mime.text import MIMEText
import httpx

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

class SQLiteDatabase:
    """Object-Oriented Manager for database operations using SQLite."""
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self._initialize_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _initialize_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS forms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    slug TEXT NOT NULL UNIQUE,
                    email_enabled INTEGER DEFAULT 0,
                    email_subject TEXT,
                    email_body TEXT,
                    whatsapp_enabled INTEGER DEFAULT 0,
                    whatsapp_mode TEXT DEFAULT 'text',
                    whatsapp_body TEXT,
                    whatsapp_template_name TEXT,
                    whatsapp_language_code TEXT DEFAULT 'en_US',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS submissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    form_slug TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    mobile TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    email_status TEXT DEFAULT 'Skipped',
                    whatsapp_status TEXT DEFAULT 'Skipped'
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    form_slug TEXT,
                    event_type TEXT,
                    status TEXT,
                    message TEXT
                )
            """)
            # Payments table — full ACID-compliant payment lifecycle tracking
            conn.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payment_token TEXT NOT NULL UNIQUE,
                    submission_id INTEGER NOT NULL,
                    form_slug TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'INR',
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    gateway TEXT,
                    gateway_order_id TEXT,
                    gateway_payment_id TEXT,
                    gateway_signature TEXT,
                    payer_email TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    paid_at TIMESTAMP,
                    FOREIGN KEY (submission_id) REFERENCES submissions(id)
                )
            """)
            
            # Dynamic migration: add form-level SMTP and WhatsApp overrides if not present
            cursor = conn.execute("PRAGMA table_info(forms)")
            columns = [row[1] for row in cursor.fetchall()]
            
            overrides = {
                "smtp_host": "TEXT",
                "smtp_port": "TEXT",
                "smtp_user": "TEXT",
                "smtp_pass": "TEXT",
                "smtp_from_name": "TEXT",
                "whatsapp_token": "TEXT",
                "whatsapp_phone_number_id": "TEXT",
                # Payment configuration on each form
                "payment_enabled": "INTEGER DEFAULT 0",
                "payment_amount": "REAL DEFAULT 0",
                "payment_currency": "TEXT DEFAULT 'INR'",
                "razorpay_enabled": "INTEGER DEFAULT 0",
                "paypal_enabled": "INTEGER DEFAULT 0",
                "upi_enabled": "INTEGER DEFAULT 0",
            }
            for col, col_type in overrides.items():
                if col not in columns:
                    conn.execute(f"ALTER TABLE forms ADD COLUMN {col} {col_type}")
                    
            conn.commit()

    # Form CRUD Operations
    def get_forms(self):
        with self._get_connection() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM forms ORDER BY id DESC").fetchall()]

    def get_form_by_slug(self, slug):
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM forms WHERE slug = ?", (slug,)).fetchone()
            return dict(row) if row else None

    def create_form(self, data):
        with self._get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO forms (
                    name, slug, email_enabled, email_subject, email_body,
                    whatsapp_enabled, whatsapp_mode, whatsapp_body,
                    whatsapp_template_name, whatsapp_language_code,
                    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name,
                    whatsapp_token, whatsapp_phone_number_id,
                    payment_enabled, payment_amount, payment_currency,
                    razorpay_enabled, paypal_enabled, upi_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data["name"], data["slug"], data.get("email_enabled", 0),
                data.get("email_subject", ""), data.get("email_body", ""),
                data.get("whatsapp_enabled", 0), data.get("whatsapp_mode", "text"),
                data.get("whatsapp_body", ""), data.get("whatsapp_template_name", ""),
                data.get("whatsapp_language_code", "en_US"),
                data.get("smtp_host", ""), data.get("smtp_port", ""),
                data.get("smtp_user", ""), data.get("smtp_pass", ""),
                data.get("smtp_from_name", ""), data.get("whatsapp_token", ""),
                data.get("whatsapp_phone_number_id", ""),
                data.get("payment_enabled", 0), data.get("payment_amount", 0.0), data.get("payment_currency", "INR"),
                data.get("razorpay_enabled", 0), data.get("paypal_enabled", 0),
                data.get("upi_enabled", 0)
            ))
            conn.commit()
            return cursor.lastrowid

    def update_form(self, form_id, data):
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE forms SET
                    name = ?, slug = ?, email_enabled = ?, email_subject = ?, email_body = ?,
                    whatsapp_enabled = ?, whatsapp_mode = ?, whatsapp_body = ?,
                    whatsapp_template_name = ?, whatsapp_language_code = ?,
                    smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_from_name = ?,
                    whatsapp_token = ?, whatsapp_phone_number_id = ?,
                    payment_enabled = ?, payment_amount = ?, payment_currency = ?,
                    razorpay_enabled = ?, paypal_enabled = ?, upi_enabled = ?
                WHERE id = ?
            """, (
                data["name"], data["slug"], data.get("email_enabled", 0),
                data.get("email_subject", ""), data.get("email_body", ""),
                data.get("whatsapp_enabled", 0), data.get("whatsapp_mode", "text"),
                data.get("whatsapp_body", ""), data.get("whatsapp_template_name", ""),
                data.get("whatsapp_language_code", "en_US"),
                data.get("smtp_host", ""), data.get("smtp_port", ""),
                data.get("smtp_user", ""), data.get("smtp_pass", ""),
                data.get("smtp_from_name", ""), data.get("whatsapp_token", ""),
                data.get("whatsapp_phone_number_id", ""),
                data.get("payment_enabled", 0), data.get("payment_amount", 0.0), data.get("payment_currency", "INR"),
                data.get("razorpay_enabled", 0), data.get("paypal_enabled", 0),
                data.get("upi_enabled", 0), form_id
            ))
            conn.commit()

    def delete_form(self, form_id):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM forms WHERE id = ?", (form_id,))
            conn.commit()

    # Submission Operations
    def create_submission(self, form_slug, full_name, email, mobile):
        with self._get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO submissions (form_slug, full_name, email, mobile)
                VALUES (?, ?, ?, ?)
            """, (form_slug, full_name, email, mobile))
            conn.commit()
            return cursor.lastrowid

    def update_submission_status(self, sub_id, email_status=None, whatsapp_status=None):
        with self._get_connection() as conn:
            if email_status:
                conn.execute("UPDATE submissions SET email_status = ? WHERE id = ?", (email_status, sub_id))
            if whatsapp_status:
                conn.execute("UPDATE submissions SET whatsapp_status = ? WHERE id = ?", (whatsapp_status, sub_id))
            conn.commit()

    def get_submissions(self):
        with self._get_connection() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM submissions ORDER BY id DESC").fetchall()]

    def get_submission_by_id(self, sub_id):
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM submissions WHERE id = ?", (sub_id,)).fetchone()
            return dict(row) if row else None

    # Payment Operations — ACID-compliant lifecycle
    def create_payment(self, submission_id, form_slug, amount, currency):
        """Atomically create a PENDING payment record with a unique token."""
        token = str(uuid.uuid4())
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO payments (payment_token, submission_id, form_slug, amount, currency, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            """, (token, submission_id, form_slug, amount, currency))
            conn.commit()
        return token

    def get_payment_by_token(self, token):
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM payments WHERE payment_token = ?", (token,)).fetchone()
            return dict(row) if row else None

    def get_payments_by_submission(self, submission_id):
        with self._get_connection() as conn:
            return [dict(r) for r in conn.execute(
                "SELECT * FROM payments WHERE submission_id = ? ORDER BY id DESC", (submission_id,)
            ).fetchall()]

    def update_payment_status(self, token, status, gateway=None, gateway_order_id=None,
                               gateway_payment_id=None, gateway_signature=None, payer_email=None):
        """Atomic status transition with full audit trail."""
        with self._get_connection() as conn:
            fields = ["status = ?"]
            params = [status]
            if gateway:
                fields.append("gateway = ?"); params.append(gateway)
            if gateway_order_id:
                fields.append("gateway_order_id = ?"); params.append(gateway_order_id)
            if gateway_payment_id:
                fields.append("gateway_payment_id = ?"); params.append(gateway_payment_id)
            if gateway_signature:
                fields.append("gateway_signature = ?"); params.append(gateway_signature)
            if payer_email:
                fields.append("payer_email = ?"); params.append(payer_email)
            if status == "PAID":
                fields.append("paid_at = CURRENT_TIMESTAMP")
            params.append(token)
            conn.execute(f"UPDATE payments SET {', '.join(fields)} WHERE payment_token = ?", params)
            conn.commit()

    def get_payments(self):
        with self._get_connection() as conn:
            return [dict(row) for row in conn.execute("""
                SELECT p.*, s.full_name, s.email, s.mobile
                FROM payments p
                LEFT JOIN submissions s ON p.submission_id = s.id
                ORDER BY p.id DESC
            """).fetchall()]

    def get_payment_stats(self):
        with self._get_connection() as conn:
            row = conn.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN status = 'PAID' AND currency = 'INR' THEN amount ELSE 0 END) as revenue_inr,
                    SUM(CASE WHEN status = 'PAID' AND currency = 'USD' THEN amount ELSE 0 END) as revenue_usd
                FROM payments
            """).fetchone()
            return dict(row)

    # Global Settings Operations
    def get_settings(self):
        with self._get_connection() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            return {row["key"]: row["value"] for row in rows}

    def save_settings(self, settings_dict):
        with self._get_connection() as conn:
            for k, v in settings_dict.items():
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
            conn.commit()

    # System Logs Operations
    def log(self, form_slug, event_type, status, message):
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO logs (form_slug, event_type, status, message)
                VALUES (?, ?, ?, ?)
            """, (form_slug, event_type, status, message))
            conn.commit()

    def get_logs(self):
        with self._get_connection() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 500").fetchall()]


class BaseNotifier:
    """Polymorphic base notifier class."""
    def interpolate(self, text, submission):
        placeholders = {
            "{name}": submission.get("full_name", ""),
            "{email}": submission.get("email", ""),
            "{mobile}": submission.get("mobile", ""),
            "{form_name}": submission.get("form_name", ""),
            "{payment_link}": submission.get("payment_link", "")
        }
        for k, v in placeholders.items():
            text = text.replace(k, str(v))
        return text


class EmailNotifier(BaseNotifier):
    """OOP implementation of clean text-only Email sender via SMTP."""
    def send(self, recipient, submission, form_config, settings):
        host = form_config.get("smtp_host") or settings.get("smtp_host")
        port = form_config.get("smtp_port") or settings.get("smtp_port")
        user = form_config.get("smtp_user") or settings.get("smtp_user")
        pwd = form_config.get("smtp_pass") or settings.get("smtp_pass")
        from_name = form_config.get("smtp_from_name") or settings.get("smtp_from_name", "CMS Admin")

        # Clean credentials to avoid whitespace/copy-paste errors
        if user:
            user = user.strip()
        if pwd:
            pwd = pwd.replace(" ", "")

        if not all([host, port, user, pwd]):
            return "FAILED", "SMTP credentials missing in Global Settings"

        subject = self.interpolate(form_config["email_subject"], submission)
        body = self.interpolate(form_config["email_body"], submission)

        try:
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{user}>"
            msg["To"] = recipient

            port = int(port)
            # Use SSL if port is 465, else use standard STARTTLS
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                    server.login(user, pwd)
                    server.sendmail(user, [recipient], msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.starttls()
                    server.login(user, pwd)
                    server.sendmail(user, [recipient], msg.as_string())
            return "SUCCESS", f"Email successfully sent to {recipient}"
        except Exception as e:
            return "FAILED", f"SMTP Error: {str(e)}"


class WhatsAppNotifier(BaseNotifier):
    """OOP implementation of direct Meta Cloud API WhatsApp sender."""
    def send(self, recipient, submission, form_config, settings):
        token = form_config.get("whatsapp_token") or settings.get("whatsapp_token")
        phone_id = form_config.get("whatsapp_phone_number_id") or settings.get("whatsapp_phone_number_id")

        if not all([token, phone_id]):
            return "FAILED", "Meta WhatsApp credentials missing in Global Settings"

        # Format number (Meta API requires digits only without leading '+' or '00')
        mobile_number = re.sub(r"\D", "", recipient)
        if not mobile_number:
            return "FAILED", f"Invalid phone number format: {recipient}"

        url = f"https://graph.facebook.com/v20.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Build Meta API payload based on configured mode (text or template)
        mode = form_config.get("whatsapp_mode", "text")
        if mode == "template":
            # Extract variables used in template in order of appearance in template body
            template_body = form_config.get("whatsapp_body", "")
            matches = re.findall(r"\{(name|email|mobile|form_name)\}", template_body)
            
            # Map placeholders to values
            mapping = {
                "name": submission.get("full_name", ""),
                "email": submission.get("email", ""),
                "mobile": submission.get("mobile", ""),
                "form_name": submission.get("form_name", "")
            }
            
            params = [{"type": "text", "text": str(mapping[m])} for m in matches]
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": mobile_number,
                "type": "template",
                "template": {
                    "name": form_config.get("whatsapp_template_name", ""),
                    "language": {
                        "code": form_config.get("whatsapp_language_code", "en_US")
                    },
                    "components": [
                        {
                            "type": "body",
                            "parameters": params
                        }
                    ]
                }
            }
        else:
            # Free-form Text Message Mode
            interpolated_body = self.interpolate(form_config.get("whatsapp_body", ""), submission)
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": mobile_number,
                "type": "text",
                "text": {
                    "body": interpolated_body
                }
            }

        try:
            # Standard HTTP Client Request
            with httpx.Client(timeout=10) as client:
                res = client.post(url, json=payload, headers=headers)
                data = res.json()
                if res.status_code == 200:
                    return "SUCCESS", f"WhatsApp message sent via Meta API (ID: {data.get('messages', [{}])[0].get('id', 'N/A')})"
                else:
                    err_msg = data.get("error", {}).get("message", "Unknown Meta API error")
                    return "FAILED", f"Meta API Error (Status {res.status_code}): {err_msg}"
        except Exception as e:
            return "FAILED", f"HTTP Connection Error: {str(e)}"
