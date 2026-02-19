<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { localizeHref } from '$lib/paraglide/runtime';

	onMount(() => {
		void goto(resolve(localizeHref(resolve('/profile')) as '/profile'), { replaceState: true });
	});
</script>

<main class="redirect-shell">
	<section class="redirect-card" aria-hidden="true">
		<div class="orb orb-lg"></div>
		<div class="orb orb-sm"></div>
		<div class="spinner"></div>
	</section>
</main>

<style>
	.redirect-shell {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 2.5rem);
		background:
			radial-gradient(120% 140% at 0% 0%, hsl(210 92% 58% / 0.1), transparent 58%),
			radial-gradient(120% 140% at 100% 100%, hsl(184 88% 45% / 0.08), transparent 60%);
	}

	.redirect-card {
		position: relative;
		width: min(100%, 30rem);
		min-height: clamp(10rem, 34vw, 14rem);
		padding: clamp(1.25rem, 4vw, 2.25rem);
		border-radius: clamp(1rem, 3vw, 1.5rem);
		overflow: hidden;
		display: grid;
		place-items: center;
		background: linear-gradient(135deg, hsl(0 0% 100% / 0.92), hsl(0 0% 100% / 0.78));
		border: 1px solid hsl(220 22% 84% / 0.7);
		box-shadow: 0 1rem 2.8rem -1.5rem hsl(214 30% 24% / 0.38);
		backdrop-filter: blur(8px);
	}

	.spinner {
		width: clamp(2.4rem, 10vw, 3.2rem);
		aspect-ratio: 1;
		border-radius: 999px;
		border: 0.24rem solid hsl(216 24% 78% / 0.7);
		border-top-color: hsl(216 85% 53%);
		animation: spin 0.8s linear infinite;
		z-index: 1;
	}

	.orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(2px);
	}

	.orb-lg {
		width: clamp(7rem, 30vw, 9.5rem);
		aspect-ratio: 1;
		top: clamp(-2.8rem, -8vw, -2rem);
		right: clamp(-2.8rem, -7vw, -1.8rem);
		background: hsl(209 93% 58% / 0.22);
	}

	.orb-sm {
		width: clamp(4rem, 16vw, 5.2rem);
		aspect-ratio: 1;
		left: clamp(-1.5rem, -4vw, -1rem);
		bottom: clamp(-1.2rem, -4vw, -0.8rem);
		background: hsl(182 85% 45% / 0.22);
	}

	@media (max-width: 480px) {
		.redirect-shell {
			padding: 1rem;
		}

		.redirect-card {
			width: 100%;
			min-height: 9.5rem;
		}
	}

	@media (prefers-color-scheme: dark) {
		.redirect-shell {
			background:
				radial-gradient(120% 140% at 0% 0%, hsl(210 95% 62% / 0.16), transparent 58%),
				radial-gradient(120% 140% at 100% 100%, hsl(183 90% 46% / 0.13), transparent 60%);
		}

		.redirect-card {
			background: linear-gradient(135deg, hsl(221 21% 16% / 0.9), hsl(220 19% 13% / 0.82));
			border-color: hsl(217 17% 30% / 0.8);
			box-shadow: 0 1rem 2.8rem -1.2rem hsl(220 35% 4% / 0.62);
		}

		.spinner {
			border-color: hsl(214 16% 42% / 0.85);
			border-top-color: hsl(208 96% 66%);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
