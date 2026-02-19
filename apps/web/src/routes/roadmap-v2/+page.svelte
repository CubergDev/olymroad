<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		api,
		getErrorMessage,
		type ResultStatus,
		type V2RoadmapItem,
		type V2StageDetails,
		type V2StudentStageStatus
	} from '$lib/api';
	import { eventTypeLabel, formatDate, resultStatusLabel, resolveLocale, stageTypeLabel } from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		filters_title: string;
		series_id: string;
		subject_code: string;
		stage_type: string;
		from: string;
		to: string;
		deadline_soon: string;
		apply: string;
		refresh: string;
		all: string;
		values_from_data: string;
		stages_title: string;
		loading: string;
		no_items: string;
		date: string;
		deadline: string;
		location: string;
		location_empty: string;
		plan_status: string;
		save_plan: string;
		result_status: string;
		score: string;
		place_text: string;
		save_result: string;
		open_details: string;
		details_title: string;
		documents: string;
		topics: string;
		no_documents: string;
		no_topics: string;
		info_plan_saved: string;
		info_result_saved: string;
		error_score_invalid: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'V2 Roadmap | OlymRoad',
			meta_description: 'Functional roadmap powered by stage_instances and student_stage_plans.',
			hero_eyebrow: 'Roadmap v2',
			hero_title: 'Plan olympiad pipeline on new stage schema',
			hero_subtitle:
				'Uses stage_instances, student_stage_plans, stage_results, and linked topic frameworks for preparation.',
			sign_in_required: 'Sign in to use roadmap v2.',
			filters_title: 'Filters',
			series_id: 'Series id',
			subject_code: 'Subject code',
			stage_type: 'Stage type',
			from: 'From',
			to: 'To',
			deadline_soon: 'Deadline soon',
			apply: 'Apply',
			refresh: 'Refresh',
			all: 'All',
			values_from_data: 'Filter values are generated from currently loaded olympiad stages.',
			stages_title: 'Stage instances',
			loading: 'Loading roadmap...',
			no_items: 'No stage instances found for current filters.',
			date: 'Date',
			deadline: 'Registration deadline',
			location: 'Location',
			location_empty: 'TBD',
			plan_status: 'Plan status',
			save_plan: 'Save plan',
			result_status: 'Result status',
			score: 'Score',
			place_text: 'Place text',
			save_result: 'Save result',
			open_details: 'Open details',
			details_title: 'Stage details',
			documents: 'Documents',
			topics: 'Topic frameworks',
			no_documents: 'No documents linked.',
			no_topics: 'No topic frameworks linked.',
			info_plan_saved: 'Plan status saved.',
			info_result_saved: 'Stage result saved.',
			error_score_invalid: 'Score must be numeric.'
		},
		ru: {
			meta_title: 'Дорожная карта v2 | OlymRoad',
			meta_description: 'Функциональная дорожная карта на stage_instances и student_stage_plans.',
			hero_eyebrow: 'Дорожная карта v2',
			hero_title: 'Планируйте олимпиадный конвейер на новой схеме этапов',
			hero_subtitle:
				'Используются stage_instances, student_stage_plans, stage_results и связанные карты тем для подготовки.',
			sign_in_required: 'Войдите, чтобы использовать дорожную карту v2.',
			filters_title: 'Фильтры',
			series_id: 'ID серии',
			subject_code: 'Код предмета',
			stage_type: 'Тип этапа',
			from: 'С',
			to: 'По',
			deadline_soon: 'Скоро дедлайн',
			apply: 'Применить',
			refresh: 'Обновить',
			all: 'Все',
			values_from_data: 'Значения фильтров собраны из уже загруженных этапов олимпиад.',
			stages_title: 'Экземпляры этапов',
			loading: 'Загрузка дорожной карты...',
			no_items: 'По текущим фильтрам этапы не найдены.',
			date: 'Дата',
			deadline: 'Дедлайн регистрации',
			location: 'Локация',
			location_empty: 'Уточняется',
			plan_status: 'Статус плана',
			save_plan: 'Сохранить план',
			result_status: 'Статус результата',
			score: 'Балл',
			place_text: 'Текст места',
			save_result: 'Сохранить результат',
			open_details: 'Открыть детали',
			details_title: 'Детали этапа',
			documents: 'Документы',
			topics: 'Каркасы тем',
			no_documents: 'Связанные документы отсутствуют.',
			no_topics: 'Связанные каркасы тем отсутствуют.',
			info_plan_saved: 'Статус плана сохранен.',
			info_result_saved: 'Результат этапа сохранен.',
			error_score_invalid: 'Балл должен быть числом.'
		},
		kz: {
			meta_title: 'Жол картасы v2 | OlymRoad',
			meta_description: 'stage_instances және student_stage_plans негізіндегі функционалды жол картасы.',
			hero_eyebrow: 'Жол картасы v2',
			hero_title: 'Жаңа кезең схемасында олимпиада конвейерін жоспарлаңыз',
			hero_subtitle:
				'stage_instances, student_stage_plans, stage_results және дайындыққа байланысты тақырып құрылымдары қолданылады.',
			sign_in_required: 'Жол картасы v2 қолдану үшін жүйеге кіріңіз.',
			filters_title: 'Сүзгілер',
			series_id: 'Серия ID',
			subject_code: 'Пән коды',
			stage_type: 'Кезең түрі',
			from: 'Бастап',
			to: 'Дейін',
			deadline_soon: 'Дедлайн жақын',
			apply: 'Қолдану',
			refresh: 'Жаңарту',
			all: 'Барлығы',
			values_from_data: 'Сүзгі мәндері жүктелген олимпиада кезеңдерінен автоматты түрде жиналады.',
			stages_title: 'Кезең нұсқалары',
			loading: 'Жол картасы жүктелуде...',
			no_items: 'Ағымдағы сүзгілер бойынша кезеңдер табылмады.',
			date: 'Күні',
			deadline: 'Тіркелу дедлайны',
			location: 'Өтетін жері',
			location_empty: 'Нақтыланады',
			plan_status: 'Жоспар күйі',
			save_plan: 'Жоспарды сақтау',
			result_status: 'Нәтиже күйі',
			score: 'Ұпай',
			place_text: 'Орын мәтіні',
			save_result: 'Нәтижені сақтау',
			open_details: 'Толығырақ ашу',
			details_title: 'Кезең мәліметтері',
			documents: 'Құжаттар',
			topics: 'Тақырып құрылымдары',
			no_documents: 'Байланысты құжаттар жоқ.',
			no_topics: 'Байланысты тақырып құрылымдары жоқ.',
			info_plan_saved: 'Жоспар күйі сақталды.',
			info_result_saved: 'Кезең нәтижесі сақталды.',
			error_score_invalid: 'Ұпай сан болуы керек.'
		}
	};

	const PLAN_STATUSES: V2StudentStageStatus[] = [
		'PLANNED',
		'REGISTERED',
		'PARTICIPATED',
		'RESULT_ENTERED',
		'MISSED',
		'CANCELLED'
	];
	const RESULT_STATUSES: ResultStatus[] = ['participant', 'prize_winner', 'winner'];
	const STAGE_TYPES = ['selection', 'regional', 'final', 'submission', 'defense', 'training'];
	type SeriesOption = { id: string; label: string };

	let loading = false;
	let working = false;
	let detailLoading = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;
	let activeToken: string | null = null;
	let isStudent = false;

	let seriesId = '';
	let subjectCode = '';
	let stageType = '';
	let fromDate = '';
	let toDate = '';
	let deadlineSoon = false;

	let items: V2RoadmapItem[] = [];
	let seriesOptions: SeriesOption[] = [];
	let subjectCodeOptions: string[] = [];
	let selectedStageId = '';
	let stageDetails: V2StageDetails | null = null;
	let planDrafts: Record<string, V2StudentStageStatus> = {};
	let resultStatusDrafts: Record<string, ResultStatus> = {};
	let scoreDrafts: Record<string, string> = {};
	let placeTextDrafts: Record<string, string> = {};

	const copy = (): UiCopy => COPY[resolveLocale()];

	const planStatusLabel = (status: V2StudentStageStatus): string => {
		if (status === 'PLANNED') return 'Planned / Запланировано / Жоспарда';
		if (status === 'REGISTERED') return 'Registered / Зарегистрирован / Тіркелген';
		if (status === 'PARTICIPATED') return 'Participated / Участвовал / Қатысқан';
		if (status === 'RESULT_ENTERED') return 'Result entered / Результат внесен / Нәтиже енгізілді';
		if (status === 'MISSED') return 'Missed / Пропущено / Өткізіп алды';
		return 'Cancelled / Отменено / Болдырылмады';
	};

	const stageDateLabel = (item: V2RoadmapItem): string => {
		if (item.date_precision === 'UNKNOWN' || !item.starts_on) {
			return '-';
		}
		if (item.date_precision === 'RANGE' && item.ends_on) {
			return `${formatDate(item.starts_on)} - ${formatDate(item.ends_on)}`;
		}
		if (item.date_precision === 'MONTH') {
			return formatDate(item.starts_on, { month: 'long', year: 'numeric' });
		}
		return formatDate(item.starts_on);
	};

	const stageTitle = (item: V2RoadmapItem): string =>
		[item.stage_template_name_ru, item.label].filter((value) => value && value.trim().length > 0).join(' - ');

	const seriesOptionLabel = (item: V2RoadmapItem): string => {
		const locale = resolveLocale();
		const name = locale === 'kz' ? item.series_name_kz ?? item.series_name_ru : item.series_name_ru;
		if (item.series_abbr?.trim()) {
			return `${item.series_abbr} - ${name}`;
		}
		return name;
	};

	const rebuildFilterOptions = () => {
		const seriesMap = new Map<string, string>();
		const subjectSet = new Set<string>();

		for (const item of items) {
			seriesMap.set(item.series_id, seriesOptionLabel(item));
			for (const code of item.subject_codes ?? []) {
				if (code.trim().length > 0) {
					subjectSet.add(code);
				}
			}
		}

		seriesOptions = Array.from(seriesMap.entries())
			.map(([id, label]) => ({ id, label }))
			.sort((left, right) => left.label.localeCompare(right.label));
		subjectCodeOptions = Array.from(subjectSet).sort((left, right) => left.localeCompare(right));

		if (seriesId && !seriesOptions.some((option) => option.id === seriesId)) {
			seriesId = '';
		}
		if (subjectCode && !subjectCodeOptions.includes(subjectCode)) {
			subjectCode = '';
		}
	};

	const ensureDrafts = () => {
		const nextPlanDrafts = { ...planDrafts };
		const nextResultStatusDrafts = { ...resultStatusDrafts };
		const nextScoreDrafts = { ...scoreDrafts };
		const nextPlaceTextDrafts = { ...placeTextDrafts };

		for (const item of items) {
			nextPlanDrafts[item.id] = item.student_plan_status ?? nextPlanDrafts[item.id] ?? 'PLANNED';
			nextResultStatusDrafts[item.id] = item.result_status ?? nextResultStatusDrafts[item.id] ?? 'participant';
			nextScoreDrafts[item.id] =
				nextScoreDrafts[item.id] ?? (item.score === null || item.score === undefined ? '' : String(item.score));
			nextPlaceTextDrafts[item.id] = nextPlaceTextDrafts[item.id] ?? (item.place_text ?? '');
		}

		planDrafts = nextPlanDrafts;
		resultStatusDrafts = nextResultStatusDrafts;
		scoreDrafts = nextScoreDrafts;
		placeTextDrafts = nextPlaceTextDrafts;
	};

	const toQuery = () => ({
		series_id: seriesId.trim() || undefined,
		subject_code: subjectCode.trim() || undefined,
		stage_type: stageType || undefined,
		from: fromDate || undefined,
		to: toDate || undefined,
		deadline_soon: deadlineSoon || undefined,
		limit: 250
	});

	const loadRoadmap = async (token: string) => {
		loading = true;
		errorMessage = null;
		try {
			const response = await api.getRoadmapV2(token, toQuery());
			items = response.items;
			rebuildFilterOptions();
			ensureDrafts();
		} catch (error) {
			errorMessage = getErrorMessage(error);
			items = [];
			seriesOptions = [];
			subjectCodeOptions = [];
		} finally {
			loading = false;
		}
	};

	const loadDetails = async (token: string, id: string) => {
		detailLoading = true;
		errorMessage = null;
		try {
			stageDetails = await api.getStageInstanceV2(token, id);
			selectedStageId = id;
		} catch (error) {
			errorMessage = getErrorMessage(error);
			stageDetails = null;
		} finally {
			detailLoading = false;
		}
	};

	const onApplyFilters = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}
		await loadRoadmap(token);
	};

	const onUpdatePlanDraft = (id: string, value: string) => {
		planDrafts = { ...planDrafts, [id]: value as V2StudentStageStatus };
	};

	const onUpdateResultStatusDraft = (id: string, value: string) => {
		resultStatusDrafts = { ...resultStatusDrafts, [id]: value as ResultStatus };
	};

	const onUpdateScoreDraft = (id: string, value: string) => {
		scoreDrafts = { ...scoreDrafts, [id]: value };
	};

	const onUpdatePlaceTextDraft = (id: string, value: string) => {
		placeTextDrafts = { ...placeTextDrafts, [id]: value };
	};

	const onSavePlan = async (id: string) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}
		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.upsertStagePlanV2(token, id, {
				status: planDrafts[id] ?? 'PLANNED'
			});
			infoMessage = copy().info_plan_saved;
			await loadRoadmap(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onSaveResult = async (id: string) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const scoreRaw = scoreDrafts[id] ?? '';
		const score = scoreRaw.trim().length === 0 ? null : Number(scoreRaw);
		if (scoreRaw.trim().length > 0 && !Number.isFinite(score)) {
			errorMessage = copy().error_score_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.saveStageResultV2(token, id, {
				result_status: resultStatusDrafts[id] ?? 'participant',
				score,
				place_text: placeTextDrafts[id]?.trim() ? placeTextDrafts[id].trim() : null
			});
			infoMessage = copy().info_result_saved;
			await loadRoadmap(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	onMount(() => {
		const syncFromSession = () => {
			isStudent = $session.user?.role === 'student';
			const token = currentToken();
			if (!token) {
				activeToken = null;
				items = [];
				stageDetails = null;
				selectedStageId = '';
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadRoadmap(token);
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
		<header class="section-heading">
			<h2>{copy().filters_title}</h2>
		</header>
		<form class="grid-auto filters" on:submit={onApplyFilters}>
			<label>
				<span>{copy().series_id}</span>
				<select bind:value={seriesId}>
					<option value="">{copy().all}</option>
					{#each seriesOptions as option (option.id)}
						<option value={option.id}>{option.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().subject_code}</span>
				<select bind:value={subjectCode}>
					<option value="">{copy().all}</option>
					{#each subjectCodeOptions as code (code)}
						<option value={code}>{code}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().stage_type}</span>
				<select bind:value={stageType}>
					<option value="">All</option>
					{#each STAGE_TYPES as option (option)}
						<option value={option}>{stageTypeLabel(option)}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().from}</span>
				<input bind:value={fromDate} type="date" />
			</label>
			<label>
				<span>{copy().to}</span>
				<input bind:value={toDate} type="date" />
			</label>
			<label class="check-label">
				<span>{copy().deadline_soon}</span>
				<input bind:checked={deadlineSoon} type="checkbox" />
			</label>
			<div class="actions">
				<button class="btn-primary" type="submit" disabled={loading || working}>{copy().apply}</button>
				<button
					class="btn-secondary"
					type="button"
					on:click={() => activeToken && loadRoadmap(activeToken)}
					disabled={loading || working}
				>
					{copy().refresh}
				</button>
			</div>
		</form>
		{#if seriesOptions.length > 0 || subjectCodeOptions.length > 0}
			<p class="page-subtitle filter-hint">{copy().values_from_data}</p>
		{/if}
	</section>

	<section class="page-panel">
		<header class="section-heading">
			<h2>{copy().stages_title}</h2>
		</header>

		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else if items.length === 0}
			<p class="page-subtitle">{copy().no_items}</p>
		{:else}
			<div class="cards">
				{#each items as item (item.id)}
					<article class="surface-card card">
						<div class="card-head">
							<div>
								<h3>{item.series_abbr ?? item.series_name_ru}</h3>
								<p>{stageTitle(item)}</p>
							</div>
							<span class="pill">{eventTypeLabel(item.event_type)}</span>
						</div>

						<div class="pill-row">
							<span class="pill">{stageTypeLabel(item.stage_type)}</span>
							<span class="pill">{item.series_level}</span>
							{#if item.subject_codes?.length}
								{#each item.subject_codes as code (code)}
									<span class="pill">{code}</span>
								{/each}
							{/if}
						</div>

						<div class="meta-grid">
							<p><strong>{copy().date}:</strong> {stageDateLabel(item)}</p>
							<p>
								<strong>{copy().deadline}:</strong>
								{item.registration_deadline ? formatDate(item.registration_deadline) : '-'}
							</p>
							<p>
								<strong>{copy().location}:</strong>
								{item.location_text ?? copy().location_empty}
							</p>
						</div>

						{#if isStudent}
							<div class="student-grid">
								<label>
									<span>{copy().plan_status}</span>
									<select
										value={planDrafts[item.id] ?? 'PLANNED'}
										on:change={(event) =>
											onUpdatePlanDraft(item.id, (event.currentTarget as HTMLSelectElement).value)}
									>
										{#each PLAN_STATUSES as status (status)}
											<option value={status}>{planStatusLabel(status)}</option>
										{/each}
									</select>
								</label>
								<button
									class="btn-secondary"
									type="button"
									on:click={() => onSavePlan(item.id)}
									disabled={working}
								>
									{copy().save_plan}
								</button>

								<label>
									<span>{copy().result_status}</span>
									<select
										value={resultStatusDrafts[item.id] ?? 'participant'}
										on:change={(event) =>
											onUpdateResultStatusDraft(item.id, (event.currentTarget as HTMLSelectElement).value)}
									>
										{#each RESULT_STATUSES as status (status)}
											<option value={status}>{resultStatusLabel(status)}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>{copy().score}</span>
									<input
										type="number"
										step="any"
										value={scoreDrafts[item.id] ?? ''}
										on:input={(event) =>
											onUpdateScoreDraft(item.id, (event.currentTarget as HTMLInputElement).value)}
									/>
								</label>
								<label>
									<span>{copy().place_text}</span>
									<input
										value={placeTextDrafts[item.id] ?? ''}
										on:input={(event) =>
											onUpdatePlaceTextDraft(item.id, (event.currentTarget as HTMLInputElement).value)}
									/>
								</label>
								<button
									class="btn-primary"
									type="button"
									on:click={() => onSaveResult(item.id)}
									disabled={working}
								>
									{copy().save_result}
								</button>
							</div>
						{/if}

						<div class="card-actions">
							<button
								class="btn-secondary"
								type="button"
								on:click={() => activeToken && loadDetails(activeToken, item.id)}
								disabled={detailLoading}
							>
								{copy().open_details}
							</button>
						</div>

						{#if selectedStageId === item.id}
							<div class="detail-block">
								<h4>{copy().details_title}</h4>
								{#if detailLoading}
									<p class="page-subtitle">{copy().loading}</p>
								{:else if stageDetails}
									<div class="detail-grid">
										<section>
											<h5>{copy().documents}</h5>
											{#if stageDetails.documents.length === 0}
												<p>{copy().no_documents}</p>
											{:else}
												<ul>
													{#each stageDetails.documents as document (document.id)}
														<li>
															<button
																class="btn-secondary"
																type="button"
																on:click={() => window.open(document.url, '_blank', 'noopener,noreferrer')}
															>
																{document.title_ru}
															</button>
														</li>
													{/each}
												</ul>
											{/if}
										</section>
										<section>
											<h5>{copy().topics}</h5>
											{#if stageDetails.topic_frameworks.length === 0}
												<p>{copy().no_topics}</p>
											{:else}
												<ul>
													{#each stageDetails.topic_frameworks as framework (framework.id)}
														<li>{resolveLocale() === 'kz' ? framework.name_kz ?? framework.name_ru : framework.name_ru}</li>
													{/each}
												</ul>
											{/if}
										</section>
									</div>
								{/if}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

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

<style>
	.section-heading h2 {
		margin: 0;
	}

	.filters {
		gap: 0.8rem;
	}

	.filters label {
		display: grid;
		gap: 0.35rem;
		padding: 0.7rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.72rem;
		background: #fff;
	}

	.filters span {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ol-primary);
	}

	.filters input,
	.filters select {
		font: inherit;
		min-height: 2.45rem;
		padding: 0.5rem 0.58rem;
		border-radius: 0.58rem;
		border: 1px solid var(--ol-border);
	}

	.check-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.check-label input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
	}

	.actions {
		display: grid;
		gap: 0.5rem;
	}

	.actions button {
		width: 100%;
	}

	.filter-hint {
		margin: 0.55rem 0 0;
	}

	.cards {
		display: grid;
		gap: 0.8rem;
	}

	.card {
		display: grid;
		gap: 0.62rem;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.card-head h3 {
		margin: 0;
		font-size: 1rem;
	}

	.card-head p {
		margin: 0.22rem 0 0;
		color: var(--ol-ink-soft);
	}

	.meta-grid {
		display: grid;
		gap: 0.25rem;
	}

	.meta-grid p {
		margin: 0;
		font-size: 0.9rem;
	}

	.student-grid {
		display: grid;
		gap: 0.56rem;
		grid-template-columns: minmax(0, 1fr);
		align-items: stretch;
	}

	.student-grid > * {
		min-width: 0;
	}

	.student-grid label {
		display: grid;
		gap: 0.35rem;
	}

	.student-grid span {
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--ol-primary);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.student-grid input,
	.student-grid select {
		min-height: 2.35rem;
		padding: 0.45rem 0.56rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.58rem;
		font: inherit;
	}

	.student-grid button {
		width: 100%;
		margin: 0;
	}

	.card-actions {
		display: flex;
		justify-content: flex-start;
	}

	.card-actions .btn-secondary {
		width: 100%;
	}

	.detail-block {
		border-top: 1px solid var(--ol-border);
		padding-top: 0.58rem;
	}

	.detail-block h4 {
		margin: 0 0 0.56rem;
	}

	.detail-grid {
		display: grid;
		gap: 0.8rem;
	}

	.detail-grid h5 {
		margin: 0 0 0.32rem;
	}

	.detail-grid ul {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.25rem;
	}

	@media (min-width: 920px) {
		.actions {
			grid-template-columns: repeat(2, minmax(0, max-content));
		}

		.actions button {
			width: auto;
		}

		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.detail-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1200px) {
		.student-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.student-grid > button {
			grid-column: span 2;
		}
	}
</style>
