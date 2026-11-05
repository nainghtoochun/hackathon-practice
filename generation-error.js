// Only fixed messages/codes leave the server. Never expose raw SDK errors.
export function generationError(error) {
    const upstream = Number(error?.status);
    if (error?.code === 'AI_INVALID_RESPONSE') return { status: 502, code: 'AI_INVALID_RESPONSE', error: 'Gemini returned incomplete or invalid task data. Please try generating again.' };
    if (error?.code === 'AI_BLOCKED') return { status: 422, code: 'AI_BLOCKED', error: 'Gemini could not generate tasks for this goal. Please rephrase it and try again.' };
    if (error?.statusCode === 503) return { status: 503, code: 'AI_CONFIGURATION', error: 'AI generation is not configured or no supported Flash model is available. Check GEMINI_API_KEY and GEMINI_MODEL on the server, then restart it.' };
    if (error?.statusCode === 504 || upstream === 504) return { status: 504, code: 'AI_TIMEOUT', error: 'Generation timed out. Please try again.' };
    if (upstream === 503) return { status: 503, code: 'GEMINI_BUSY', error: 'Gemini is experiencing high demand. Available model retries did not succeed. Please try again in a few minutes; your board is unchanged.' };
    if (upstream === 401 || upstream === 403) return { status: 502, code: 'GEMINI_ACCESS_DENIED', error: 'Gemini rejected server access. Check that GEMINI_API_KEY is valid, its project enables the Gemini API, and its API restrictions allow this request. Restart after changing the key.' };
    if (upstream === 400) return { status: 502, code: 'GEMINI_REQUEST_REJECTED', error: 'Gemini rejected the server request. Check the API key, project and region eligibility, and GEMINI_MODEL configuration.' };
    if (upstream === 404) return { status: 502, code: 'GEMINI_MODEL_UNAVAILABLE', error: 'The selected Gemini model is no longer available. Clear GEMINI_MODEL to use automatic selection, then restart the server.' };
    if (upstream === 429) return { status: 429, code: 'GEMINI_QUOTA', error: 'Gemini quota is exhausted. Check this project’s Gemini API quota and billing before retrying.' };
    return { status: 502, code: 'GEMINI_UNAVAILABLE', error: 'Could not reach Gemini or complete generation. Check the server’s internet access and try again.' };
}
