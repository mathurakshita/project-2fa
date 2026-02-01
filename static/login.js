const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

function showMessage(text, isError = false) {
  msg.textContent = text;
  msg.style.color = isError ? "#ffb3b3" : "#cfe3ff";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();

    if (!data.ok) {
      const left = (data.attempts_left !== undefined) ? ` ${data.attempts_left} attempts left.` : "";
      showMessage(`${data.error}.${left}`, true);
      return;
    }

    window.location.href = data.next || "/sudoku";
  } catch (err) {
    showMessage("Network error. Try again.", true);
  }
});
