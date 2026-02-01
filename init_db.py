import bcrypt
import sqlite3
from database import DB_PATH, init_schema

DEMO_USERNAME = "testuser"
DEMO_PASSWORD = "Pass@123"  # change for your demo

def main():
    init_schema()

    pw_hash = bcrypt.hashpw(DEMO_PASSWORD.encode("utf-8"), bcrypt.gensalt())

    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()

    # Upsert demo user
    cur.execute("SELECT id FROM users WHERE username = ?", (DEMO_USERNAME,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (pw_hash, DEMO_USERNAME),
        )
        print(f"Updated demo user: {DEMO_USERNAME}")
    else:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (DEMO_USERNAME, pw_hash),
        )
        print(f"Created demo user: {DEMO_USERNAME}")

    db.commit()
    db.close()

    print("\nDemo credentials:")
    print(f"  username: {DEMO_USERNAME}")
    print(f"  password: {DEMO_PASSWORD}")

if __name__ == "__main__":
    main()
