# hackathon-practice
Practicing GitHub collaboration for Fall Hacks 2026

## Task Tracker

A responsive Kanban board built with HTML, CSS, and vanilla JavaScript, with a
small Express server for optional Gemini task generation. No frontend build step
is required.

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


## Run locally (Node.js 22.9 or newer)

```bash
npm ci
cp .env.example .env
# Edit .env: set GEMINI_API_KEY to your own key. Never commit .env.
npm start
```

Open `http://127.0.0.1:3000`. For automatic server restarts, run `npm run dev`
instead. `PORT` defaults to 3000 and `HOST` to 127.0.0.1. Restart the server after
changing environment variables. Production can inject environment variables
directly without a .env file. The manual board works without a Gemini key;
AI requests will return a configuration error until the server has a key.

### AI Generate Tasks

Enter a goal (5–1,000 characters) and choose **Generate suggestions**. Nothing is
added automatically. Review the proposed titles, descriptions, priorities, and
estimated durations; deselect unwanted suggestions, then choose **Add selected
tasks**, or discard them. Approved tasks start in To Do and keep their metadata
across refreshes, moves, completion, and deletion.

The browser sends only the goal to `POST /api/generate-tasks` on the same origin.
The Express server calls the official `@google/genai` SDK and reads
`GEMINI_API_KEY` only from its environment. The key is never returned to the
browser or stored in localStorage. Goals are sent to Google Gemini; avoid
sensitive information. Normal board tasks stay in this browser's localStorage.

On each generation, the server lists models accessible to the configured key and
selects an available stable Gemini Flash text model supporting `generateContent`.
It prefers the newest listed stable version of Flash. Model discovery can still
include models unavailable to new users; use an explicit `GEMINI_MODEL` override
when Google recommends a specific replacement. To select a specific accessible Flash model
(including a preview if desired), set `GEMINI_MODEL` to its exact model ID. If no
matching model is available, generation fails clearly rather than assuming
project access. The model is requested to return schema-constrained JSON; the
server and browser independently validate every task. Estimates are integer
minutes from 5 to 480, with low/medium/high priority, and at most 8 suggestions.

The API requires outbound HTTPS access to `generativelanguage.googleapis.com`.
Billing, quota, supported regions, API restrictions, and model access must be
configured in your Google project. A screenshot or a checked-in key is not a safe
configuration method: revoke exposed keys and put replacements in server
configuration only. See the [official SDK](https://github.com/googleapis/js-genai)
and [Gemini model documentation](https://ai.google.dev/gemini-api/docs/models).

### Request safeguards

- Same-origin browser requests only; no permissive CORS. JSON bodies are limited
  to 4 KB, with server-side goal validation.
- Five API requests per minute per IP, two concurrent generations per process,
  and a 90-second server timeout (95 seconds in the browser).
- Generation errors never return raw upstream details. No prompts or keys are
  logged by the application. Only an explicit allowlist of public assets is served.
- This is a local development app, not a public multi-user service. Before exposing
  it, add authentication and shared quota/rate-limit storage. In-memory limits
  reset on restart and are per process. Configure proxy trust deliberately if
  deploying behind a reverse proxy. Aborting a request may not stop provider billing.

### Automated checks

```bash
npm test
npx playwright install chromium
npm run test:browser
# Or use an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Backend tests cover schemas, SDK model discovery/configuration with simulated
responses, invalid requests, rate/concurrency limits, timeouts, sanitized errors,
and private-file protection. Browser checks use a simulated AI response and cover
selective approval, discard, loading/error/retry, persistence of metadata, legacy
data, adding/deleting/completing tasks, keyboard status changes, drag and drop,
and mobile overflow. They make no paid Gemini requests.

For a live check, configure a valid replacement `GEMINI_API_KEY`, start the server,
generate a small goal, review the suggestions, approve one, and refresh. Live
project model access and quota were not verified during implementation because
no server-side key was configured.


### Troubleshoot generation failures

The error shown below the AI form now distinguishes access restrictions, quota,
model availability, and invalid generated data. The server terminal also prints
a fixed diagnostic code (never a key, goal, or raw Google error).

- `GEMINI_ACCESS_DENIED` / `GEMINI_REQUEST_REJECTED`: check the server-side key,
  project/API restrictions, and region eligibility in Google AI Studio.
- `GEMINI_QUOTA`: check the selected project's Gemini quota and billing.
- `GEMINI_MODEL_UNAVAILABLE` / `AI_CONFIGURATION`: clear an outdated
  `GEMINI_MODEL` override, confirm `GEMINI_API_KEY` is set, then restart.
- `AI_INVALID_RESPONSE`: the generated JSON was incomplete or failed validation;
  retry with a smaller goal.
- `AI_BLOCKED`: rephrase the goal.
- `GEMINI_UNAVAILABLE` / `AI_TIMEOUT`: check outbound network access and retry.

After changing `.env`, stop the server with Ctrl+C and rerun `npm start`. Never
share the key or the contents of `.env` when asking for troubleshooting help.


### Automatic recovery from overloaded or retired models

The configured model is tried first. Generation failures with HTTP 404 skip that
model; transient HTTP 500/502/503/504 failures retry with short backoff, preferring
other listed stable Flash models (Lite alternatives first). At most four
SDK generation calls are made per user request, each capped at 18 seconds,
within the existing 90-second server deadline. SDK-level automatic retries are
disabled to prevent nested retry loops. Model listing has a 10-second deadline.
Cancellation stops further attempts. The server returns the actual model used.

No retry is made for auth errors, quota (429), bad requests, blocked goals, or
invalid generated data. Additional attempts may incur usage. If all attempts
fail with provider overload (503), the UI explains that Gemini is busy; it does
not blame your internet connection or add invented tasks. Automatic fallback
cannot guarantee provider capacity. Manual board functions remain available.


### Open index.html directly

You can double-click `index.html` to use the regular board without Node or a web
server. Adding, deleting, completion, drag/drop, and keyboard status controls work
in this mode. Browser scripts use ordinary deferred scripts, so they do not
require module imports over HTTP. AI controls display startup instructions and
are disabled until you open the Express-served app; the API key stays server-side.

Browsers may restrict localStorage for local files. The board attempts to save
normally and shows a warning if storage is unavailable. File-mode data and
`http://127.0.0.1:3000` data have separate storage; keep using the same address
for a consistent saved board. Reliable persistence across browsers is best
supported through `npm start`.
