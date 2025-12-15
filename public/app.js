// public/app.js

const API_BASE = "";

let currentUserId = null;
let currentTasks = [];
let currentProgress = null;

const userSelectEl = document.getElementById("user-select");
const tasksCardEl = document.getElementById("tasks-card");
const taskListEl = document.getElementById("task-list");
const resetBtnEl = document.getElementById("reset-btn");
const progressTextEl = document.getElementById("progress-text");
const progressBarFillEl = document.getElementById("progress-bar-fill");
const toastEl = document.getElementById("toast");

// Fetch wrapper abstraktion
async function apiFetchJson(url, options) {
  const res = await fetch(url, options);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return { ok: res.ok, status: res.status, data };
}

// Henter demo-brugere til dropdown
async function fetchUsers() {
  try {
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/users`);

    if (!ok) {
      userSelectEl.innerHTML = `<option value="">Fejl ved hentning</option>`;
      return;
    }

    const users = data.users || [];
    userSelectEl.innerHTML = "";

    if (!users.length) {
      userSelectEl.innerHTML = `<option value="">Ingen brugere</option>`;
      return;
    }

    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.name}`;
      userSelectEl.appendChild(opt);
    });

    // Vælg users[0] som default
    currentUserId = users[0].id;
    userSelectEl.value = currentUserId;

    // Hent journey for første bruger
    fetchJourney();
  } catch (err) {
    console.error(err);
    userSelectEl.innerHTML = `<option value="">Netværksfejl</option>`;
  }
}

userSelectEl.addEventListener("change", () => {
  const val = userSelectEl.value;
  console.log("Bruger valgt:", val);

  if (!val) {
    currentUserId = null;
    currentTasks = [];
    currentProgress = null;
    renderEmptyState();
    return;
  }

  currentUserId = Number(val);
  fetchJourney();
});

// Henter aktiv onboarding (journey + tasks + progression) for den valgte bruger
async function fetchJourney() {
  if (!currentUserId) {
    renderEmptyState("Vælg en bruger for at se onboarding.");
    return;
  }

  try {
    console.log("Henter onboarding for userId:", currentUserId);
    const { ok, status, data } = await apiFetchJson(
      `${API_BASE}/api/journey?userId=${currentUserId}`
    );

    if (status === 404) {
      console.log("Ingen journeys for denne bruger (userId):", currentUserId);
      currentTasks = [];
      currentProgress = null;
      renderEmptyState("Denne bruger har ingen tildelt onboarding.");
      return;
    }

    if (!ok) {
      renderEmptyState("Kunne ikke hente onboarding.");
      return;
    }

    currentTasks = data.tasks;
    currentProgress = data.progress;

    // reset-knap vises kun hvis der er en journey
    if (resetBtnEl) resetBtnEl.style.display = "";

    renderAll();
  } catch (err) {
    console.error(err);
    renderEmptyState("Kunne ikke hente onboarding.");
  }
}

// Opdaterer UI på med nye data
function renderAll() {
  renderProgress();
  renderTasks();
}
function renderProgress() {
  if (!currentProgress) return;

  const { completed, total, percentage } = currentProgress;
  progressTextEl.textContent = `${completed} af ${total} trin gennemført (${percentage}%)`;
  progressBarFillEl.style.width = `${percentage}%`;
}
function renderTasks() {
  taskListEl.innerHTML = "";

  // Hvis der ikke er tasks, så skjul kortet og stop
  if (!currentTasks || currentTasks.length === 0) {
    if (tasksCardEl) tasksCardEl.style.display = "none";
    return;
  }

  // Hvis der er tasks, så vises kortet
  if (tasksCardEl) tasksCardEl.style.display = "";

  currentTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";

    const info = document.createElement("div");
    info.className = "task-info";

    const status = document.createElement("div");
    status.className = "task-status";
    if (task.completed) {
      status.classList.add("completed");
      status.textContent = "✓";
    }

    const textWrapper = document.createElement("div");

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = `eventType: ${task.event_type}`;

    textWrapper.appendChild(title);
    textWrapper.appendChild(meta);

    info.appendChild(status);
    info.appendChild(textWrapper);

    const btn = document.createElement("button");
    btn.textContent = task.completed ? "Gennemført" : "Simulér handling";
    btn.disabled = !!task.completed;

    btn.addEventListener("click", () => {
      triggerEvent(task.event_type);
    });

    li.appendChild(info);
    li.appendChild(btn);

    taskListEl.appendChild(li);
  });
}

// Sender event til backend, som matcher eventType mod onboarding-opgaver
async function triggerEvent(eventType) {
  if (!currentUserId) {
    showToast("Vælg en bruger først.");
    return;
  }

  try {
    console.log("Simulerer event:", eventType, "for userId:", currentUserId);
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType,
        userId: currentUserId,
        metadata: { source: "simulation" },
      }),
    });

    if (!ok) {
      showToast(data.message || "Fejl ved event.");
      return;
    }

    // Backend returnerer opdateret tasks + progress
    if (data.tasks && data.progress) {
      currentTasks = data.tasks;
      currentProgress = data.progress;
      renderTasks();
      renderProgress();
    }

    if (data.message) {
      showToast(data.message);
    }
  } catch (err) {
    console.error(err);
    showToast("Netværksfejl.");
  }
}

let toastTimeout = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  toastEl.classList.add("visible");

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("visible");
    toastEl.classList.add("hidden");
  }, 2500);
}

resetBtnEl.addEventListener("click", async () => {
  if (!currentUserId) {
    showToast("Vælg en bruger først.");
    return;
  }

  if (!confirm("Er du sikker på, at du vil nulstille onboarding?")) return;

  try {
    console.log("Nulstiller onboarding for userId:", currentUserId);
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });

    if (!ok) {
      showToast(data.message || "Fejl ved reset.");
      return;
    }

    showToast(data.message || "Onboarding nulstillet.");

    // Hent journey-data igen for den nuværende bruger
    fetchJourney();
  } catch (err) {
    console.error(err);
    showToast("Fejl ved reset.");
  }
});

function renderEmptyState(message = "Vælg en bruger for at se onboarding.") {
  taskListEl.innerHTML = "";
  progressTextEl.textContent = message;
  progressBarFillEl.style.width = "0%";

  if (tasksCardEl) tasksCardEl.style.display = "none";
  if (resetBtnEl) resetBtnEl.style.display = "none";
}

// Init
fetchUsers();
