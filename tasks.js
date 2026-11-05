const taskInput = document.getElementById("taskInput");
const columns = Array.from(document.querySelectorAll(".column"));
const storageKey = "task-tracker-tasks";
const statuses = { todo: "To Do", "in-progress": "In Progress", done: "Done" };
let draggedCard = null;

function storageWarning() {
    const notice = document.getElementById("storageNotice");
    notice.textContent = "Browser storage is unavailable or contains unreadable data. You can still use this board, but changes may not survive a refresh.";
    notice.hidden = false;
}

function saveTasks() {
    const tasks = Array.from(document.querySelectorAll(".task-card"), (card) => ({
        text: card.querySelector(".task-text").textContent,
        status: card.closest(".column").dataset.status,
        completed: card.querySelector("input").checked,
    }));
    try {
        localStorage.setItem(storageKey, JSON.stringify(tasks));
    } catch (error) {
        storageWarning();
        console.warn("Tasks could not be saved to localStorage.", error);
    }
}

function updateCounts() {
    columns.forEach((column) => {
        const count = column.querySelector(".task-list").children.length;
        column.querySelector(".count").textContent = count;
        column.querySelector(".empty-state").hidden = count > 0;
    });
}

function moveTask(card, status) {
    const column = columns.find((item) => item.dataset.status === status);
    column.querySelector(".task-list").appendChild(card);
    card.querySelector("input").checked = status === "done";
    card.querySelector(".task-text").classList.toggle("completed", status === "done");
    card.querySelector("select").value = status;
    updateCounts();
    saveTasks();
    document.getElementById("announcement").textContent = `${card.querySelector(".task-text").textContent} moved to ${statuses[status]}.`;
}

function renderTask(text, status = "todo") {
    const card = document.createElement("li");
    card.className = "task-card";
    card.draggable = true;
    const label = document.createElement("label");
    label.className = "task-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = status === "done";
    const taskText = document.createElement("span");
    taskText.className = "task-text";
    taskText.textContent = text;
    taskText.classList.toggle("completed", checkbox.checked);
    checkbox.addEventListener("change", () => {
        moveTask(card, checkbox.checked ? "done" : "todo");
        checkbox.focus();
    });
    label.append(checkbox, taskText);

    const controls = document.createElement("div");
    controls.className = "card-controls";
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Status for task: ${text}`);
    Object.entries(statuses).forEach(([value, name]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        select.appendChild(option);
    });
    select.value = status;
    select.addEventListener("change", () => {
        moveTask(card, select.value);
        select.focus();
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-button";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete task: ${text}`);
    deleteBtn.addEventListener("click", () => {
        const nextCard = card.nextElementSibling || card.previousElementSibling;
        card.remove();
        updateCounts();
        saveTasks();
        (nextCard ? nextCard.querySelector("select") : taskInput).focus();
        document.getElementById("announcement").textContent = `${text} deleted.`;
    });
    controls.append(select, deleteBtn);
    card.append(label, controls);
    card.addEventListener("dragstart", (event) => {
        draggedCard = card;
        event.dataTransfer.setData("text/plain", text);
        event.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
        draggedCard = null;
        card.classList.remove("dragging");
        columns.forEach((column) => column.classList.remove("drop-target"));
    });
    columns.find((column) => column.dataset.status === status).querySelector(".task-list").appendChild(card);
}

columns.forEach((column) => {
    column.addEventListener("dragover", (event) => {
        if (!draggedCard) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        column.classList.add("drop-target");
    });
    column.addEventListener("dragleave", (event) => {
        if (!column.contains(event.relatedTarget)) column.classList.remove("drop-target");
    });
    column.addEventListener("drop", (event) => {
        if (!draggedCard) return;
        event.preventDefault();
        column.classList.remove("drop-target");
        moveTask(draggedCard, column.dataset.status);
    });
});

document.getElementById("taskForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = taskInput.value.trim();
    if (!text) {
        alert("Please enter a task!");
        taskInput.focus();
        return;
    }
    renderTask(text);
    updateCounts();
    saveTasks();
    taskInput.value = "";
    taskInput.focus();
    document.getElementById("announcement").textContent = `${text} added to To Do.`;
});

try {
    const tasks = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(tasks)) throw new Error("Saved tasks must be an array.");
    tasks.forEach((task) => {
        if (!task || typeof task.text !== "string") return;
        // Older versions saved only text and a completion flag.
        const status = Object.hasOwn(statuses, task.status) ? task.status : task.completed === true ? "done" : "todo";
        renderTask(task.text, status);
    });
} catch (error) {
    storageWarning();
    console.warn("Saved tasks could not be loaded from localStorage.", error);
}
updateCounts();
