import time
import json
import random
import bcrypt
from flask import Flask, render_template, request, jsonify, session, redirect, url_for

from database import init_schema, get_user_by_username, close_db
from sudoku_bank import PUZZLES

APP_TIME_LIMIT_SECONDS = 20
PASSWORD_ATTEMPTS = 3
SUDOKU_ATTEMPTS = 3

app = Flask(__name__)
app.secret_key = "change-this-in-real-use"  # for demo only
app.teardown_appcontext(close_db)

@app.route("/api/sudoku/timeout", methods=["POST"])
def api_sudoku_timeout():
    if not session.get("pwd_ok"):
        return jsonify(ok=False, error="Not authenticated."), 401

    if session.get("sudoku_attempts_left", 0) <= 0:
        return jsonify(ok=False, error="Locked. No attempts left.", locked=True), 403

    if not session.get("sudoku_start_ts"):
        return jsonify(ok=False, error="No active puzzle."), 400

    now = int(time.time())
    started = int(session["sudoku_start_ts"])
    time_limit = int(session.get("time_limit", APP_TIME_LIMIT_SECONDS))

    # If they call it early, don't penalize.
    if now - started <= time_limit:
        remaining = max(0, time_limit - (now - started))
        return jsonify(ok=False, error="Time's up, Try again!", remaining=remaining), 400

    # Expired -> consume an attempt and reset puzzle state for next try
    session["sudoku_attempts_left"] -= 1
    attempts_left = session["sudoku_attempts_left"]

    session["sudoku_puzzle"] = None
    session["sudoku_solution"] = None
    session["sudoku_start_ts"] = None

    return jsonify(ok=True, attempts_left=attempts_left, locked=(attempts_left <= 0))

def session_bootstrap():
    session.setdefault("pwd_attempts_left", PASSWORD_ATTEMPTS)
    session.setdefault("sudoku_attempts_left", SUDOKU_ATTEMPTS)
    session.setdefault("pwd_ok", False)
    session.setdefault("sudoku_ok", False)
    session.setdefault("username", None)
    # sudoku state
    session.setdefault("sudoku_puzzle", None)
    session.setdefault("sudoku_solution", None)
    session.setdefault("sudoku_start_ts", None)
    session.setdefault("time_limit", APP_TIME_LIMIT_SECONDS)

def reset_flow(keep_user=False):
    user = session.get("username") if keep_user else None
    session.clear()
    if keep_user:
        session["username"] = user

@app.before_request
def _init():
    session_bootstrap()

@app.route("/")
def index():
    return redirect(url_for("login_page"))

@app.route("/login")
def login_page():
    # If already fully verified, go welcome
    if session.get("pwd_ok") and session.get("sudoku_ok"):
        return redirect(url_for("welcome_page"))
    return render_template("login.html")

@app.route("/sudoku")
def sudoku_page():
    if not session.get("pwd_ok"):
        return redirect(url_for("login_page"))
    if session.get("sudoku_ok"):
        return redirect(url_for("welcome_page"))
    return render_template("sudoku.html")

@app.route("/welcome")
def welcome_page():
    if not (session.get("pwd_ok") and session.get("sudoku_ok")):
        return redirect(url_for("login_page"))
    return render_template("welcome.html", username=session.get("username"))

@app.route("/failed")
def failed_page():
    # Only allow access if they passed password stage
    if not session.get("pwd_ok"):
        return redirect(url_for("login_page"))

    return render_template("failed.html", username=session.get("username"))

