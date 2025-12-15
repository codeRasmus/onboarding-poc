// public/admin.js

const API_BASE = "";
const toastEl = document.getElementById("toast");
const overviewContainer = document.getElementById("overview-container");
const journeyForm = document.getElementById("journey-form");
const journeyNameInput = document.getElementById("journey-name");
const journeyDescriptionInput = document.getElementById("journey-description");
const tasksContainer = document.getElementById("tasks-container");
const addTaskBtn = document.getElementById("add-task-btn");
const journeysListEl = document.getElementById("journeys-list");
const resetJourneysBtn = document.getElementById("reset-journeys-btn");
const assignUserSelect = document.getElementById("assign-user-select");
const assignHelperTextEl = document.getElementById("assign-helper-text");

let selectedUserId = "";
let toastTimeout = null;

// Fetch wrapper
async function apiFetchJson(url, options) {
  const res = await fetch(url, options);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {}; // Undgår at applikationen crasher hvis responsen ikke er JSON
  }

  return { ok: res.ok, status: res.status, data };
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  toastEl.classList.add("visible");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("visible");
    toastEl.classList.add("hidden");
  }, 2500);
}

// Tilføj en tom task-row
function addTaskRow(initial = {}) {
  const row = document.createElement("div");
  row.className = "task-row";

  row.innerHTML = `
    <input 
      type="text" 
      class="task-title-input" 
      placeholder="Titel (f.eks. 'Opret første dokument')" 
      value="${initial.title || ""}"
    />
    <input 
      type="text" 
      class="task-event-input" 
      placeholder="eventType (f.eks. 'document_created')" 
      value="${initial.eventType || ""}"
    />
    <button type="button" class="task-remove-btn">✕</button>
  `;

  row.querySelector(".task-remove-btn").addEventListener("click", () => {
    tasksContainer.removeChild(row);
  });

  tasksContainer.appendChild(row);
}

addTaskBtn.addEventListener("click", () => {
  console.log("Tilføjer ny task-row");
  addTaskRow();
});

// Henter journeys + tasks og viser dem i admin-oversigten
async function fetchJourneys() {
  journeysListEl.innerHTML = "Indlæser...";

  try {
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/admin/journeys`);
    if (!ok) {
      journeysListEl.textContent = data.message || "Fejl ved hentning.";
      return;
    }
    console.log("Journeys modtaget:", (data.journeys || []).length);
    renderJourneys(data.journeys || []);
  } catch (err) {
    console.error(err);
    journeysListEl.textContent = "Fejl ved hentning.";
  }
}

function renderJourneys(journeys) {
  updateAssignHelperText(journeys.length > 0);

  if (!journeys.length) {
    journeysListEl.textContent = "Ingen journeys oprettet endnu.";
    return;
  }

  journeysListEl.innerHTML = "";

  journeys.forEach((j) => {
    const card = document.createElement("div");
    card.className = "admin-journey-card";

    const header = document.createElement("div");
    header.className = "admin-journey-header";

    const title = document.createElement("h3");
    title.textContent = `${j.id}: ${j.name}`;

    const desc = document.createElement("p");
    desc.className = "admin-journey-desc";
    desc.textContent = j.description || "(ingen beskrivelse)";

    header.appendChild(title);
    header.appendChild(desc);

    const tasksList = document.createElement("ul");
    tasksList.className = "admin-task-list";

    (j.tasks || []).forEach((t) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${t.sort_order}.</strong> ${t.title} 
        <span class="admin-task-meta">eventType: ${t.event_type}</span>
      `;
      tasksList.appendChild(li);
    });

    card.appendChild(header);
    card.appendChild(tasksList);

    const actions = document.createElement("div");
    actions.style.marginTop = "0.5rem";
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";

    const assignBtn = document.createElement("button");
    assignBtn.textContent = "Tildel til valgt bruger";

    assignBtn.addEventListener("click", async () => {
      if (!selectedUserId) {
        showToast("Vælg først en bruger i dropdown'en.");
        return;
      }

      try {
        console.log("Tildeler journey", j.id, "til userId", selectedUserId);
        const { ok, data } = await apiFetchJson(
          `${API_BASE}/api/admin/assign-journey`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: Number(selectedUserId),
              journeyId: j.id,
            }),
          }
        );

        if (!ok) {
          showToast(data.message || "Fejl ved tildeling.");
          return;
        }

        showToast(data.message || "Journey tildelt.");
        fetchOverview();
      } catch (err) {
        console.error(err);
        showToast("Netværksfejl ved tildeling.");
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Slet journey";
    deleteBtn.classList.add("danger-btn");

    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Er du sikker på, at du vil slette journey "${j.name}"?`)) {
        return;
      }

      try {
        const { ok, data } = await apiFetchJson(
          `${API_BASE}/api/admin/journeys/${j.id}`,
          { method: "DELETE" }
        );

        if (!ok) {
          showToast(data.message || "Fejl ved sletning.");
          return;
        }

        showToast(data.message || "Journey slettet.");
        fetchJourneys();
      } catch (err) {
        console.error(err);
        showToast("Netværksfejl ved sletning.");
      }
    });

    actions.appendChild(assignBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    journeysListEl.appendChild(card);
  });
}

// Opret journey + tasks fra formularen
journeyForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = journeyNameInput.value.trim();
  const description = journeyDescriptionInput.value.trim();

  const taskRows = tasksContainer.querySelectorAll(".task-row");
  const tasks = [];

  taskRows.forEach((row) => {
    const titleInput = row.querySelector(".task-title-input");
    const eventInput = row.querySelector(".task-event-input");
    const title = titleInput.value.trim();
    const eventType = eventInput.value.trim();
    if (title && eventType) {
      tasks.push({ title, eventType });
    }
  });

  if (!name || tasks.length === 0) {
    showToast("Navn og mindst ét trin er påkrævet.");
    return;
  }

  try {
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/admin/journeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, tasks }),
    });

    if (!ok) {
      showToast(data.message || "Fejl ved oprettelse.");
      return;
    }

    showToast(data.message || "Journey oprettet.");

    journeyNameInput.value = "";
    journeyDescriptionInput.value = "";
    tasksContainer.innerHTML = "";
    addTaskRow();

    fetchJourneys();
  } catch (err) {
    console.error(err);
    showToast("Netværksfejl.");
  }
});

function updateAssignHelperText(hasJourneys) {
  if (!assignHelperTextEl) return;

  if (!hasJourneys) {
    assignHelperTextEl.textContent =
      "Der er ingen journeys at tildele lige nu. Opret et journey ovenfor først.";
    return;
  }

  assignHelperTextEl.textContent =
    "Når du har valgt en bruger her, kan du tildele en journey til vedkommende via knapperne nedenfor.";
}

// Henter brugere til tildelings-dropdown
async function fetchUsers() {
  try {
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/admin/users`);

    if (!ok) {
      showToast(data.message || "Fejl ved hentning af brugere.");
      return;
    }

    const users = data.users || [];
    renderUserSelect(users);
  } catch (err) {
    console.error(err);
    showToast("Fejl ved hentning af brugere.");
  }
}

