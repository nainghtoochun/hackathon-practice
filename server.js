import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTaskGenerator } from './gemini.js';
import { validateSuggestions } from './task-schema.js';
import { generationError } from './generation-error.js';

const root = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ generate = createTaskGenerator({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL }), timeoutMs = 90000 } = {}) {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet());
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        // No CORS. Reject cross-origin browser requests before they can spend quota.
        const origin = req.get('origin');
        if ((origin && origin !== `${req.protocol}://${req.get('host')}`) || req.get('sec-fetch-site') === 'cross-site') {
            return res.status(403).json({ error: 'Use the AI generator from this app’s origin.' });
        }
        next();
    });
    app.use('/api', rateLimit({ windowMs: 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
        message: { error: 'Too many requests. Please wait a minute before trying again.' } }));
    app.use('/api', express.json({ limit: '4kb', strict: true }));
    let active = 0;
    app.post('/api/generate-tasks', async (req, res) => {
        if (!req.is('application/json')) return res.status(415).json({ error: 'Send application/json.' });
        const goal = req.body?.goal;
        if (typeof goal !== 'string' || goal.trim().length < 5 || goal.length > 1000) {
            return res.status(400).json({ error: 'Enter a goal between 5 and 1,000 characters.' });
        }
        if (active >= 2) return res.status(429).json({ error: 'The generator is busy. Please try again shortly.' });
        active++;
        const controller = new AbortController();
        let timer;
        const disconnected = () => controller.abort();
        res.on('close', disconnected);
        try {
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('Generation timed out. Please try again.'), { statusCode: 504 })); }, timeoutMs);
            });
            const result = await Promise.race([generate(goal.trim(), controller.signal), timeout]);
            res.json({ tasks: validateSuggestions(result), model: result.model });
        } catch (error) {
            const failure = generationError(error);
            // Fixed diagnostic fields only: no key, prompt, URL, or upstream message.
            console.warn('AI generation failed:', failure.code);
            if (!res.destroyed) res.status(failure.status).json({ error: failure.error, code: failure.code });
        } finally {
            clearTimeout(timer);
            res.off('close', disconnected);
            active--;
        }
    });
    app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
    // Explicit public-file allowlist: .env, source, tests, and node_modules are never served.
    for (const file of ['index.html', 'style.css', 'tasks.js', 'ai-tasks.js', 'task-schema.js']) {
        app.get(file === 'index.html' ? ['/', '/index.html'] : `/${file}`, (req, res) => res.sendFile(path.join(root, file)));
    }
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'Request is too large.' : 'Invalid JSON request.' });
    });
    return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT || 3000);
    createApp().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Task Tracker listening on port ${port}`));
}
