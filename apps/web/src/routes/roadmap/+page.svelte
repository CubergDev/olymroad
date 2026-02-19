<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { resolveLocale } from '$lib/i18n';
	import { localizeHref } from '$lib/paraglide/runtime';

	type UiCopy = {
		moved: string;
		open_target: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: { moved: 'This route moved to v2 roadmap.', open_target: 'Open /roadmap-v2' },
		ru: { moved: 'Этот маршрут перенесен на v2 roadmap.', open_target: 'Открыть /roadmap-v2' },
		kz: { moved: 'Бұл маршрут v2 roadmap-қа ауыстырылды.', open_target: '/roadmap-v2 ашу' }
	};

	const copy = (): UiCopy => COPY[resolveLocale()];
	const target = (): string => resolve(localizeHref('/roadmap-v2') as '/roadmap-v2');

	onMount(() => {
		void goto(target(), { replaceState: true });
	});
</script>

<section class="page-panel">
	<p class="page-subtitle">{copy().moved}</p>
	<a class="btn-secondary" href={target()}>{copy().open_target}</a>
</section>
