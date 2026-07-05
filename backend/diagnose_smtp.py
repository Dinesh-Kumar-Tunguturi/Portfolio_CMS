import smtplib
from email.mime.text import MIMEText
import sqlite3
import os

def run():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    settings = {r["key"]: r["value"] for r in rows}
    
    host = settings.get("smtp_host")
    port_str = settings.get("smtp_port")
    user = settings.get("smtp_user")
    pwd = settings.get("smtp_pass")
    
    if not all([host, port_str, user, pwd]):
        print("SMTP settings are incomplete in the database.")
        print(settings)
        return
        
    port = int(port_str)
    print("--- SMTP Diagnosis Start ---")
    print(f"Connecting to host: {host}")
    print(f"Port: {port}")
    print(f"User: {user}")
    print(f"App Password length: {len(pwd) if pwd else 0}")
    
    msg = MIMEText("Diagnostic Test Message", "plain", "utf-8")
    msg["Subject"] = "Diagnostic Test"
    msg["From"] = f"CMS Diagnose <{user}>"
    msg["To"] = user
    
    try:
        if port == 465:
            print("\nEstablishing SSL connection...")
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            print("\nEstablishing standard connection...")
            server = smtplib.SMTP(host, port, timeout=10)
            print("Upgrading connection to STARTTLS...")
            server.starttls()
            
        server.set_debuglevel(1)  # Enable protocol dialog logging
        print("Sending login credentials...")
        server.login(user, pwd)
        print("\nLogin authentication succeeded!")
        server.sendmail(user, [user], msg.as_string())
        print("Mail sent successfully to self!")
        server.quit()
        print("\n--- Diagnostic SUCCESS ---")
    except Exception as e:
        print(f"\n--- Diagnostic FAILED ---")
        print(f"Reason: {str(e)}")

if __name__ == "__main__":
    run()
