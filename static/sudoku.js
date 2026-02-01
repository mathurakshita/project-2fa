const gridEl = document.getElementById("grid");
const msgEl = document.getElementById("msg");
const timerEl = document.getElementById("timer");
const attemptsEl = document.getElementById("attempts");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

let puzzle = null;
let startedAt = null;
let timeLimit = null;
let timerHandle = null;

function showMessage(text, isError=false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#ffb3b3" : "#cfe3ff";
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
          // Keep only 1-9
          const val = inp.value.replace(/[^0-9]/g, "");
          if (val === "0") { inp.value = ""; return; }
          if (val.length > 1) inp.value = val[val.length - 1];
          if (inp.value && (parseInt(inp.value,10) < 1 || parseInt(inp.value,10) > 9)) inp.value = "";
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

  timerHandle = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - startedAt;
    const left = Math.max(0, timeLimit - elapsed);
    timerEl.textContent = `Time: ${left}s`;

    if (left <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      showMessage("Time expired. Submit to see remaining attempts.", true);
    }
  }, 250);
}

async function loadPuzzle() {
  showMessage("");
  const res = await fetch("/api/sudoku/puzzle");
  const data = await res.json();

  if (!data.ok) {
    showMessage(data.error || "Failed to load puzzle.", true);
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
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({grid})
    });
    const data = await res.json();

    if (!data.ok) {
      const left = (data.attempts_left !== undefined) ? ` Attempts left: ${data.attempts_left}.` : "";
      attemptsEl.textContent = (data.attempts_left !== undefined) ? `Attempts: ${data.attempts_left}` : attemptsEl.textContent;
      showMessage(`${data.error || "Wrong answer."}${left}`, true);

      // If time expired, server clears the puzzle; reload a fresh one:
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

resetBtn.addEventListener("click", () => resetToPuzzle());

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

loadPuzzle();
