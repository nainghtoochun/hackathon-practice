const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const storageKey = "task-tracker-tasks";

function saveTasks() {
    const tasks = Array.from(taskList.children, (li) => ({
        text: li.querySelector("span").textContent,
        completed: li.querySelector("input").checked,
    }));

    try {
        localStorage.setItem(storageKey, JSON.stringify(tasks));
    } catch (error) {
        console.warn("Tasks could not be saved to localStorage.", error);
    }
}

function addTask() {
    const task = taskInput.value.trim();

    if (task === "") {
        alert("Please enter a task!");
        return;
    }

    renderTask(task);
    saveTasks();
    taskInput.value = "";
}

function renderTask(task, completed = false) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;

    const taskText = document.createElement("span");
    taskText.textContent = task;
    taskText.classList.toggle("completed", completed);
    checkbox.addEventListener("change", () => {
        taskText.classList.toggle("completed", checkbox.checked);
        saveTasks();
    });

    label.append(checkbox, taskText);
    li.appendChild(label);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete task: ${task}`);
    deleteBtn.addEventListener("click", () => {
        li.remove();
        saveTasks();
    });
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
}

addTaskBtn.addEventListener("click", addTask);

try {
    const tasks = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(tasks)) {
        tasks.forEach((task) => {
            if (task && typeof task.text === "string" && typeof task.completed === "boolean") {
                renderTask(task.text, task.completed);
            }
        });
    }
} catch (error) {
    console.warn("Saved tasks could not be loaded from localStorage.", error);
}
