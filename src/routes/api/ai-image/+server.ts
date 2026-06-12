import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = env.TOGETHER_API_KEY ?? platform?.env?.TOGETHER_API_KEY;
	if (!apiKey) throw error(500, 'TOGETHER_API_KEY not configured');

	const { prompt } = await request.json();
	if (!prompt || typeof prompt !== 'string') throw error(400, 'prompt is required');

	const res = await fetch('https://api.together.xyz/v1/images/generations', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'black-forest-labs/FLUX.1-schnell',
			prompt,
			n: 1,
			size: '1024x1024',
			response_format: 'b64_json',
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw error(502, `Together AI error: ${err}`);
	}

	const data = await res.json();
	return json(data);
};
