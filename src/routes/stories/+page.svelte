<script lang="ts">
	let prompt = $state('');
	let story = $state('');
	let loading = $state(false);
	let err = $state<string | null>(null);

	async function tell() {
		if (!prompt.trim() || loading) return;
		loading = true;
		err = null;
		story = '';
		try {
			const res = await fetch('/api/stories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt })
			});
			if (!res.ok || !res.body) throw new Error(await res.text());
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				story += dec.decode(value, { stream: true });
			}
		} catch (e) {
			err = e instanceof Error ? e.message : 'oh no, the muse wandered off';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>stories · sweet little tales</title>
</svelte:head>

<main>
	<header>
		<span class="sparkle" aria-hidden="true">✦</span>
		<h1>little stories</h1>
		<p class="tagline">whisper a prompt, and a soft tale will bloom</p>
	</header>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			tell();
		}}
	>
		<label for="prompt">what should the story be about?</label>
		<input
			id="prompt"
			type="text"
			bind:value={prompt}
			placeholder="a fox who found a library of forgotten lullabies…"
			disabled={loading}
			autocomplete="off"
		/>
		<button type="submit" disabled={loading || !prompt.trim()}>
			{loading ? 'gathering petals…' : 'tell me a story ♡'}
		</button>
	</form>

	{#if err}
		<p class="err">{err}</p>
	{/if}

	{#if story}
		<article class="story">
			{#each story.split(/\n{2,}/) as p, i (i)}
				{#if p.trim()}
					<p>{p}</p>
				{/if}
			{/each}
		</article>
	{/if}

	<footer>
		<span class="dots" aria-hidden="true">· · ·</span>
	</footer>
</main>

<style>
	:global(body) {
		background: linear-gradient(180deg, #fff6f7 0%, #fdf1e3 60%, #f4ecf7 100%);
		color: #5a4a55;
	}

	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 96px 24px 120px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	header {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.sparkle {
		font-size: 28px;
		color: #e8a4b8;
		letter-spacing: 8px;
	}

	h1 {
		font-family: 'Cormorant Garamond', 'Garamond', 'Times New Roman', serif;
		font-weight: 400;
		font-style: italic;
		font-size: 56px;
		line-height: 1.1;
		letter-spacing: 0.5px;
		color: #8a6a78;
		margin: 0;
	}

	.tagline {
		font-family: 'Cormorant Garamond', 'Garamond', serif;
		font-size: 16px;
		font-style: italic;
		color: #b89aa6;
		margin: 0;
		letter-spacing: 0.3px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: center;
	}

	label {
		font-family: 'Saira', system-ui, sans-serif;
		font-size: 11px;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: #c3a4b3;
		align-self: flex-start;
	}

	input {
		width: 100%;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid #f0d8df;
		border-radius: 9999px;
		padding: 14px 24px;
		font-family: 'Cormorant Garamond', 'Garamond', serif;
		font-size: 17px;
		font-style: italic;
		color: #6a5560;
		outline: none;
		transition:
			border-color 0.2s,
			background 0.2s;
	}

	input::placeholder {
		color: #d4bcc4;
	}

	input:focus {
		border-color: #e8a4b8;
		background: rgba(255, 255, 255, 0.9);
	}

	button {
		background: #f7c5d1;
		border: none;
		border-radius: 9999px;
		padding: 14px 36px;
		font-family: 'Saira', system-ui, sans-serif;
		font-size: 12px;
		font-weight: 400;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: #6a4554;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(232, 164, 184, 0.25);
		transition:
			transform 0.15s,
			box-shadow 0.2s,
			background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #f3b3c3;
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(232, 164, 184, 0.35);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.story {
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid #f0d8df;
		border-radius: 24px;
		padding: 40px 36px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		box-shadow: 0 8px 32px rgba(184, 154, 166, 0.12);
	}

	.story p {
		font-family: 'Cormorant Garamond', 'Garamond', serif;
		font-size: 19px;
		line-height: 1.7;
		color: #5a4a55;
		margin: 0;
		letter-spacing: 0.1px;
	}

	.err {
		font-family: 'Cormorant Garamond', serif;
		font-style: italic;
		color: #c98a98;
		text-align: center;
		margin: 0;
	}

	footer {
		text-align: center;
	}

	.dots {
		font-size: 14px;
		letter-spacing: 12px;
		color: #e0c4cc;
	}
</style>
