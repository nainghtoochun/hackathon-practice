const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");

function addTask() {
    const task = taskInput.value.trim();

    if (task === "") {
        alert("Please enter a task!");
        return;
    }

    const li = document.createElement("li");
    li.textContent = task;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete task: ${task}`);
    deleteBtn.addEventListener("click", () => li.remove());
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
    taskInput.value = "";
}

addTaskBtn.addEventListener("click", addTask);
