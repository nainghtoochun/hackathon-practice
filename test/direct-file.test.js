import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { fileURLToPath } from 'node:url';

async function openFile(t, storage) {
    const errors = [];
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error));
    const dom = await JSDOM.fromFile(fileURLToPath(new URL('../index.html', import.meta.url)), {
        runScripts: 'dangerously', resources: 'usable', virtualConsole: console,
        beforeParse(window) {
            if (storage) Object.defineProperty(window, 'localStorage', { value: storage });
        },
    });
    t.after(() => dom.window.close());
    await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
    assert.deepEqual(errors, []);
    assert.equal(dom.window.location.protocol, 'file:');
    assert.equal(dom.window.document.querySelector('script[type="module"]'), null);
    return dom.window;
}
function add(window, text) {
    window.document.getElementById('taskInput').value = text;
    window.document.getElementById('taskForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

test('direct index.html loads local scripts and supports the board without module imports', async t => {
    const data = new Map();
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    const window = await openFile(t, storage);
    const document = window.document;
    assert.equal(document.getElementById('generateBtn').disabled, true);
    assert.match(document.getElementById('aiStatus').textContent, /npm start/);
    add(window, '  Local task  ');
    assert.equal(document.querySelector('.task-text').textContent, 'Local task');
    const select = document.querySelector('.task-card select');
    select.value = 'in-progress';
    select.dispatchEvent(new window.Event('change'));
    assert.equal(document.querySelector('[data-status="in-progress"] .task-card') !== null, true);
    document.querySelector('.task-card input').click();
    assert.equal(document.querySelector('[data-status="done"] .completed').textContent, 'Local task');
    assert.equal(JSON.parse(data.get('task-tracker-tasks'))[0].status, 'done');
    const reloaded = await openFile(t, storage);
    assert.equal(reloaded.document.querySelector('[data-status="done"] .task-text').textContent, 'Local task');
    reloaded.document.querySelector('.task-card button').click();
    assert.equal(reloaded.document.querySelectorAll('.task-card').length, 0);
    assert.equal(data.get('task-tracker-tasks'), '[]');
});

test('direct file board remains usable when the browser denies localStorage', async t => {
    const window = await openFile(t);
    add(window, 'Session task');
    assert.equal(window.document.querySelector('.task-text').textContent, 'Session task');
    assert.equal(window.document.getElementById('storageNotice').hidden, false);
    window.document.querySelector('.task-card button').click();
    assert.equal(window.document.querySelectorAll('.task-card').length, 0);
});
