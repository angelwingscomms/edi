import { readdir, stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v', '.ogv']);
const MIME: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mov': 'video/quicktime',
	'.mkv': 'video/x-matroska',
	'.m4v': 'video/x-m4v',
	'.ogv': 'video/ogg'
};

// Dev/test helper: stream the newest video in ~/Downloads.
export async function GET() {
	const dir = join(homedir(), 'Downloads');
	if (!existsSync(dir)) return new Response('no Downloads dir', { status: 404 });
	const names = await readdir(dir);
	let best: { n: string; m: number } | null = null;
	for (const n of names) {
		const i = n.lastIndexOf('.');
		if (i < 0 || !EXTS.has(n.slice(i).toLowerCase())) continue;
		try {
			const m = (await stat(join(dir, n))).mtimeMs;
			if (!best || m > best.m) best = { n, m };
		} catch {
			/* skip unreadable */
		}
	}
	if (!best) return new Response('no video in Downloads', { status: 404 });
	const ext = best.n.slice(best.n.lastIndexOf('.')).toLowerCase();
	const stream = createReadStream(join(dir, best.n));
	return new Response(stream as unknown as BodyInit, {
		headers: {
			'Content-Type': MIME[ext] ?? 'video/mp4',
			'X-File-Name': encodeURIComponent(best.n)
		}
	});
}
