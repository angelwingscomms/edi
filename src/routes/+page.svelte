<script lang="ts">
	type Marker = { t: number; img: string | null };

	let video = $state<HTMLVideoElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let src = $state<string | null>(null);
	let fileName = $state('');
	let duration = $state(0);
	let now = $state(0);
	let playing = $state(false);
	let markers = $state<Marker[]>([]);
	let dragOver = $state(false);
	let storeKey = $state('');
	let clips = $state<{ t: number; at: number }[]>([]);
	let head = $state(0);
	let headPlaying = $state(false);
	let vidKey = $state('');

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

	function readStored(k: string): number[] {
		try {
			const arr = JSON.parse(localStorage.getItem(k) ?? '[]');
			return Array.isArray(arr) ? arr.filter((t) => typeof t === 'number') : [];
		} catch {
			return [];
		}
	}

	const MAX_STORE_VIDEO = 4_000_000;

	function storeVideo(f: File, key: string) {
		if (f.size > MAX_STORE_VIDEO) {
			try {
				localStorage.removeItem(`edi:video:${key}`);
			} catch { /* noop */ }
			return;
		}
		const r = new FileReader();
		r.onload = () => {
			try {
				localStorage.setItem(`edi:video:${key}`, r.result as string);
				localStorage.setItem('edi:last-video', JSON.stringify({ key, name: f.name }));
			} catch { /* quota — marks still persist */ }
		};
		r.readAsDataURL(f);
	}

	async function restoreLastVideo() {
		try {
			const raw = localStorage.getItem('edi:last-video');
			if (!raw) return;
			const { key, name } = JSON.parse(raw);
			const url = localStorage.getItem(`edi:video:${key}`);
			if (!url) return;
			const blob = await (await fetch(url)).blob();
			if (src) URL.revokeObjectURL(src);
			src = URL.createObjectURL(blob);
			fileName = name;
			storeKey = `edi:markers:${key}`;
			vidKey = key;
			markers = readStored(storeKey).map((t) => ({ t, img: null }));
			markers.forEach((m) => captureThumb(m.t));
			clips = readClips(`edi:timeline:${key}`);
			head = 0;
			headPlaying = false;
		} catch { /* nothing usable stored */ }
	}

	function readClips(k: string): { t: number; at: number }[] {
		try {
			const arr = JSON.parse(localStorage.getItem(k) ?? '[]');
			if (!Array.isArray(arr)) return [];
			return arr.flatMap((c) => {
				if (typeof c === 'number') return [{ t: c, at: c }];
				if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
					return [{ t: c[0], at: c[1] }];
				return [];
			});
		} catch {
			return [];
		}
	}

	function loadFile(f: File | undefined) {
		if (!f) return;
		if (src) URL.revokeObjectURL(src);
		src = URL.createObjectURL(f);
		fileName = f.name;
		now = 0;
		duration = 0;
		playing = false;
		storeKey = `edi:markers:${f.name}:${f.size}:${f.lastModified}`;
		vidKey = `${f.name}:${f.size}:${f.lastModified}`;
		markers = readStored(storeKey).map((t) => ({ t, img: null }));
		markers.forEach((m) => captureThumb(m.t));
		clips = readClips(`edi:timeline:${vidKey}`);
		head = 0;
		headPlaying = false;
		storeVideo(f, `${f.name}:${f.size}:${f.lastModified}`);
	}

	function addClip(t: number) {
		const at = Math.round(head * FPS) / FPS;
		clips = [...clips.filter((c) => Math.abs(c.at - at) >= TOL), { t, at }].sort((a, b) => a.at - b.at);
	}

	function stepHead(d: 1 | -1) {
		if (!duration) return;
		headPlaying = false;
		head = Math.min(Math.max(0, Math.round(head * FPS) / FPS + d * STEP), duration);
	}

	function toggleHead() {
		if (!duration) return;
		if (head >= duration) head = 0;
		headPlaying = !headPlaying;
	}

	function headSeek(e: MouseEvent) {
		if (!duration) return;
		const el = e.currentTarget as HTMLDivElement;
		const r = el.getBoundingClientRect();
		headPlaying = false;
		head = ((e.clientX - r.left) / r.width) * duration;
	}

	const headClip = $derived(clips.filter((c) => c.at <= head + TOL).slice(-1)[0] ?? null);
	const headImg = $derived(
		headClip == null ? null : (markers.find((m) => Math.abs(m.t - headClip.t) < TOL)?.img ?? null)
	);

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

	function captureThumb(t: number) {
		const url = src;
		if (!url) return;
		const v = document.createElement('video');
		v.muted = true;
		v.preload = 'auto';
		v.src = url;
		v.onloadedmetadata = () => {
			v.currentTime = Math.min(Math.max(0, t), (v.duration || t + 0.05) - 0.02);
		};
		v.onseeked = () => {
			try {
				const w = 160;
				const h = v.videoWidth ? Math.round((v.videoHeight / v.videoWidth) * w) : 90;
				const c = document.createElement('canvas');
				c.width = w;
				c.height = h;
				c.getContext('2d')!.drawImage(v, 0, 0, w, h);
				const img = c.toDataURL('image/jpeg', 0.6);
				const i = markers.findIndex((m) => Math.abs(m.t - t) < TOL);
				if (i >= 0) markers[i].img = img;
			} catch {
				/* keep timecode placeholder */
			}
			v.removeAttribute('src');
			v.load();
		};
		v.onerror = () => {
			v.removeAttribute('src');
			v.load();
		};
	}

	function addMarker() {
		if (!video || !src) return;
		const t = Math.round(video.currentTime * FPS) / FPS;
		if (markers.some((m) => Math.abs(m.t - t) < TOL)) return;
		markers = [...markers, { t, img: null }].sort((a, b) => a.t - b.t);
		captureThumb(t);
	}

	function downloadMarkers() {
		const frames = markers.map((m) => Math.round(m.t * FPS));
		const blob = new Blob([JSON.stringify(frames)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'markers.json';
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	function removeMarker() {
		if (!video || !src) return;
		const t = video.currentTime;
		markers = markers.filter((m) => Math.abs(m.t - t) >= TOL);
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

	$effect(() => {
		restoreLastVideo();
	});

	// Testing: in dev, auto-load the newest video in ~/Downloads
	// when nothing is stored yet.
	$effect(() => {
		if (!import.meta.env.DEV || src) return;
		let dead = false;
		(async () => {
			try {
				if (localStorage.getItem('edi:last-video')) return;
				const r = await fetch('/api/latest');
				if (!r.ok || dead || src) return;
				const blob = await r.blob();
				if (dead || src) return;
				const nm = decodeURIComponent(r.headers.get('X-File-Name') ?? 'download.mp4');
				loadFile(new File([blob], nm, { type: blob.type || 'video/mp4' }));
			} catch {
				/* no test video available */
			}
		})();
		return () => {
			dead = true;
		};
	});

	// Playback readout on rAF, throttled to ~10Hz so scrub/play never
	// re-renders more than needed (skill: timeline hot path).
	$effect(() => {
		let raf = 0;
		let last = 0;
		let prev = 0;
		const loop = (t: number) => {
			const dt = prev ? (t - prev) / 1000 : 0;
			prev = t;
			if (video && !video.paused && !video.seeking && t - last > 100) {
				last = t;
				now = video.currentTime;
			}
			if (headPlaying && duration) {
				head += dt;
				if (head >= duration) {
					head = duration;
					headPlaying = false;
				}
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Evict object URLs (skill: assets as object URLs, evict hard).
	$effect(() => {
		const url = src;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	// Realtime persist of sequence clips.
	$effect(() => {
		if (!vidKey) return;
		try {
			localStorage.setItem(`edi:timeline:${vidKey}`, JSON.stringify(clips.map((c) => [c.t, c.at])));
		} catch {
			/* quota — session keeps working */
		}
	});

	// Realtime persist of marker times (thumbs re-captured on load).
	$effect(() => {
		if (!storeKey) return;
		try {
			localStorage.setItem(storeKey, JSON.stringify(markers.map((m) => m.t)));
		} catch {
			/* quota — session keeps working */
		}
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
		<div class="panes">
		<section class="pane">
		<div class="bar-top">
			<span>viewer · {fileName}</span>
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
			{#each markers as m (m.t)}
				<div class="marker" style:left={duration ? `${(m.t / duration) * 100}%` : '0%'} title={fmt(m.t)}></div>
			{/each}
			<div class="head" style:left={duration ? `${(now / duration) * 100}%` : '0%'}></div>
		</div>

		<div class="row">
			<button onclick={() => stepFrame(-1)} title=",">−1f</button>
			<button onclick={toggle} title="space">{playing ? 'pause' : 'play'}</button>
			<button onclick={() => stepFrame(1)} title=".">+1f</button>
			<button onclick={addMarker} title="m">+mark</button>
			<button onclick={removeMarker} title="n">−mark</button>
			{#if markers.length}<button onclick={downloadMarkers}>↓json</button>{/if}
		</div>

		<p class="meta">f{frame}/{totalFrames} · {fmt(now)} / {fmt(duration)} · {markers.length} marks · <code>,</code> <code>.</code> step · <code>space</code> play · <code>m</code>/<code>n</code> mark</p>

		{#if markers.length}
			<div class="strip">
				{#each markers as m, i (m.t)}
					<div class="thumb" onclick={() => seek(m.t)} onkeydown={(e) => e.key === 'Enter' && seek(m.t)} role="button" tabindex="0" title={fmt(m.t)}>
						{#if m.img}<img src={m.img} alt="mark {i + 1}" />{:else}<span class="ph">{fmt(m.t)}</span>{/if}
						<span class="cap">#{i + 1} {fmt(m.t)}</span>
						<button class="add" onclick={(e) => { e.stopPropagation(); addClip(m.t); }}>+ timeline</button>
					</div>
				{/each}
			</div>
		{/if}
		</section>
		<section class="pane">
			<div class="bar-top">
				<span>editor{clips.length ? ` (${clips.length})` : ''}</span>
			</div>
			<div class="screen">
				{#if headImg}
					<img src={headImg} alt="sequence frame" />
				{:else}
					<p>{duration ? 'no frame at playhead' : 'load the left video first'}</p>
				{/if}
			</div>
			<div class="timeline" onclick={headSeek} onkeydown={(e) => { if (e.key === 'ArrowLeft') stepHead(-1); if (e.key === 'ArrowRight') stepHead(1); }} role="slider" aria-label="sequence timeline" aria-valuenow={head} aria-valuemax={duration} tabindex="0">
				{#each clips as c (c.at)}
					<div class="marker" style:left={duration ? `${(c.at / duration) * 100}%` : '0%'} title={fmt(c.t)}></div>
				{/each}
				<div class="head" style:left={duration ? `${(head / duration) * 100}%` : '0%'}></div>
			</div>
			<div class="row">
				<button onclick={() => stepHead(-1)} title="left arrow">◀</button>
				<button onclick={toggleHead}>{headPlaying ? 'pause' : 'play'}</button>
				<button onclick={() => stepHead(1)} title="right arrow">▶</button>
			</div>
			<p class="meta">{fmt(head)} / {fmt(duration)}</p>
		</section>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 1280px;
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
	.panes {
		display: flex;
		gap: 16px;
		align-items: start;
		flex-wrap: wrap;
	}
	.pane {
		flex: 1 1 320px;
		min-width: 0;
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
	.strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-top: 8px;
		padding-bottom: 4px;
	}
	.thumb {
		flex: 0 0 auto;
		width: 160px;
		padding: 0;
		background: #111;
		border: 1px solid #333;
		color: #ccc;
	}
	.thumb img {
		width: 160px;
		height: 90px;
		object-fit: cover;
		display: block;
	}
	.thumb .ph {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 160px;
		height: 90px;
		font-size: 12px;
	}
	.screen {
		aspect-ratio: 16 / 9;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		font-size: 13px;
	}
	.screen img {
		max-width: 100%;
		max-height: 100%;
		display: block;
	}
	.thumb .add {
		margin: 0 4px 4px;
		font-size: 11px;
	}
	.thumb .cap {
		display: block;
		font-size: 11px;
		padding: 2px 4px;
		text-align: left;
	}
</style>
