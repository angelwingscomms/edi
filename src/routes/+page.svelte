<script lang="ts">
	let video = $state<HTMLVideoElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let src = $state<string | null>(null);
	let fileName = $state('');
	let duration = $state(0);
	let now = $state(0);
	let playing = $state(false);
	let markers = $state<number[]>([]);
	let dragOver = $state(false);

	const FPS = 30;
	const STEP = 1 / FPS;
	const TOL = STEP / 2 + 0.001;

	const frame = $derived(Math.round(now * FPS));
	const totalFrames = $derived(duration ? Math.round(duration * FPS) : 0);

	function fmt(t: number) {
		const f = Math.round(t * FPS);
		const s = Math.floor(f / FPS);
		return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:f${String(f % FPS).padStart(2, '0')}`;
	}

	function loadFile(f: File | undefined) {
		if (!f || !video) return;
		if (src) URL.revokeObjectURL(src);
		src = URL.createObjectURL(f);
		fileName = f.name;
		markers = [];
		now = 0;
		playing = false;
		video.src = src;
		video.load();
	}

	function seek(t: number) {
		if (!video) return;
		video.currentTime = Math.min(Math.max(0, t), duration || 0);
		now = video.currentTime;
	}

	function stepFrame(d: 1 | -1) {
		if (!video || !src) return;
		video.pause();
		playing = false;
		const base = Math.round(video.currentTime * FPS) / FPS;
		seek(base + d * STEP);
	}

	function toggle() {
		if (!video || !src) return;
		if (video.paused) {
			video.play();
			playing = true;
		} else {
			video.pause();
			playing = false;
		}
	}

	function addMarker() {
		if (!video || !src) return;
		const t = Math.round(video.currentTime * FPS) / FPS;
		if (markers.some((m) => Math.abs(m - t) < TOL)) return;
		markers = [...markers, t].sort((a, b) => a - b);
	}

	function removeMarker() {
		if (!video || !src) return;
		const t = video.currentTime;
		markers = markers.filter((m) => Math.abs(m - t) >= TOL);
	}

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return;
		if (!src) return;
		if (e.key === ' ') {
			e.preventDefault();
			toggle();
		} else if (e.key === '.') stepFrame(1);
		else if (e.key === ',') stepFrame(-1);
		else if (e.key === 'm' || e.key === 'M') addMarker();
		else if (e.key === 'n' || e.key === 'N') removeMarker();
	}

	function barSeek(e: MouseEvent) {
		if (!duration) return;
		const el = e.currentTarget as HTMLDivElement;
		const r = el.getBoundingClientRect();
		seek(((e.clientX - r.left) / r.width) * duration);
	}

	$effect(() => {
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<main>
	{#if !src}
		<div
			class="drop"
			class:over={dragOver}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragOver = false;
				loadFile(e.dataTransfer?.files?.[0]);
			}}
			role="button"
			tabindex="0"
			onclick={() => fileInput?.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
		>
			<p>drop video or click to upload</p>
			<input
				bind:this={fileInput}
				type="file"
				accept="video/*"
				hidden
				onchange={(e) => loadFile((e.target as HTMLInputElement).files?.[0])}
			/>
		</div>
	{:else}
		<div class="bar-top">
			<span>{fileName}</span>
			<button onclick={() => fileInput?.click()}>load other</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="video/*"
				hidden
				onchange={(e) => loadFile((e.target as HTMLInputElement).files?.[0])}
			/>
		</div>

		<video
			bind:this={video}
			src={src}
			controls={false}
			preload="auto"
			onclick={toggle}
			onloadedmetadata={() => video && (duration = video.duration)}
			ontimeupdate={() => video && (now = video.currentTime)}
			onplay={() => (playing = true)}
			onpause={() => (playing = false)}
			onseeked={() => video && (now = video.currentTime)}
		></video>

		<div class="timeline" onclick={barSeek} onkeydown={(e) => { if (e.key === 'ArrowLeft') stepFrame(-1); if (e.key === 'ArrowRight') stepFrame(1); }} role="slider" aria-label="timeline" aria-valuenow={now} aria-valuemax={duration} tabindex="0">
			<div class="progress" style:width={duration ? `${(now / duration) * 100}%` : '0%'}></div>
			{#each markers as m (m)}
				<div class="marker" style:left={duration ? `${(m / duration) * 100}%` : '0%'} title={fmt(m)}></div>
			{/each}
			<div class="head" style:left={duration ? `${(now / duration) * 100}%` : '0%'}></div>
		</div>

		<div class="row">
			<button onclick={() => stepFrame(-1)} title=",">−1f</button>
			<button onclick={toggle} title="space">{playing ? 'pause' : 'play'}</button>
			<button onclick={() => stepFrame(1)} title=".">+1f</button>
			<button onclick={addMarker} title="m">+mark</button>
			<button onclick={removeMarker} title="n">−mark</button>
		</div>

		<p class="meta">f{frame}/{totalFrames} · {fmt(now)} / {fmt(duration)} · {markers.length} marks · <code>,</code> <code>.</code> step · <code>space</code> play · <code>m</code>/<code>n</code> mark</p>

		{#if markers.length}
			<ol class="marks">
				{#each markers as m, i (m)}
					<li><button onclick={() => seek(m)}>#{i + 1} {fmt(m)}</button></li>
				{/each}
			</ol>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 900px;
		margin: 0 auto;
		padding: 16px;
		font-family: system-ui, sans-serif;
	}
	.drop {
		border: 2px dashed #666;
		padding: 80px 20px;
		text-align: center;
		cursor: pointer;
	}
	.drop.over {
		border-color: #fff;
		background: #111;
	}
	video {
		width: 100%;
		max-height: 60vh;
		background: #000;
		display: block;
	}
	.bar-top {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-bottom: 8px;
	}
	.bar-top span {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.timeline {
		position: relative;
		height: 28px;
		background: #1a1a1a;
		cursor: pointer;
		margin-top: 8px;
	}
	.progress {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: #333;
	}
	.head {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: #fff;
		transform: translateX(-1px);
	}
	.marker {
		position: absolute;
		top: 0;
		width: 6px;
		height: 100%;
		background: #ffd60a;
		transform: translateX(-3px);
	}
	.row {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	button {
		cursor: pointer;
	}
	.meta {
		color: #888;
		font-size: 13px;
	}
	.marks {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		list-style: none;
		padding: 0;
	}
</style>
