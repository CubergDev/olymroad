<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { api, getErrorMessage, type V2PrepAnalyticsResponse } from '$lib/api';
	import { prepTypeLabel, resolveLocale, resultStatusLabel } from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		loading: string;
		error_sign_in: string;
		summary_title: string;
		summary_sessions: string;
		summary_minutes: string;
		summary_avg: string;
		by_type_title: string;
		by_day_title: string;
		stage_progress_title: string;
		recent_results_title: string;
		no_data: string;
		no_results: string;
		field_sessions: string;
		field_minutes: string;
		field_status: string;
		field_score: string;
		field_place: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Analytics v2 | OlymRoad',
			meta_description: 'Prep analytics based on prep_logs, stage plans, and stage results.',
			hero_eyebrow: 'Analytics v2',
			hero_title: 'Track preparation intensity and stage progress',
			hero_subtitle:
				'Dashboard uses v2 prep logs, stage statuses, and recent stage results for a fast operational view.',
			sign_in_required: 'Sign in with a student account to view analytics.',
			loading: 'Loading analytics...',
			error_sign_in: 'Sign in first.',
			summary_title: 'Summary',
			summary_sessions: 'Sessions',
			summary_minutes: 'Minutes',
			summary_avg: 'Average minutes/session',
			by_type_title: 'Preparation by type',
			by_day_title: 'Daily load',
			stage_progress_title: 'Stage progress',
			recent_results_title: 'Recent results',
			no_data: 'No analytics data yet.',
			no_results: 'No recent results.',
			field_sessions: 'sessions',
			field_minutes: 'minutes',
			field_status: 'Status',
			field_score: 'Score',
			field_place: 'Place'
		},
		ru: {
			meta_title: 'Аналитика v2 | OlymRoad',
			meta_description: 'Аналитика подготовки на основе prep_logs, stage plans и stage results.',
			hero_eyebrow: 'Аналитика v2',
			hero_title: 'Отслеживайте интенсивность подготовки и прогресс по этапам',
			hero_subtitle:
				'Дашборд использует v2 журналы подготовки, статусы этапов и последние результаты этапов.',
			sign_in_required: 'Войдите под аккаунтом ученика для просмотра аналитики.',
			loading: 'Загрузка аналитики...',
			error_sign_in: 'Сначала выполните вход.',
			summary_title: 'Сводка',
			summary_sessions: 'Сессии',
			summary_minutes: 'Минуты',
			summary_avg: 'Среднее минут за сессию',
			by_type_title: 'Подготовка по типам',
			by_day_title: 'Дневная нагрузка',
			stage_progress_title: 'Прогресс по этапам',
			recent_results_title: 'Последние результаты',
			no_data: 'Данных аналитики пока нет.',
			no_results: 'Недавних результатов нет.',
			field_sessions: 'сессий',
			field_minutes: 'минут',
			field_status: 'Статус',
			field_score: 'Балл',
			field_place: 'Место'
		},
		kz: {
			meta_title: 'Аналитика v2 | OlymRoad',
			meta_description: 'prep_logs, stage plans және stage results негізіндегі дайындық аналитикасы.',
			hero_eyebrow: 'Аналитика v2',
			hero_title: 'Дайындық қарқыны мен кезең прогресін бақылаңыз',
			hero_subtitle:
				'Бұл дашборд v2 дайындық журналдарын, кезең статустарын және соңғы нәтижелерді қолданады.',
			sign_in_required: 'Аналитиканы көру үшін оқушы аккаунтымен кіріңіз.',
			loading: 'Аналитика жүктелуде...',
			error_sign_in: 'Алдымен жүйеге кіріңіз.',
			summary_title: 'Жалпы шолу',
			summary_sessions: 'Сессия',
			summary_minutes: 'Минут',
			summary_avg: 'Бір сессияға орташа минут',
			by_type_title: 'Түр бойынша дайындық',
			by_day_title: 'Күндік жүктеме',
			stage_progress_title: 'Кезең прогресі',
			recent_results_title: 'Соңғы нәтижелер',
			no_data: 'Әзірге аналитика дерегі жоқ.',
			no_results: 'Соңғы нәтижелер жоқ.',
			field_sessions: 'сессия',
			field_minutes: 'минут',
			field_status: 'Күй',
			field_score: 'Ұпай',
			field_place: 'Орын'
		}
	};

	let loading = false;
	let errorMessage: string | null = null;
	let activeToken: string | null = null;
	let analytics: V2PrepAnalyticsResponse | null = null;

	const copy = (): UiCopy => COPY[resolveLocale()];

	const toNumber = (value: number | string | null | undefined): number => {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string' && value.trim().length > 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : 0;
		}
		return 0;
	};

	const widthFrom = (value: number, max: number): number => {
		if (max <= 0) {
			return 6;
		}
		return Math.max(6, Math.round((value / max) * 100));
	};

	const stageStatusLabel = (value: string): string => {
		const locale = resolveLocale();
		const labels: Record<string, Record<'en' | 'ru' | 'kz', string>> = {
			PLANNED: { en: 'Planned', ru: 'Запланировано', kz: 'Жоспарда' },
			REGISTERED: { en: 'Registered', ru: 'Зарегистрирован', kz: 'Тіркелген' },
			PARTICIPATED: { en: 'Participated', ru: 'Участвовал', kz: 'Қатысқан' },
			RESULT_ENTERED: { en: 'Result entered', ru: 'Результат внесен', kz: 'Нәтиже енгізілді' },
			MISSED: { en: 'Missed', ru: 'Пропущено', kz: 'Өткізіп алды' },
			CANCELLED: { en: 'Cancelled', ru: 'Отменено', kz: 'Бас тартылды' }
		};
		return labels[value]?.[locale] ?? value;
	};

	const loadAnalytics = async (token: string) => {
		loading = true;
		errorMessage = null;
		try {
			analytics = await api.getPrepAnalyticsV2(token, { days: 120 });
		} catch (error) {
			errorMessage = getErrorMessage(error);
			analytics = null;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		const syncFromSession = () => {
			const token = currentToken();
			if (!token) {
				activeToken = null;
				analytics = null;
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadAnalytics(token);
		};

		syncFromSession();
		const unsubscribe = session.subscribe(() => {
			syncFromSession();
		});
		return () => unsubscribe();
	});
</script>

<svelte:head>
	<title>{copy().meta_title}</title>
	<meta name="description" content={copy().meta_description} />
</svelte:head>

<section class="page-panel page-hero">
	<p class="page-eyebrow">{copy().hero_eyebrow}</p>
	<h1 class="page-title">{copy().hero_title}</h1>
	<p class="page-subtitle">{copy().hero_subtitle}</p>
</section>

{#if !currentToken()}
	<section class="page-panel">
		<p class="page-subtitle">{copy().sign_in_required}</p>
	</section>
{:else if loading}
	<section class="page-panel">
		<p class="page-subtitle">{copy().loading}</p>
	</section>
{:else if !analytics}
	<section class="page-panel">
		<p class="page-subtitle">{copy().no_data}</p>
	</section>
{:else}
	<section class="page-panel">
		<h2>{copy().summary_title}</h2>
		<div class="summary-grid">
			<article class="surface-card metric-card">
				<strong>{analytics.summary.sessions}</strong>
				<span>{copy().summary_sessions}</span>
			</article>
			<article class="surface-card metric-card">
				<strong>{analytics.summary.minutes}</strong>
				<span>{copy().summary_minutes}</span>
			</article>
			<article class="surface-card metric-card">
				<strong>{toNumber(analytics.summary.avg_minutes).toFixed(1)}</strong>
				<span>{copy().summary_avg}</span>
			</article>
		</div>
	</section>

	<section class="page-panel analytics-grid">
		<article class="surface-card block-card">
			<h3>{copy().by_type_title}</h3>
			{#if analytics.by_type.length === 0}
				<p>{copy().no_data}</p>
			{:else}
				{@const typeMax = Math.max(...analytics.by_type.map((item) => item.minutes), 1)}
				<div class="progress-stack">
					{#each analytics.by_type as row (row.log_type)}
						<div class="progress-row">
							<span class="progress-key">{prepTypeLabel(row.log_type)}</span>
							<div class="progress-bar">
								<div style={`width: ${widthFrom(row.minutes, typeMax)}%`}></div>
							</div>
							<em>{row.minutes}</em>
						</div>
					{/each}
				</div>
			{/if}
		</article>

		<article class="surface-card block-card">
			<h3>{copy().by_day_title}</h3>
			{#if analytics.by_day.length === 0}
				<p>{copy().no_data}</p>
			{:else}
				{@const dayMax = Math.max(...analytics.by_day.map((item) => item.minutes), 1)}
				<div class="progress-stack">
					{#each analytics.by_day as row (row.happened_on)}
						<div class="progress-row">
							<span class="progress-key">{row.happened_on}</span>
							<div class="progress-bar">
								<div style={`width: ${widthFrom(row.minutes, dayMax)}%`}></div>
							</div>
							<em>{row.minutes}</em>
						</div>
					{/each}
				</div>
			{/if}
		</article>

		<article class="surface-card block-card">
			<h3>{copy().stage_progress_title}</h3>
			{#if analytics.stage_progress.length === 0}
				<p>{copy().no_data}</p>
			{:else}
				{@const stageMax = Math.max(...analytics.stage_progress.map((item) => item.count), 1)}
				<div class="progress-stack">
					{#each analytics.stage_progress as row (row.status)}
						<div class="progress-row">
							<span class="progress-key">{stageStatusLabel(row.status)}</span>
							<div class="progress-bar">
								<div style={`width: ${widthFrom(row.count, stageMax)}%`}></div>
							</div>
							<em>{row.count}</em>
						</div>
					{/each}
				</div>
			{/if}
		</article>
	</section>

	<section class="page-panel">
		<h2>{copy().recent_results_title}</h2>
		{#if analytics.recent_results.length === 0}
			<p class="page-subtitle">{copy().no_results}</p>
		{:else}
			<div class="results-grid">
				{#each analytics.recent_results as row (`${row.stage_instance_id}:${row.created_at}`)}
					<article class="surface-card result-item">
						<p><strong>{copy().field_status}:</strong> {resultStatusLabel(row.result_status)}</p>
						<p><strong>{copy().field_score}:</strong> {row.score ?? '-'}</p>
						<p><strong>{copy().field_place}:</strong> {row.place_text ?? '-'}</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if errorMessage}
		<section class="page-panel">
			<p class="error-banner">{errorMessage}</p>
		</section>
	{/if}
{/if}

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
	}

	.metric-card {
		display: grid;
		gap: 0.35rem;
		align-content: center;
		min-height: 6rem;
	}

	.metric-card strong {
		font-size: clamp(1.25rem, 1.2rem + 0.8vw, 1.8rem);
	}

	.analytics-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.block-card {
		display: grid;
		gap: 0.6rem;
	}

	.block-card h3,
	.block-card p {
		margin: 0;
	}

	.progress-stack {
		display: grid;
		gap: 0.55rem;
	}

	.progress-row {
		display: grid;
		grid-template-columns: minmax(6rem, 1.5fr) minmax(0, 4fr) auto;
		gap: 0.5rem;
		align-items: center;
	}

	.progress-key {
		font-size: 0.84rem;
	}

	.progress-bar {
		height: 0.52rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ol-primary) 14%, white);
		overflow: hidden;
	}

	.progress-bar > div {
		height: 100%;
		background: linear-gradient(90deg, var(--ol-primary), var(--ol-accent));
	}

	.progress-row em {
		font-style: normal;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.7rem;
	}

	.result-item {
		display: grid;
		gap: 0.35rem;
	}

	.result-item p {
		margin: 0;
	}

	@media (max-width: 980px) {
		.summary-grid,
		.analytics-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.progress-row {
			grid-template-columns: 1fr auto;
			gap: 0.35rem 0.5rem;
		}

		.progress-row .progress-bar {
			grid-column: 1 / -1;
		}
	}
</style>
