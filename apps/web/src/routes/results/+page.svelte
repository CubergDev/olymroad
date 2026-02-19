<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { api, getErrorMessage, type ResultStatus, type V2RoadmapItem } from '$lib/api';
	import { formatDate, resolveLocale, resultStatusLabel } from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		form_title: string;
		stage: string;
		select_stage: string;
		status: string;
		score_optional: string;
		place_optional: string;
		comment_optional: string;
		score_placeholder: string;
		place_placeholder: string;
		comment_placeholder: string;
		save: string;
		loading: string;
		history_title: string;
		no_results: string;
		stage_missing: string;
		error_sign_in: string;
		error_stage: string;
		error_score: string;
		error_place: string;
		info_saved: string;
		field_score: string;
		field_place: string;
		field_comment: string;
		field_date: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Results v2 | OlymRoad',
			meta_description: 'Save stage outcomes on stage_results linked to v2 stage instances.',
			hero_eyebrow: 'Results v2',
			hero_title: 'Capture stage outcomes on the new schema',
			hero_subtitle:
				'Each submission writes to stage_results and automatically keeps student stage progress in sync.',
			sign_in_required: 'Sign in with a student account to submit results.',
			form_title: 'Submit result',
			stage: 'Stage',
			select_stage: 'Select stage',
			status: 'Result status',
			score_optional: 'Score (optional)',
			place_optional: 'Place (optional)',
			comment_optional: 'Comment (optional)',
			score_placeholder: 'e.g. 87.5',
			place_placeholder: 'e.g. 2',
			comment_placeholder: 'What was strong and what to improve',
			save: 'Save result',
			loading: 'Loading results context...',
			history_title: 'Recent submitted results',
			no_results: 'No results yet.',
			stage_missing: 'Stage is no longer available',
			error_sign_in: 'Sign in first.',
			error_stage: 'Choose a stage.',
			error_score: 'Score must be a valid number.',
			error_place: 'Place must be a positive integer.',
			info_saved: 'Result saved.',
			field_score: 'Score',
			field_place: 'Place',
			field_comment: 'Comment',
			field_date: 'Date'
		},
		ru: {
			meta_title: 'Результаты v2 | OlymRoad',
			meta_description: 'Сохранение результатов этапов в stage_results по v2 stage instances.',
			hero_eyebrow: 'Результаты v2',
			hero_title: 'Фиксируйте результаты этапов на новой схеме',
			hero_subtitle:
				'Каждая отправка записывает данные в stage_results и синхронизирует прогресс по этапу.',
			sign_in_required: 'Войдите под аккаунтом ученика, чтобы отправлять результаты.',
			form_title: 'Отправка результата',
			stage: 'Этап',
			select_stage: 'Выберите этап',
			status: 'Статус результата',
			score_optional: 'Балл (необязательно)',
			place_optional: 'Место (необязательно)',
			comment_optional: 'Комментарий (необязательно)',
			score_placeholder: 'например 87.5',
			place_placeholder: 'например 2',
			comment_placeholder: 'Что получилось и что нужно улучшить',
			save: 'Сохранить результат',
			loading: 'Загрузка контекста результатов...',
			history_title: 'Последние отправленные результаты',
			no_results: 'Пока нет результатов.',
			stage_missing: 'Этап больше недоступен',
			error_sign_in: 'Сначала выполните вход.',
			error_stage: 'Выберите этап.',
			error_score: 'Балл должен быть числом.',
			error_place: 'Место должно быть положительным целым числом.',
			info_saved: 'Результат сохранен.',
			field_score: 'Балл',
			field_place: 'Место',
			field_comment: 'Комментарий',
			field_date: 'Дата'
		},
		kz: {
			meta_title: 'Нәтижелер v2 | OlymRoad',
			meta_description: 'v2 stage instances үшін stage_results кестесіне нәтижелерді сақтау.',
			hero_eyebrow: 'Нәтижелер v2',
			hero_title: 'Жаңа схема бойынша кезең нәтижелерін енгізіңіз',
			hero_subtitle:
				'Әр жіберілім stage_results-ке жазылады және кезең прогресін синхрондайды.',
			sign_in_required: 'Нәтиже жіберу үшін оқушы аккаунтымен кіріңіз.',
			form_title: 'Нәтиже жіберу',
			stage: 'Кезең',
			select_stage: 'Кезеңді таңдаңыз',
			status: 'Нәтиже күйі',
			score_optional: 'Ұпай (міндетті емес)',
			place_optional: 'Орын (міндетті емес)',
			comment_optional: 'Пікір (міндетті емес)',
			score_placeholder: 'мысалы 87.5',
			place_placeholder: 'мысалы 2',
			comment_placeholder: 'Қай тұсы жақсы, нені жақсарту керек',
			save: 'Нәтижені сақтау',
			loading: 'Нәтиже контексті жүктелуде...',
			history_title: 'Соңғы жіберілген нәтижелер',
			no_results: 'Әзірге нәтиже жоқ.',
			stage_missing: 'Кезең енді қолжетімсіз',
			error_sign_in: 'Алдымен жүйеге кіріңіз.',
			error_stage: 'Кезеңді таңдаңыз.',
			error_score: 'Ұпай дұрыс сан болуы керек.',
			error_place: 'Орын оң бүтін сан болуы керек.',
			info_saved: 'Нәтиже сақталды.',
			field_score: 'Ұпай',
			field_place: 'Орын',
			field_comment: 'Пікір',
			field_date: 'Күні'
		}
	};

	let loading = false;
	let working = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;
	let activeToken: string | null = null;

	let stages: V2RoadmapItem[] = [];
	let recentResults: Array<{
		stage_instance_id: string;
		result_status: ResultStatus;
		score: number | string | null;
		place_text: string | null;
		comment: string | null;
		created_at: string;
	}> = [];

	let selectedStageId = '';
	let selectedStatus: ResultStatus = 'participant';
	let scoreDraft = '';
	let placeDraft = '';
	let commentDraft = '';

	const copy = (): UiCopy => COPY[resolveLocale()];

	const stageTitle = (item: V2RoadmapItem): string => {
		const locale = resolveLocale();
		const series = locale === 'kz' ? item.series_name_kz || item.series_name_ru : item.series_name_ru;
		const stage = locale === 'kz' ? item.stage_template_name_kz || item.stage_template_name_ru : item.stage_template_name_ru;
		const label = item.label?.trim() ? ` - ${item.label}` : '';
		return `${series} / ${stage}${label}`;
	};

	const scoreLabel = (value: number | string | null): string => {
		if (value === null || value === undefined) {
			return '-';
		}
		return String(value);
	};

	const loadData = async (token: string) => {
		loading = true;
		errorMessage = null;
		try {
			const [roadmap, analytics] = await Promise.all([
				api.getRoadmapV2(token, { limit: 350 }),
				api.getPrepAnalyticsV2(token, { days: 365 })
			]);
			stages = roadmap.items;
			recentResults = analytics.recent_results;
			if (!selectedStageId && stages.length > 0) {
				selectedStageId = stages[0].id;
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
			stages = [];
			recentResults = [];
		} finally {
			loading = false;
		}
	};

	const submitResult = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().error_sign_in;
			return;
		}
		if (!selectedStageId) {
			errorMessage = copy().error_stage;
			return;
		}

		const scoreRaw = scoreDraft.trim();
		const score = scoreRaw.length === 0 ? null : Number(scoreRaw);
		if (scoreRaw.length > 0 && !Number.isFinite(score)) {
			errorMessage = copy().error_score;
			return;
		}

		let placeText: string | null = null;
		if (placeDraft.trim().length > 0) {
			const placeNumber = Number(placeDraft);
			if (!Number.isInteger(placeNumber) || placeNumber <= 0) {
				errorMessage = copy().error_place;
				return;
			}
			placeText = String(placeNumber);
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.saveStageResultV2(token, selectedStageId, {
				result_status: selectedStatus,
				score,
				place_text: placeText,
				comment: commentDraft.trim() || null
			});
			infoMessage = copy().info_saved;
			scoreDraft = '';
			placeDraft = '';
			commentDraft = '';
			await loadData(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	onMount(() => {
		const syncFromSession = () => {
			const token = currentToken();
			if (!token) {
				activeToken = null;
				stages = [];
				recentResults = [];
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadData(token);
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
{:else}
	<section class="page-panel">
		<h2>{copy().form_title}</h2>
		<form class="result-form" on:submit={submitResult}>
			<label>
				<span>{copy().stage}</span>
				<select bind:value={selectedStageId}>
					<option value="">{copy().select_stage}</option>
					{#each stages as stage (stage.id)}
						<option value={stage.id}>{stageTitle(stage)}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().status}</span>
				<select bind:value={selectedStatus}>
					<option value="participant">{resultStatusLabel('participant')}</option>
					<option value="prize_winner">{resultStatusLabel('prize_winner')}</option>
					<option value="winner">{resultStatusLabel('winner')}</option>
				</select>
			</label>
			<label>
				<span>{copy().score_optional}</span>
				<input bind:value={scoreDraft} placeholder={copy().score_placeholder} />
			</label>
			<label>
				<span>{copy().place_optional}</span>
				<input bind:value={placeDraft} placeholder={copy().place_placeholder} />
			</label>
			<label class="wide">
				<span>{copy().comment_optional}</span>
				<textarea bind:value={commentDraft} rows="3" placeholder={copy().comment_placeholder}></textarea>
			</label>
			<button class="btn-primary" type="submit" disabled={working || loading}>{copy().save}</button>
		</form>
	</section>

	<section class="page-panel">
		<h2>{copy().history_title}</h2>
		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else if recentResults.length === 0}
			<p class="page-subtitle">{copy().no_results}</p>
		{:else}
			<div class="history-list">
				{#each recentResults as entry (`${entry.stage_instance_id}:${entry.created_at}`)}
					{@const stage = stages.find((item) => item.id === entry.stage_instance_id)}
					<article class="surface-card result-card">
						<h3>{stage ? stageTitle(stage) : copy().stage_missing}</h3>
						<div class="meta-grid">
							<p><strong>{copy().field_date}:</strong> {formatDate(entry.created_at)}</p>
							<p><strong>{copy().status}:</strong> {resultStatusLabel(entry.result_status)}</p>
							<p><strong>{copy().field_score}:</strong> {scoreLabel(entry.score)}</p>
							<p><strong>{copy().field_place}:</strong> {entry.place_text ?? '-'}</p>
						</div>
						{#if entry.comment}
							<p><strong>{copy().field_comment}:</strong> {entry.comment}</p>
						{/if}
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
	{#if infoMessage}
		<section class="page-panel">
			<p class="info-banner">{infoMessage}</p>
		</section>
	{/if}
{/if}

<style>
	.result-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.result-form label {
		display: grid;
		gap: 0.32rem;
	}

	.result-form span {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ol-primary);
	}

	.result-form input,
	.result-form select,
	.result-form textarea {
		font: inherit;
		border: 1px solid var(--ol-border);
		border-radius: 0.6rem;
		padding: 0.56rem 0.62rem;
		background: #fff;
	}

	.result-form textarea {
		resize: vertical;
	}

	.result-form .wide {
		grid-column: span 2;
	}

	.history-list {
		display: grid;
		gap: 0.72rem;
	}

	.result-card {
		display: grid;
		gap: 0.48rem;
	}

	.result-card h3,
	.result-card p {
		margin: 0;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem 0.8rem;
	}

	@media (max-width: 760px) {
		.result-form,
		.meta-grid {
			grid-template-columns: 1fr;
		}

		.result-form .wide {
			grid-column: span 1;
		}

		.result-form .btn-primary {
			width: 100%;
		}
	}
</style>
