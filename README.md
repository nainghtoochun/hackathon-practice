# hackathon-practice
Practicing GitHub collaboration for Fall Hacks 2026

## Task Tracker

A responsive Kanban board built with HTML, CSS, and vanilla JavaScript. No build
step or dependencies are required. Serve this directory with
`python3 -m http.server 8000` and open the app in your browser.

- Add a task with the Add Task button or Enter. New tasks start in To Do.
- Drag cards to To Do, In Progress, or Done. On a keyboard or touch device, use
  the status menu on each card instead. Keyboard users can Tab to the menu and
  use arrow keys to choose a status.
- Check a task to move it to Done with strikethrough styling. Uncheck it to move
  it back to To Do. Delete removes the task permanently.
- Tasks and statuses save automatically in this browser's localStorage. Existing
  saved tasks migrate automatically: completed tasks appear in Done and other
  tasks in To Do. Clearing browser storage removes saved tasks; data is not
  synchronized across browsers or devices. If storage is unavailable, the board
  still works for the current session and displays a warning.

### Regression checks

Check adding (including Enter and whitespace validation), deleting, completing
and reopening tasks. Move cards with drag and drop and with the keyboard status
menu, then refresh to verify statuses persist. Existing data under
`task-tracker-tasks` containing `{text, completed}` should load correctly. Check
duplicate task names, long text, empty columns, and a narrow mobile viewport.
