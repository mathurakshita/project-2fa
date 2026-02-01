import sqlite3
from flask import g

DB_PATH = "app.db"

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_schema():
    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash BLOB NOT NULL
        )
        """
    )
    db.commit()
    db.close()

def get_user_by_username(username: str):
    db = get_db()
    cur = db.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
    return cur.fetchone()
