import smtplib
import sqlite3
import os

def test():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    settings = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings").fetchall()}
    
    user = settings.get("smtp_user").strip()
    pwd = settings.get("smtp_pass").replace(" ", "")
    
    print(f"Testing user: {user}")
    print(f"Testing password: {pwd}")
    
    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10)
        server.login(user, pwd)
        print("Success! Google accepted the app password.")
        server.quit()
    except Exception as e:
        print(f"Failed! Google rejected the credentials: {str(e)}")

if __name__ == "__main__":
    test()
