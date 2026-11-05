import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

const tasks = [
    { title: 'Plan demo', description: 'Choose the core flow.', priority: 'high', estimatedMinutes: 30 },
    { title: '<b>Build demo</b>', description: '<img src=x onerror=alert(1)>', priority: 'medium', estimatedMinutes: 60 },
];
const server = createApp({ generate: async () => ({ tasks, model: 'mock-flash' }) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
let browser;
try {
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    const cards = page.locator('.task-card');
    const generate = async () => {
        await page.locator('#aiGoal').fill('Prepare a hackathon demo');
        await page.locator('#generateBtn').click();
        await page.locator('#aiReview').waitFor({ state: 'visible' });
    };
    // Existing data still loads.
    await page.evaluate(() => localStorage.setItem('task-tracker-tasks', JSON.stringify([{ text: 'Legacy task', completed: true }])));
    await page.reload();
    assert.equal(await page.locator('[data-status="done"] .task-card').count(), 1);
    await generate();
    assert.equal(await cards.count(), 1, 'Suggestions must not be added automatically');
    assert.equal(await page.locator('#aiSuggestions li').count(), 2);
    assert.equal(await page.locator('#aiSuggestions img, #aiSuggestions b').count(), 0);
    await page.locator('#aiSuggestions input').first().uncheck();
    await page.locator('#approveBtn').click();
    assert.equal(await cards.count(), 2);
    assert.equal(await page.locator('.task-description').textContent(), tasks[1].description);
    await page.reload();
    assert.equal(await cards.count(), 2);
    assert.equal(await page.locator('.task-metadata').textContent(), 'medium priority · ~60 min');
    assert.equal(await page.locator('.task-card img, .task-card b').count(), 0);
    // Native keyboard controls and drag/drop preserve AI metadata.
    const aiCard = cards.filter({ hasText: tasks[1].title });
    const select = aiCard.getByRole('combobox');
    await select.focus(); await select.press('ArrowDown'); await select.press('Enter');
    assert.equal(await page.locator('[data-status="in-progress"] .task-card').count(), 1);
    await aiCard.dragTo(page.locator('[data-status="done"]'));
    assert.equal(await aiCard.getByRole('checkbox').isChecked(), true);
    await page.reload();
    assert.equal(await page.locator('[data-status="done"] .task-card').count(), 2);
    assert.equal(await page.locator('.task-description').textContent(), tasks[1].description);
    await aiCard.getByRole('checkbox').uncheck();
    await aiCard.getByRole('button').click();
    await page.reload(); assert.equal(await cards.count(), 1);
    // Add/Enter, validation, completion and deleting the final task.
    await page.locator('#taskInput').fill('  Manual task  '); await page.locator('#taskInput').press('Enter');
    assert.equal(await page.locator('#taskInput').inputValue(), '');
    const manual = cards.filter({ hasText: 'Manual task' });
    await manual.getByRole('checkbox').check();
    assert.equal(await manual.locator('.task-text').evaluate(e => getComputedStyle(e).textDecorationLine), 'line-through');
    page.once('dialog', dialog => dialog.accept()); await page.locator('#addTaskBtn').click(); assert.equal(await cards.count(), 2);
    // Discard and double approval cannot add duplicates.
    await generate(); await page.locator('#discardBtn').click(); assert.equal(await cards.count(), 2);
    await generate();
    for (const checkbox of await page.locator('#aiSuggestions input').all()) await checkbox.uncheck();
    assert.equal(await page.locator('#approveBtn').isDisabled(), true);
    await page.locator('#aiSuggestions input').first().check(); await page.locator('#approveBtn').click();
    await page.locator('#approveBtn').evaluate(button => button.click()); assert.equal(await cards.count(), 3);
    // Loading, API error, malformed result and retry.
    await page.route('**/api/generate-tasks', async route => {
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Please wait before retrying.' }) });
    });
    await page.locator('#generateBtn').click();
    assert.equal(await page.locator('#generateBtn').isDisabled(), true);
    await page.locator('#aiError').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#aiError').textContent(), 'Please wait before retrying.');
    assert.equal(await page.locator('#generateBtn').isEnabled(), true);
    await page.unroute('**/api/generate-tasks');
    await page.route('**/api/generate-tasks', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tasks: [{ title: 'Bad' }] }) }));
    await page.locator('#generateBtn').click(); await page.locator('#aiError').waitFor({ state: 'visible' });
    assert.equal(await cards.count(), 3);
    assert.equal(await page.locator('#aiReview').isVisible(), false);
    await page.unroute('**/api/generate-tasks');
    await page.setViewportSize({ width: 375, height: 900 });
    await generate();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: AI loading/error/validation/retry; explicit selective approval/discard; literal text; persistence of metadata; legacy tasks; add/delete/complete; keyboard and drag/drop; mobile layout; no JS errors. Live Gemini was not called.');
} finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
