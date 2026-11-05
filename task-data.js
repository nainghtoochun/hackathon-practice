(() => {
// Shared by the server and browser; no credentials or SDK code belongs here.
const taskSchema = {
    type: 'object',
    properties: {
        tasks: {
            type: 'array', minItems: 1, maxItems: 8,
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string', minLength: 1, maxLength: 120 },
                    description: { type: 'string', minLength: 1, maxLength: 600 },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                    estimatedMinutes: { type: 'integer', minimum: 5, maximum: 480 },
                },
                required: ['title', 'description', 'priority', 'estimatedMinutes'],
                additionalProperties: false,
            },
        },
    },
    required: ['tasks'], additionalProperties: false,
};

function validateSuggestions(value) {
    if (!value || !Array.isArray(value.tasks) || value.tasks.length < 1 || value.tasks.length > 8) {
        throw new Error('Expected between 1 and 8 task suggestions.');
    }
    return value.tasks.map((task) => {
        if (!task || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 120 ||
            typeof task.description !== 'string' || !task.description.trim() || task.description.length > 600 ||
            !['low', 'medium', 'high'].includes(task.priority) ||
            !Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes < 5 || task.estimatedMinutes > 480) {
            throw new Error('The AI returned an invalid task suggestion. Please try again.');
        }
        return { title: task.title.trim(), description: task.description.trim(), priority: task.priority, estimatedMinutes: task.estimatedMinutes };
    });
}

globalThis.TaskTrackerData = Object.freeze({ taskSchema, validateSuggestions });
})();
