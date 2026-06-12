<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/heart.svg" />
	<link rel="apple-touch-icon" href="/heart.svg" />
	<link rel="manifest" href="/manifest.json" />
</svelte:head>

{@render children()}
