import { createWorkersAI } from 'workers-ai-provider';
import { streamText } from 'ai';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const ai = (platform as { env?: { AI?: Ai } } | undefined)?.env?.AI;
	if (!ai) throw new Response('AI binding missing', { status: 500 });

	const { prompt } = (await request.json()) as { prompt?: string };
	if (!prompt?.trim()) throw new Response('prompt required', { status: 400 });

	const workersai = createWorkersAI({ binding: ai });

	const result = streamText({
		model: workersai('@cf/google/gemma-4-26b-a4b-it'),
		system:
			'You are a gentle, kind storyteller who writes short, sweet bedtime-style stories for adults. ' +
			'Use soft, lyrical language, warm imagery, cozy settings, and a tender voice. ' +
			'Keep stories to roughly 250-400 words. Avoid anything dark, scary, or sad. End on a soft, comforting note.',
		prompt
	});

	return result.toTextStreamResponse({
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'content-encoding': 'identity',
			'transfer-encoding': 'chunked'
		}
	});
};