function renderUserSelect(users) {
  assignUserSelect.innerHTML = `<option value="">-- Vælg bruger --</option>`;

  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.name}`;
    assignUserSelect.appendChild(opt);
  });
}

assignUserSelect.addEventListener("change", () => {
  selectedUserId = assignUserSelect.value;
  console.log("Valgt bruger til tildeling:", selectedUserId || "(ingen)");
});

resetJourneysBtn.addEventListener("click", async () => {
  if (
    !confirm(
      "Er du sikker på, at du vil slette ALLE journeys? Dette kan ikke fortrydes."
    )
  ) {
    return;
  }

  try {
    console.log("Resetter alle journeys");
    const { ok, data } = await apiFetchJson(
      `${API_BASE}/api/admin/journeys/reset`,
      { method: "POST" }
    );

    if (!ok) {
      showToast(data.message || "Fejl ved reset af journeys.");
      return;
    }

    showToast(data.message || "Alle journeys er slettet.");
    fetchJourneys();
    fetchOverview();
  } catch (err) {
    console.error(err);
    showToast("Netværksfejl ved reset.");
  }
});

// Henter admin-overblik (tildelte journeys + tasks + progression pr. bruger)
async function fetchOverview() {
  if (!overviewContainer) return;

  overviewContainer.textContent = "Indlæser...";
  try {
    const { ok, data } = await apiFetchJson(`${API_BASE}/api/admin/overview`);

    if (!ok) {
      overviewContainer.textContent =
        data.message || "Fejl ved hentning af overblik.";
      return;
    }
    console.log("Overview opdateret:", (data.entries || []).length, "rækker");
    renderOverview(data.entries || []);
  } catch (err) {
    console.error(err);
    overviewContainer.textContent = "Fejl ved hentning af overblik.";
  }
}

function renderOverview(entries) {
  if (!entries.length) {
    overviewContainer.textContent =
      "Ingen tildelte journeys endnu eller ingen opgaver i journeys.";
    return;
  }

  const table = document.createElement("table");
  table.className = "admin-overview-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Bruger</th>
      <th>Journey</th>
      <th>Gennemført</th>
      <th>Total</th>
      <th>Status</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  entries.forEach((row) => {
    const tr = document.createElement("tr");

    const total = row.total_tasks || 0;
    const done = row.completed_tasks || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let statusText = "Ingen opgaver";
    let statusClass = "admin-overview-status admin-overview-status--empty";

    if (total > 0 && done >= total) {
      statusText = "Gennemført";
      statusClass = "admin-overview-status admin-overview-status--done";
    } else if (total > 0) {
      statusText = `${pct}% – I gang`;
      statusClass = "admin-overview-status admin-overview-status--progress";
    }

    tr.innerHTML = `
      <td>${row.user_name}</td>
      <td>${row.journey_name}</td>
      <td>${done}</td>
      <td>${total}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  overviewContainer.innerHTML = "";
  overviewContainer.appendChild(table);
}

// Init
addTaskRow();
fetchUsers();
fetchJourneys();
fetchOverview();
