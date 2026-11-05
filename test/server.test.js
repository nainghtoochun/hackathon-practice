import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { validateSuggestions } from '../task-schema.js';
import { createTaskGenerator } from '../gemini.js';

const task = { title: 'Plan the demo', description: 'Define the main user flow.', priority: 'high', estimatedMinutes: 30 };
async function start(t, options = {}) {
    const server = createApp(options).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const url = `http://127.0.0.1:${server.address().port}`;
    return { url, post: (body, headers = {}) => fetch(`${url}/api/generate-tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }) };
}

test('validates structured task fields and bounds', () => {
    assert.deepEqual(validateSuggestions({ tasks: [task] }), [task]);
    for (const value of [null, {}, { tasks: [] }, { tasks: Array(9).fill(task) },
        ...[{ title: ' ' }, { description: null }, { priority: 'urgent' }, { estimatedMinutes: 0 }, { estimatedMinutes: 5.5 }, { estimatedMinutes: 481 }].map(change => ({ tasks: [{ ...task, ...change }] }))]) {
        assert.throws(() => validateSuggestions(value));
    }
});
test('missing API key fails without a network request', async () => {
    await assert.rejects(createTaskGenerator()('Plan a demo', new AbortController().signal), { statusCode: 503 });
});
test('API validates input and returns sanitized suggestions', async t => {
    let received;
    const { post } = await start(t, { generate: async goal => { received = goal; return { tasks: [{ ...task, unexpected: 'omit' }], model: 'test-flash' }; } });
    assert.equal((await post({ goal: ' ' })).status, 400);
    assert.equal((await post({ goal: 'x'.repeat(1001) })).status, 400);
    assert.equal((await post({ goal: {} })).status, 400);
    const response = await post({ goal: '  Plan a demo  ' });
    assert.equal(response.status, 200);
    assert.equal(received, 'Plan a demo');
    assert.deepEqual(await response.json(), { tasks: [task], model: 'test-flash' });
});
test('rejects cross-origin, oversized, and malformed requests', async t => {
    const { post, url } = await start(t, { generate: async () => { throw Error('must not call'); } });
    assert.equal((await post({ goal: 'Plan demo' }, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await post({ goal: 'x'.repeat(5000) })).status, 413);
    const malformed = await fetch(`${url}/api/generate-tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
});
test('rate limits repeated requests', async t => {
    const { post } = await start(t, { generate: async () => ({ tasks: [task] }) });
    for (let i = 0; i < 5; i++) assert.equal((await post({ goal: 'Plan demo' })).status, 200);
    assert.equal((await post({ goal: 'Plan demo' })).status, 429);
});
test('invalid model output and upstream details are never exposed', async t => {
    const { post } = await start(t, { generate: async () => { throw Error('secret upstream detail'); } });
    const response = await post({ goal: 'Plan demo' });
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('secret upstream'));
    const invalid = await start(t, { generate: async () => ({ tasks: [{ ...task, priority: 'bad' }] }) });
    assert.equal((await invalid.post({ goal: 'Plan demo' })).status, 502);
});
test('timeouts and concurrency are bounded', async t => {
    const { post } = await start(t, { generate: () => new Promise(() => {}), timeoutMs: 100 });
    const first = post({ goal: 'Plan demo' });
    const second = post({ goal: 'Plan demo' });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await post({ goal: 'Plan demo' })).status, 429);
    assert.equal((await first).status, 504);
    assert.equal((await second).status, 504);
});
test('serves only public assets, never backend files or environment files', async t => {
    const { url } = await start(t);
    for (const file of ['/', '/tasks.js', '/ai-tasks.js', '/task-schema.js', '/style.css']) {
        const response = await fetch(url + file);
        assert.equal(response.status, 200);
        assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
    }
    for (const file of ['/.env', '/.env.example', '/server.js', '/gemini.js', '/package.json', '/node_modules/express/package.json', '/.git/config']) {
        assert.equal((await fetch(url + file)).status, 404);
    }
});

test('official SDK integration discovers an accessible Flash model and requests structured JSON', async () => {
    let request;
    const client = { models: {
        list: async () => (async function* () {
            yield { name: 'models/gemini-2.5-flash', supportedActions: ['generateContent'] };
            yield { name: 'models/gemini-image-flash', supportedActions: ['generateContent'] };
        })(),
        generateContent: async params => { request = params; return { text: JSON.stringify({ tasks: [task] }) }; },
    } };
    const result = await createTaskGenerator({ client })('Plan demo', new AbortController().signal);
    assert.equal(result.model, 'gemini-2.5-flash');
    assert.deepEqual(result.tasks, [task]);
    assert.equal(request.config.responseMimeType, 'application/json');
    assert.equal(request.config.responseJsonSchema.properties.tasks.maxItems, 8);
    assert.ok(request.config.abortSignal instanceof AbortSignal);
    await assert.rejects(createTaskGenerator({ client, model: 'gemini-unavailable-flash' })('Plan demo'), { statusCode: 503 });
    client.models.generateContent = async () => ({ text: '{bad JSON' });
    await assert.rejects(createTaskGenerator({ client })('Plan demo'), { code: 'AI_INVALID_RESPONSE' });
});


test('safe diagnostic codes distinguish access, quota, model and output failures', async t => {
    const cases = [
        [{ status: 400 }, 'GEMINI_REQUEST_REJECTED', 502],
        [{ status: 401 }, 'GEMINI_ACCESS_DENIED', 502],
        [{ status: 403 }, 'GEMINI_ACCESS_DENIED', 502],
        [{ status: 404 }, 'GEMINI_MODEL_UNAVAILABLE', 502],
        [{ status: 429 }, 'GEMINI_QUOTA', 429],
        [{ code: 'AI_INVALID_RESPONSE' }, 'AI_INVALID_RESPONSE', 502],
        [{ code: 'AI_BLOCKED' }, 'AI_BLOCKED', 422],
    ];
    for (const [properties, code, status] of cases) {
        const { post } = await start(t, { generate: async () => { throw Object.assign(new Error('private-key-and-prompt'), properties); } });
        const response = await post({ goal: 'Prepare demo' });
        assert.equal(response.status, status);
        const body = await response.json();
        assert.equal(body.code, code);
        assert.ok(!JSON.stringify(body).includes('private-key-and-prompt'));
    }
});


test('automatic selection prefers a newer stable Flash over a listed retired model', async () => {
    let selected;
    const client = { models: {
        list: async () => (async function* () {
            for (const name of ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-tts', 'gemini-3.9-flash-preview']) {
                yield { name: `models/${name}`, supportedActions: ['generateContent'] };
            }
        })(),
        generateContent: async params => { selected = params.model; return { text: JSON.stringify({ tasks: [task] }) }; },
    } };
    await createTaskGenerator({ client })('Plan demo');
    assert.equal(selected, 'gemini-3.8-flash');
    await createTaskGenerator({ client, model: ' models/gemini-3.8-flash ' })('Plan demo');
    assert.equal(selected, 'gemini-3.8-flash');
});

test('a slow generation can complete within its deadline', async t => {
    const { post } = await start(t, {
        timeoutMs: 1000,
        generate: async () => {
            await new Promise(resolve => setTimeout(resolve, 150));
            return { tasks: [task] };
        },
    });
    const response = await post({ goal: 'Prepare a demo' });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).tasks, [task]);
});
