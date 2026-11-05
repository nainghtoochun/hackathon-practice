import { addApprovedTasks } from './tasks.js';
import { validateSuggestions } from './task-schema.js';

const form = document.getElementById('aiForm');
const goal = document.getElementById('aiGoal');
const generateBtn = document.getElementById('generateBtn');
const approveBtn = document.getElementById('approveBtn');
const review = document.getElementById('aiReview');
const list = document.getElementById('aiSuggestions');
const status = document.getElementById('aiStatus');
const error = document.getElementById('aiError');
let suggestions = [];
let busy = false;

function clearReview() {
    suggestions = [];
    list.replaceChildren();
    review.hidden = true;
}
function showError(message) {
    error.textContent = message;
    error.hidden = false;
}
function updateApproval() {
    approveBtn.disabled = !list.querySelector('input:checked');
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    error.hidden = true;
    const text = goal.value.trim();
    if (text.length < 5 || text.length > 1000) {
        showError('Enter a goal between 5 and 1,000 characters.');
        goal.focus();
        return;
    }
    clearReview();
    busy = true;
    generateBtn.disabled = true;
    goal.readOnly = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Turning your goal into tasks…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
        const response = await fetch('/api/generate-tasks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: text }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Generation failed. Please try again.');
        suggestions = validateSuggestions(data);
        suggestions.forEach((task, index) => {
            const item = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = index;
            checkbox.checked = true;
            checkbox.addEventListener('change', updateApproval);
            const title = document.createElement('strong');
            title.textContent = task.title;
            label.append(checkbox, title);
            const description = document.createElement('p');
            description.textContent = task.description;
            const metadata = document.createElement('p');
            metadata.className = 'task-metadata';
            metadata.textContent = `${task.priority} priority · ~${task.estimatedMinutes} min`;
            item.append(label, description, metadata);
            list.appendChild(item);
        });
        review.hidden = false;
        updateApproval();
        status.textContent = `${suggestions.length} suggestions ready. Nothing has been added yet.`;
        list.querySelector('input').focus();
    } catch (failure) {
        status.textContent = '';
        showError(failure.name === 'AbortError' ? 'Generation timed out. Please try again.' :
            failure instanceof TypeError || failure instanceof SyntaxError ? 'Could not reach the AI service. Start the Express server and try again.' : failure.message);
    } finally {
        clearTimeout(timer);
        busy = false;
        generateBtn.disabled = false;
        goal.readOnly = false;
        form.removeAttribute('aria-busy');
    }
});

approveBtn.addEventListener('click', () => {
    const selected = Array.from(list.querySelectorAll('input:checked'), (input) => suggestions[Number(input.value)]);
    if (!selected.length) return;
    addApprovedTasks(validateSuggestions({ tasks: selected }));
    clearReview();
    status.textContent = `${selected.length} tasks added to To Do.`;
    generateBtn.focus();
});
document.getElementById('discardBtn').addEventListener('click', () => {
    clearReview();
    status.textContent = 'Suggestions discarded. Your board is unchanged.';
    goal.focus();
});
