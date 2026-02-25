// static/sudoku.js

const gridEl = document.getElementById("grid");
const msgEl = document.getElementById("msg");
const timerEl = document.getElementById("timer");
const heartsEl = document.getElementById("hearts");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Modal elements
const timeoutModal = document.getElementById("timeoutModal");
const modalText = document.getElementById("modalText");
const tryAgainBtn = document.getElementById("tryAgainBtn");

// Lockout screen elements
const lockoutEl = document.getElementById("lockout");
const lockoutTextEl = document.getElementById("lockoutText");
const challengeEl = document.getElementById("challenge");
const backToLoginBtn = document.getElementById("backToLoginBtn");

let puzzle = null;
let startedAt = null;
let timeLimit = null;
let timerHandle = null;
let timeoutHandled = false; // prevents double timeout calls
let isSubmitting = false;   // prevents double-submit (button spam / timer race)
const MAX_LIVES = 3;
let lastAttemptsLeft = null;

function renderHearts(attemptsLeft, animateLoss = false) {
  if (!heartsEl) return;

  // First draw: just render with a small pop
  if (lastAttemptsLeft === null) {
    lastAttemptsLeft = attemptsLeft;
  }

  const prev = lastAttemptsLeft;
  heartsEl.innerHTML = "";

  for (let i = 0; i < MAX_LIVES; i++) {
    const span = document.createElement("span");
    const isAlive = i < attemptsLeft;

    span.className = "heart";
    span.textContent = "❤";

    if (!isAlive) span.classList.add("lost");

    // Animate the specific heart that was just lost
    // Example: prev=3, attemptsLeft=2 => heart index 2 was lost (0-based)
    if (animateLoss && attemptsLeft < prev) {
      const lostIndex = attemptsLeft; // the first "lost" position
      if (i === lostIndex) {
        span.classList.add("break");
      }
    } else {
      span.classList.add("pop");
    }

    heartsEl.appendChild(span);
  }

  lastAttemptsLeft = attemptsLeft;
}

function showMessage(text, isError = false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#ffb3b3" : "#cfe3ff";
}

function openModal(text) {
  modalText.textContent = text;
  timeoutModal.classList.remove("hidden");
}

function closeModal() {
  timeoutModal.classList.add("hidden");
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function enterLockoutMode(text) {
  stopTimer();

  // hide sudoku UI, show lockout
  challengeEl.style.display = "none";
  lockoutEl.classList.remove("hidden");
  lockoutTextEl.textContent = text;

  // hide modal if open
  closeModal();
}

function buildGrid(puz) {
  gridEl.innerHTML = "";

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (c === 2 || c === 5) cell.classList.add("thick-right");
      if (r === 2 || r === 5) cell.classList.add("thick-bottom");

      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "1";
      inp.max = "9";
      inp.inputMode = "numeric";

      const v = puz[r][c];
      if (v !== 0) {
        inp.value = v;
        inp.disabled = true;
        cell.classList.add("given");
      } else {
        inp.value = "";
        inp.addEventListener("input", () => {
          const val = inp.value.replace(/[^0-9]/g, "");
          if (val === "0") { inp.value = ""; return; }
          if (val.length > 1) inp.value = val[val.length - 1];
          if (inp.value) {
            const n = parseInt(inp.value, 10);
            if (n < 1 || n > 9) inp.value = "";
          }
        });
      }

      cell.appendChild(inp);
      gridEl.appendChild(cell);
    }
  }
}

function readGrid() {
  const cells = gridEl.querySelectorAll(".cell input");
  const out = [];

  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      const inp = cells[r * 9 + c];
      const v = inp.value === "" ? 0 : parseInt(inp.value, 10);
      row.push(isNaN(v) ? 0 : v);
    }
    out.push(row);
  }
  return out;
}

function resetToPuzzle() {
  if (!puzzle) return;
  buildGrid(puzzle);
  showMessage("");
}

function startTimer() {
  stopTimer();

  timerHandle = setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startedAt;
    const left = Math.max(0, timeLimit - elapsed);

    timerEl.textContent = `Time: ${left}s`;

    // Timer expiry triggers auto-submit exactly once
    if (left <= 0 && !timeoutHandled) {
      timeoutHandled = true;
      stopTimer();

      // Prevent collision with manual submit
      if (!isSubmitting) {
        await autoSubmitOnTimeout();
      }
    }
  }, 250);
}

async function loadPuzzle() {
  // reset flags for a new attempt
  timeoutHandled = false;
  isSubmitting = false;

  // Reset UI state
  showMessage("");
  closeModal();
  lockoutEl.classList.add("hidden");
  challengeEl.style.display = "block";
  tryAgainBtn.style.display = "inline-block";

  try {
    const res = await fetch("/api/sudoku/puzzle");
    const data = await res.json();

    if (!data.ok) {
      // If backend says locked, show lockout
      if (data.locked) {
        window.location.href = "/failed";
        return;
      }
      // Otherwise show a message and stop (don’t recurse infinitely)
      showMessage(data.error || "Failed to load puzzle.", true);
      return;
    }

    if (data.attempts_left !== undefined && data.attempts_left <= 0) {
      window.location.href = "/failed";
      return; 
    }

    puzzle = data.puzzle;
    startedAt = data.started_at;
    timeLimit = data.time_limit;

    lastAttemptsLeft = null;
    renderHearts(data.attempts_left, false);
    timerEl.textContent = `Time: ${timeLimit}s`;

    buildGrid(puzzle);
    startTimer();
  } catch (e) {
    showMessage("Network error while loading puzzle.", true);
  }
}

async function handleFailedAttempt(data) {
  // data: { error, attempts_left, locked }

  if (data.locked) {
    window.location.href = "/failed";
    return;
  }

  if (data.attempts_left !== undefined) {
    renderHearts(data.attempts_left, true);
  }

  // Show modal and let user click "Try again" to start a fresh attempt (fresh timer)
  tryAgainBtn.style.display = "inline-block";
  openModal(`${data.error || "Wrong answer."} Attempts left: ${data.attempts_left}.`);
}

submitBtn.addEventListener("click", async () => {
  if (isSubmitting) return;
  isSubmitting = true;

  showMessage("");

  const grid = readGrid();

  try {
    const res = await fetch("/api/sudoku/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid }),
    });

    const data = await res.json();

    if (!data.ok) {
      await handleFailedAttempt(data);
      return;
    }

    window.location.href = data.next || "/welcome";
  } catch (e) {
    showMessage("Network error. Try again.", true);
  } finally {
    // allow resubmission if still on the page
    isSubmitting = false;
  }
});

tryAgainBtn.addEventListener("click", async () => {
  closeModal();
  await loadPuzzle(); // fresh attempt => fresh timer
});

resetBtn.addEventListener("click", () => resetToPuzzle());

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

backToLoginBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

async function autoSubmitOnTimeout() {
  if (isSubmitting) return;
  isSubmitting = true;

  const grid = readGrid();

  try {
    const res = await fetch("/api/sudoku/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid }),
    });

    const data = await res.json();

    if (data.ok) {
      window.location.href = data.next || "/welcome";
      return;
    }

    await handleFailedAttempt(data);
  } catch (e) {
    tryAgainBtn.style.display = "inline-block";
    openModal("Time expired. Could not auto-submit due to a network error. Please try again.");
  } finally {
    isSubmitting = false;
  }
}

// Start
loadPuzzle();