@app.route("/api/login", methods=["POST"])
def api_login():
    if session.get("pwd_attempts_left", 0) <= 0:
        return jsonify(ok=False, error="Locked. No attempts left."), 403

    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify(ok=False, error="Username and password required.", attempts_left=session["pwd_attempts_left"]), 400

    user = get_user_by_username(username)
    if not user:
        session["pwd_attempts_left"] -= 1
        return jsonify(ok=False, error="Wrong username or password.", attempts_left=session["pwd_attempts_left"]), 401

    stored_hash = user["password_hash"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        session["pwd_attempts_left"] -= 1
        return jsonify(ok=False, error="Wrong username or password.", attempts_left=session["pwd_attempts_left"]), 401

    # Success
    session["pwd_ok"] = True
    session["username"] = username

    # Reset sudoku stage for fresh attempt
    session["sudoku_ok"] = False
    session["sudoku_attempts_left"] = SUDOKU_ATTEMPTS
    session["sudoku_puzzle"] = None
    session["sudoku_solution"] = None
    session["sudoku_start_ts"] = None
    session["time_limit"] = APP_TIME_LIMIT_SECONDS

    return jsonify(ok=True, next="/sudoku")

@app.route("/api/sudoku/puzzle", methods=["GET"])
def api_sudoku_puzzle():
    if not session.get("pwd_ok"):
        return jsonify(ok=False, error="Not authenticated."), 401
    if session.get("sudoku_attempts_left", 0) <= 0:
        return jsonify(ok=False, error="Locked. No attempts left.", locked=True), 403
        

    # If puzzle already issued, return the same one (prevents refresh cheating)
    if session.get("sudoku_puzzle") and session.get("sudoku_solution") and session.get("sudoku_start_ts"):
        return jsonify(
            ok=True,
            puzzle=json.loads(session["sudoku_puzzle"]),
            time_limit=session["time_limit"],
            attempts_left=session["sudoku_attempts_left"],
            started_at=session["sudoku_start_ts"],
        )

    pick = random.choice(PUZZLES)
    session["sudoku_puzzle"] = json.dumps(pick["puzzle"])
    session["sudoku_solution"] = json.dumps(pick["solution"])
    session["sudoku_start_ts"] = int(time.time())
    session["time_limit"] = APP_TIME_LIMIT_SECONDS

    return jsonify(
        ok=True,
        puzzle=pick["puzzle"],
        time_limit=session["time_limit"],
        attempts_left=session["sudoku_attempts_left"],
        started_at=session["sudoku_start_ts"],
    )

@app.route("/api/sudoku/verify", methods=["POST"])
def api_sudoku_verify():
    if not session.get("pwd_ok"):
        return jsonify(ok=False, error="Not authenticated."), 401

    if session.get("sudoku_attempts_left", 0) <= 0:
        return jsonify(ok=False, error="Locked. No attempts left.", locked=True), 403

    if not session.get("sudoku_solution") or not session.get("sudoku_start_ts"):
        return jsonify(ok=False, error="No active puzzle. Refresh Sudoku page."), 400

    now = int(time.time())
    started = int(session["sudoku_start_ts"])
    time_limit = int(session.get("time_limit", APP_TIME_LIMIT_SECONDS))

    # --- TIME EXPIRED ---
    if now - started > time_limit+1:
        session["sudoku_attempts_left"] -= 1
        left = session["sudoku_attempts_left"]

        # Clear puzzle so next load gives a new one
        session["sudoku_puzzle"] = None
        session["sudoku_solution"] = None
        session["sudoku_start_ts"] = None

        return jsonify(
            ok=False,
            error="Time expired.",
            attempts_left=left,
            locked=(left <= 0)
        ), 408

    data = request.get_json(silent=True) or {}
    grid = data.get("grid")

    try:
        solution = json.loads(session["sudoku_solution"])
    except Exception:
        return jsonify(ok=False, error="Server state error."), 500

    if not (isinstance(grid, list) and len(grid) == 9 and all(isinstance(r, list) and len(r) == 9 for r in grid)):
        return jsonify(ok=False, error="Invalid grid format."), 400

    # Normalize to ints, reject non 0-9
    try:
        norm = []
        for r in grid:
            row = []
            for v in r:
                iv = int(v)
                if iv < 0 or iv > 9:
                    raise ValueError("out of range")
                row.append(iv)
            norm.append(row)
    except Exception:
        return jsonify(ok=False, error="Grid must contain numbers 0-9."), 400

    # --- WRONG SOLUTION ---
    if norm != solution:
        session["sudoku_attempts_left"] -= 1
        left = session["sudoku_attempts_left"]
        session["sudoku_puzzle"] = None
        session["sudoku_solution"] = None
        session["sudoku_start_ts"] = None

        return jsonify(
            ok=False,
            error="Wrong Sudoku solution.",
            attempts_left=left,
            locked=(left <= 0)
        ), 401

    # --- SUCCESS ---
    session["sudoku_ok"] = True
    return jsonify(ok=True, next="/welcome")

@app.route("/api/logout", methods=["POST"])
def api_logout():
    reset_flow(keep_user=False)
    return jsonify(ok=True, next="/login")

if __name__ == "__main__":
    init_schema()
    app.run(debug=True, host="127.0.0.1", port=8000)
