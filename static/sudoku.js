// static/sudoku.js

const gridEl = document.getElementById("grid");
const msgEl = document.getElementById("msg");
const timerEl = document.getElementById("timer");
const attemptsEl = document.getElementById("attempts");
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

function enterLockoutMode(text) {
  // stop timer
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;

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
          // Keep only 1-9 (single digit)
          const val = inp.value.replace(/[^0-9]/g, "");
          if (val === "0") {
            inp.value = "";
            return;
          }
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
  if (timerHandle) clearInterval(timerHandle);

  timerHandle = setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startedAt;
    const left = Math.max(0, timeLimit - elapsed);

    timerEl.textContent = `Time: ${left}s`;

    if (left <= 0 && !timeoutHandled) {
      timeoutHandled = true;

      clearInterval(timerHandle);
      timerHandle = null;

      try {
        const res = await fetch("/api/sudoku/timeout", { method: "POST" });
        const data = await res.json();

        if (data.ok) {
          attemptsEl.textContent = `Attempts: ${data.attempts_left}`;

          if (data.locked) {
            tryAgainBtn.style.display = "none";
            enterLockoutMode("You're not the right user! Learn more sudoku!");
          } else {
            tryAgainBtn.style.display = "inline-block";
            openModal(`You ran out of time. Attempts left: ${data.attempts_left}.`);
          }
        } else {
          openModal(data.error || "Time expired.");
        }
      } catch (e) {
        openModal("Time expired. Network error—please try again.");
      }
    }
  }, 250);
}

async function loadPuzzle() {
  showMessage("");
  timeoutHandled = false;

  // Reset UI state
  closeModal();
  lockoutEl.classList.add("hidden");
  challengeEl.style.display = "block";
  tryAgainBtn.style.display = "inline-block";

  const res = await fetch("/api/sudoku/puzzle");
  const data = await res.json();

  if (!data.ok) {
    showMessage(data.error || "Failed to load puzzle.", true);
    return;
  }

  // OPTIONAL (recommended): if backend ever returns 0 attempts, lock out immediately
  if (data.attempts_left !== undefined && data.attempts_left <= 0) {
    enterLockoutMode("You have used all Sudoku attempts. Please try again later.");
    return;
  }

  puzzle = data.puzzle;
  startedAt = data.started_at;
  timeLimit = data.time_limit;

  attemptsEl.textContent = `Attempts: ${data.attempts_left}`;
  timerEl.textContent = `Time: ${timeLimit}s`;

  buildGrid(puzzle);
  startTimer();
}

submitBtn.addEventListener("click", async () => {
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
      // If locked, replace screen immediately
      if (data.locked) {
        enterLockoutMode("You have used all Sudoku attempts. Please try again later.");
        return;
      }

      const left = data.attempts_left !== undefined ? ` Attempts left: ${data.attempts_left}.` : "";
      if (data.attempts_left !== undefined) attemptsEl.textContent = `Attempts: ${data.attempts_left}`;

      showMessage(`${data.error || "Wrong answer."}${left}`, true);

      // If time expired, server clears puzzle; reload a fresh one
      if (data.error === "Time expired.") {
        await loadPuzzle();
      }

      return;
    }

    window.location.href = data.next || "/welcome";
  } catch (e) {
    showMessage("Network error. Try again.", true);
  }
});

tryAgainBtn.addEventListener("click", async () => {
  closeModal();
  await loadPuzzle();
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

// Start
loadPuzzle();