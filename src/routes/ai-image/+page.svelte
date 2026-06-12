<script lang="ts">
	let prompt = $state('');
	let imageUrl = $state<string | null>(null);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	async function generate() {
		if (!prompt.trim()) return;
		loading = true;
		errorMsg = null;
		imageUrl = null;

		try {
			const res = await fetch('/api/ai-image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt }),
			});
			if (!res.ok) {
				const e = await res.text();
				throw new Error(e);
			}
			const data = await res.json();
			imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Failed to generate image';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>AI IMAGE GENERATOR</title>
</svelte:head>

<div class="page">
	<h1 class="title">AI IMAGE</h1>

	<form onsubmit={(e) => { e.preventDefault(); generate(); }}>
		<input
			type="text"
			bind:value={prompt}
			placeholder="describe an image…"
			class="input"
			disabled={loading}
		/>
		<button type="submit" class="btn" disabled={loading || !prompt.trim()}>
			{loading ? 'GENERATING…' : 'GENERATE'}
		</button>
	</form>

	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	{#if imageUrl}
		<div class="result">
			<img src={imageUrl} alt={prompt} />
			<p class="caption">{prompt}</p>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 120px 24px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	.title {
		font-family: "Bugatti Display", sans-serif;
		font-size: 48px;
		font-weight: 400;
		line-height: 1.15;
		letter-spacing: 3px;
		color: #ffffff;
		text-transform: uppercase;
		margin: 0;
	}

	form {
		display: flex;
		gap: 16px;
		align-items: flex-end;
	}

	.input {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 1px solid #3a3a3a;
		padding: 12px 0;
		height: 44px;
		font-family: "Bugatti Text Regular", serif;
		font-size: 16px;
		color: #ffffff;
		outline: none;
	}

	.input:focus {
		border-bottom-color: #ffffff;
	}

	.input::placeholder {
		color: #999999;
	}

	.btn {
		background: transparent;
		border: 1px solid #ffffff;
		border-radius: 9999px;
		padding: 14px 32px;
		height: 44px;
		font-family: "Bugatti Monospace", ui-monospace, monospace;
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 2.5px;
		color: #ffffff;
		text-transform: uppercase;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.result img {
		width: 100%;
		max-width: 512px;
		height: auto;
		border: 1px solid #262626;
	}

	.caption {
		font-family: "Bugatti Monospace", ui-monospace, monospace;
		font-size: 11px;
		font-weight: 400;
		letter-spacing: 2px;
		color: #999999;
		text-transform: uppercase;
		margin: 0;
	}

	.error {
		font-family: "Bugatti Text Regular", serif;
		font-size: 14px;
		color: #d4a017;
		margin: 0;
	}
</style>
