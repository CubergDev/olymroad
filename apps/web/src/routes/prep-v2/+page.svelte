<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		api,
		getErrorMessage,
		type V2PrepAnalyticsResponse,
		type V2PrepLogEntry,
		type V2PrepLogType,
		type V2PrepTopic,
		type V2PrepTopicFramework,
		type V2RoadmapItem
	} from '$lib/api';
	import { formatDate, resolveLocale, resultStatusLabel } from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		topic_filters: string;
		subject_code: string;
		series_id: string;
		apply_topics: string;
		entry_title: string;
		happened_on: string;
		minutes: string;
		log_type: string;
		stage_optional: string;
		framework_optional: string;
		topic_optional: string;
		note_optional: string;
		resource_url_optional: string;
		save_log: string;
		refresh: string;
		all: string;
		filters_from_data: string;
		logs_title: string;
		loading: string;
		no_logs: string;
		analytics_title: string;
		sessions: string;
		total_minutes: string;
		avg_minutes: string;
		by_type: string;
		by_day: string;
		recent_results: string;
		no_results: string;
		info_log_saved: string;
		error_minutes_invalid: string;
		type_problems: string;
		type_theory: string;
		type_mock: string;
		type_contest: string;
		type_project: string;
		type_other: string;
		none: string;
		known_data: string;
		known_olympiads: string;
		known_topics: string;
		known_stages: string;
		no_known_olympiads: string;
		no_known_topics: string;
		no_known_stages: string;
		use_filter_series: string;
		use_note: string;
		use_stage: string;
		student_only_hint: string;
		topics_fallback_note: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Prep v2 | OlymRoad',
			meta_description: 'Preparation logs and analytics based on prep_logs and prep_log_topics.',
			hero_eyebrow: 'Prep v2',
			hero_title: 'Track preparation in new schema',
			hero_subtitle:
				'Create prep_logs with topic links and stage references, then monitor analytics and recent results.',
			sign_in_required: 'Sign in to use prep v2.',
			topic_filters: 'Topic filters',
			subject_code: 'Subject code',
			series_id: 'Series id',
			apply_topics: 'Apply topic filters',
			entry_title: 'New prep log entry',
			happened_on: 'Date',
			minutes: 'Minutes',
			log_type: 'Log type',
			stage_optional: 'Stage instance (optional)',
			framework_optional: 'Topic framework (optional)',
			topic_optional: 'Topic (optional)',
			note_optional: 'Note (optional)',
			resource_url_optional: 'Resource URL (optional)',
			save_log: 'Save log',
			refresh: 'Refresh',
			all: 'All',
			filters_from_data: 'Filter options are built from available olympiad stages and entered logs.',
			logs_title: 'Recent logs',
			loading: 'Loading...',
			no_logs: 'No prep logs yet.',
			analytics_title: 'Prep analytics',
			sessions: 'Sessions',
			total_minutes: 'Total minutes',
			avg_minutes: 'Avg minutes',
			by_type: 'By type',
			by_day: 'By day',
			recent_results: 'Recent stage results',
			no_results: 'No recent results.',
			info_log_saved: 'Prep log saved.',
			error_minutes_invalid: 'Minutes must be a positive integer.',
			type_problems: 'Problems',
			type_theory: 'Theory',
			type_mock: 'Mock',
			type_contest: 'Contest',
			type_project: 'Project',
			type_other: 'Other',
			none: 'None',
			known_data: 'Known data',
			known_olympiads: 'Loaded olympiads',
			known_topics: 'Already entered topics/notes',
			known_stages: 'Loaded stages',
			no_known_olympiads: 'No olympiads loaded yet.',
			no_known_topics: 'No entered topics yet.',
			no_known_stages: 'No stages loaded yet.',
			use_filter_series: 'Use as filter',
			use_note: 'Use in note',
			use_stage: 'Use as stage',
			student_only_hint: 'Detailed logs and analytics are available for student accounts.',
			topics_fallback_note: 'Topic catalog fallback is active (dictionaries source).'
		},
		ru: {
			meta_title: 'Подготовка v2 | OlymRoad',
			meta_description: 'Журналы подготовки и аналитика на prep_logs и prep_log_topics.',
			hero_eyebrow: 'Подготовка v2',
			hero_title: 'Ведите подготовку на новой схеме',
			hero_subtitle:
				'Создавайте prep_logs с привязкой тем и этапов, затем анализируйте динамику подготовки и результаты.',
			sign_in_required: 'Войдите, чтобы использовать подготовку v2.',
			topic_filters: 'Фильтры тем',
			subject_code: 'Код предмета',
			series_id: 'ID серии',
			apply_topics: 'Применить фильтры тем',
			entry_title: 'Новая запись подготовки',
			happened_on: 'Дата',
			minutes: 'Минуты',
			log_type: 'Тип записи',
			stage_optional: 'Экземпляр этапа (необязательно)',
			framework_optional: 'Каркас тем (необязательно)',
			topic_optional: 'Тема (необязательно)',
			note_optional: 'Комментарий (необязательно)',
			resource_url_optional: 'Ссылка на ресурс (необязательно)',
			save_log: 'Сохранить запись',
			refresh: 'Обновить',
			all: 'Все',
			filters_from_data: 'Опции фильтров собираются из доступных этапов олимпиад и уже введенных записей.',
			logs_title: 'Последние записи',
			loading: 'Загрузка...',
			no_logs: 'Записей подготовки пока нет.',
			analytics_title: 'Аналитика подготовки',
			sessions: 'Сессии',
			total_minutes: 'Всего минут',
			avg_minutes: 'Средние минуты',
			by_type: 'По типам',
			by_day: 'По дням',
			recent_results: 'Последние результаты этапов',
			no_results: 'Последних результатов нет.',
			info_log_saved: 'Запись подготовки сохранена.',
			error_minutes_invalid: 'Минуты должны быть положительным целым числом.',
			type_problems: 'Задачи',
			type_theory: 'Теория',
			type_mock: 'Пробник',
			type_contest: 'Контест',
			type_project: 'Проект',
			type_other: 'Другое',
			none: 'Нет',
			known_data: 'Уже введенные данные',
			known_olympiads: 'Загруженные олимпиады',
			known_topics: 'Уже введенные темы/заметки',
			known_stages: 'Загруженные этапы',
			no_known_olympiads: 'Олимпиады пока не загружены.',
			no_known_topics: 'Введенных тем пока нет.',
			no_known_stages: 'Этапы пока не загружены.',
			use_filter_series: 'Использовать в фильтре',
			use_note: 'Подставить в заметку',
			use_stage: 'Выбрать этап',
			student_only_hint: 'Подробные журналы и аналитика доступны для аккаунтов ученика.',
			topics_fallback_note: 'Используется резервный источник тем (справочники).'
		},
		kz: {
			meta_title: 'Дайындық v2 | OlymRoad',
			meta_description: 'prep_logs және prep_log_topics негізіндегі дайындық журналы мен аналитика.',
			hero_eyebrow: 'Дайындық v2',
			hero_title: 'Жаңа схемада дайындықты тіркеңіз',
			hero_subtitle:
				'Тақырыптар мен кезеңдермен байланысты prep_logs құрып, дайындық динамикасы мен соңғы нәтижелерді бақылаңыз.',
			sign_in_required: 'Дайындық v2 қолдану үшін жүйеге кіріңіз.',
			topic_filters: 'Тақырып сүзгілері',
			subject_code: 'Пән коды',
			series_id: 'Серия ID',
			apply_topics: 'Тақырып сүзгілерін қолдану',
			entry_title: 'Жаңа дайындық жазбасы',
			happened_on: 'Күні',
			minutes: 'Минут',
			log_type: 'Жазба түрі',
			stage_optional: 'Кезең нұсқасы (міндетті емес)',
			framework_optional: 'Тақырып құрылымы (міндетті емес)',
			topic_optional: 'Тақырып (міндетті емес)',
			note_optional: 'Ескертпе (міндетті емес)',
			resource_url_optional: 'Ресурс сілтемесі (міндетті емес)',
			save_log: 'Жазбаны сақтау',
			refresh: 'Жаңарту',
			all: 'Барлығы',
			filters_from_data: 'Сүзгі опциялары қолжетімді олимпиада кезеңдері мен енгізілген жазбалардан жиналады.',
			logs_title: 'Соңғы жазбалар',
			loading: 'Жүктелуде...',
			no_logs: 'Әзірге дайындық жазбалары жоқ.',
			analytics_title: 'Дайындық аналитикасы',
			sessions: 'Сессиялар',
			total_minutes: 'Жалпы минут',
			avg_minutes: 'Орташа минут',
			by_type: 'Түр бойынша',
			by_day: 'Күн бойынша',
			recent_results: 'Соңғы кезең нәтижелері',
			no_results: 'Соңғы нәтижелер жоқ.',
			info_log_saved: 'Дайындық жазбасы сақталды.',
			error_minutes_invalid: 'Минут оң бүтін сан болуы керек.',
			type_problems: 'Есептер',
			type_theory: 'Теория',
			type_mock: 'Сынақ',
			type_contest: 'Контест',
			type_project: 'Жоба',
			type_other: 'Басқа',
			none: 'Жоқ',
			known_data: 'Енгізілген деректер',
			known_olympiads: 'Жүктелген олимпиадалар',
			known_topics: 'Енгізілген тақырыптар/жазбалар',
			known_stages: 'Жүктелген кезеңдер',
			no_known_olympiads: 'Әзірге олимпиадалар жүктелмеген.',
			no_known_topics: 'Енгізілген тақырыптар жоқ.',
			no_known_stages: 'Әзірге кезеңдер жүктелмеген.',
			use_filter_series: 'Сүзгіге қолдану',
			use_note: 'Жазбаға қою',
			use_stage: 'Кезең ретінде таңдау',
			student_only_hint: 'Толық журналдар мен аналитика тек оқушы аккаунттарына қолжетімді.',
			topics_fallback_note: 'Тақырыптар үшін резервтік дереккөз қолданылды (анықтамалықтар).'
		}
	};

	const LOG_TYPES: V2PrepLogType[] = ['problems', 'theory', 'mock', 'contest', 'project', 'other'];
	type SeriesOption = { id: string; label: string };

	let loading = false;
	let working = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;
	let activeToken: string | null = null;
	let isStudent = false;
	let topicsFallbackActive = false;

	let subjectCode = '';
	let seriesId = '';

	let happenedOn = new Date().toISOString().slice(0, 10);
	let minutes = '90';
	let logType: V2PrepLogType = 'theory';
	let stageInstanceId = '';
	let frameworkId = '';
	let topicId = '';
	let note = '';
	let resourceUrl = '';

	let frameworks: V2PrepTopicFramework[] = [];
	let topics: V2PrepTopic[] = [];
	let stageInstances: V2RoadmapItem[] = [];
	let seriesOptions: SeriesOption[] = [];
	let subjectCodeOptions: string[] = [];
	let enteredTopicOptions: string[] = [];
	let logs: V2PrepLogEntry[] = [];
	let analytics: V2PrepAnalyticsResponse | null = null;

	const copy = (): UiCopy => COPY[resolveLocale()];

	const logTypeLabel = (value: V2PrepLogType): string => {
		if (value === 'problems') return copy().type_problems;
		if (value === 'theory') return copy().type_theory;
		if (value === 'mock') return copy().type_mock;
		if (value === 'contest') return copy().type_contest;
		if (value === 'project') return copy().type_project;
		return copy().type_other;
	};

	const frameworkLabel = (value: V2PrepTopicFramework): string =>
		resolveLocale() === 'kz' ? value.name_kz ?? value.name_ru : value.name_ru;

	const topicLabel = (value: V2PrepTopic): string =>
		resolveLocale() === 'kz' ? value.name_kz ?? value.name_ru : value.name_ru;

	const filteredTopics = (): V2PrepTopic[] =>
		topics.filter((topic) => !frameworkId || topic.framework_id === frameworkId);

	const stageLabel = (item: V2RoadmapItem): string => {
		const stagePart = [item.stage_template_name_ru, item.label].filter(Boolean).join(' - ');
		return `${item.series_abbr ?? item.series_name_ru} / ${stagePart}`;
	};

	const seriesOptionLabel = (item: V2RoadmapItem): string => {
		const locale = resolveLocale();
		const seriesName = locale === 'kz' ? item.series_name_kz ?? item.series_name_ru : item.series_name_ru;
		return item.series_abbr ? `${item.series_abbr} - ${seriesName}` : seriesName;
	};

	const loadPrep = async (token: string) => {
		loading = true;
		errorMessage = null;
		topicsFallbackActive = false;
		try {
			const roadmapResponse = await api.getRoadmapV2(token, { limit: 200 });
			let loadedFrameworks: V2PrepTopicFramework[] = [];
			let loadedTopics: V2PrepTopic[] = [];

			try {
				const topicsResponse = await api.getPrepTopicsV2(token, {
					subject_code: subjectCode.trim() || undefined,
					series_id: seriesId.trim() || undefined,
					limit: 400
				});
				loadedFrameworks = topicsResponse.topic_frameworks;
				loadedTopics = topicsResponse.topics;
			} catch {
				const dictionaries = await api.getDictionaries();
				loadedFrameworks = dictionaries.topic_frameworks ?? [];
				loadedTopics = dictionaries.topics ?? [];
				topicsFallbackActive = true;
			}

			frameworks = loadedFrameworks;
			topics = loadedTopics;
			if (frameworkId && !frameworks.some((value) => value.id === frameworkId)) {
				frameworkId = '';
			}
			if (topicId && !topics.some((value) => value.id === topicId)) {
				topicId = '';
			}
			stageInstances = roadmapResponse.items;
			const seriesMap = new Map<string, string>();
			const subjectSet = new Set<string>();
			for (const stage of stageInstances) {
				seriesMap.set(stage.series_id, seriesOptionLabel(stage));
				for (const code of stage.subject_codes ?? []) {
					if (code.trim().length > 0) {
						subjectSet.add(code);
					}
				}
			}
			for (const framework of frameworks) {
				if (framework.subject_code.trim().length > 0) {
					subjectSet.add(framework.subject_code);
				}
			}
			seriesOptions = Array.from(seriesMap.entries())
				.map(([id, label]) => ({ id, label }))
				.sort((left, right) => left.label.localeCompare(right.label));
			subjectCodeOptions = Array.from(subjectSet).sort((left, right) => left.localeCompare(right));
			if (subjectCode && !subjectCodeOptions.includes(subjectCode)) {
				subjectCode = '';
			}
			if (seriesId && !seriesOptions.some((option) => option.id === seriesId)) {
				seriesId = '';
			}
			if (stageInstanceId && !stageInstances.some((value) => value.id === stageInstanceId)) {
				stageInstanceId = '';
			}

			if (isStudent) {
				const [logsResponse, analyticsResponse] = await Promise.all([
					api.getPrepLogsV2(token, { limit: 200 }),
					api.getPrepAnalyticsV2(token, { days: 60 })
				]);
				logs = logsResponse.items;
				analytics = analyticsResponse;
				const enteredTopicSet = new Set<string>();
				for (const log of logs) {
					for (const topic of log.topics) {
						const localized = resolveLocale() === 'kz' ? topic.name_kz ?? topic.name_ru : topic.name_ru;
						if (localized.trim().length > 0) {
							enteredTopicSet.add(localized);
						}
					}
					if (log.note?.trim()) {
						enteredTopicSet.add(log.note.trim());
					}
				}
				enteredTopicOptions = Array.from(enteredTopicSet).slice(0, 24);
			} else {
				logs = [];
				analytics = null;
				enteredTopicOptions = [];
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
			frameworks = [];
			topics = [];
			logs = [];
			analytics = null;
			stageInstances = [];
			seriesOptions = [];
			subjectCodeOptions = [];
			enteredTopicOptions = [];
		} finally {
			loading = false;
		}
	};

	const onApplyTopics = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}
		await loadPrep(token);
	};

	const onAddLog = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const parsedMinutes = Number(minutes);
		if (!Number.isInteger(parsedMinutes) || parsedMinutes <= 0) {
			errorMessage = copy().error_minutes_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.addPrepLogV2(token, {
				happened_on: happenedOn,
				minutes: parsedMinutes,
				log_type: logType,
				note: note.trim() ? note.trim() : null,
				resource_url: resourceUrl.trim() ? resourceUrl.trim() : null,
				stage_instance_id: stageInstanceId || null,
				topic_ids: topicId ? [topicId] : []
			});
			infoMessage = copy().info_log_saved;
			note = '';
			resourceUrl = '';
			await loadPrep(token);
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
				frameworks = [];
				topics = [];
				logs = [];
				analytics = null;
				stageInstances = [];
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadPrep(token);
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
			<h2>{copy().topic_filters}</h2>
		</header>
		<form class="grid-auto filters" on:submit={onApplyTopics}>
			<label>
				<span>{copy().subject_code}</span>
				<select bind:value={subjectCode}>
					<option value="">{copy().all}</option>
					{#each subjectCodeOptions as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().series_id}</span>
				<select bind:value={seriesId}>
					<option value="">{copy().all}</option>
					{#each seriesOptions as option (option.id)}
						<option value={option.id}>{option.label}</option>
					{/each}
				</select>
			</label>
			<div class="actions">
				<button class="btn-primary" type="submit" disabled={loading || working}
					>{copy().apply_topics}</button
				>
				<button
					class="btn-secondary"
					type="button"
					on:click={() => activeToken && loadPrep(activeToken)}
					disabled={loading || working}
				>
					{copy().refresh}
				</button>
			</div>
		</form>
		{#if subjectCodeOptions.length > 0 || seriesOptions.length > 0}
			<p class="page-subtitle filter-hint">{copy().filters_from_data}</p>
		{/if}
		{#if topicsFallbackActive}
			<p class="page-subtitle filter-hint">{copy().topics_fallback_note}</p>
		{/if}
	</section>

	<section class="page-panel">
		<header class="section-heading">
			<h2>{copy().known_data}</h2>
		</header>
		<div class="known-grid">
			<article class="surface-card">
				<h3>{copy().known_olympiads}</h3>
				{#if seriesOptions.length === 0}
					<p>{copy().no_known_olympiads}</p>
				{:else}
					<div class="known-list">
						{#each seriesOptions as option (option.id)}
							<button
								class="btn-secondary known-chip"
								type="button"
								on:click={() => {
									seriesId = option.id;
								}}
								title={copy().use_filter_series}
							>
								{option.label}
							</button>
						{/each}
					</div>
				{/if}
			</article>
			<article class="surface-card">
				<h3>{copy().known_topics}</h3>
				{#if enteredTopicOptions.length === 0}
					<p>{copy().no_known_topics}</p>
				{:else}
					<div class="known-list">
						{#each enteredTopicOptions as value (value)}
							<button
								class="btn-secondary known-chip"
								type="button"
								on:click={() => {
									note = value;
								}}
								title={copy().use_note}
							>
								{value}
							</button>
						{/each}
					</div>
				{/if}
			</article>
			<article class="surface-card">
				<h3>{copy().known_stages}</h3>
				{#if stageInstances.length === 0}
					<p>{copy().no_known_stages}</p>
				{:else}
					<div class="known-list">
						{#each stageInstances.slice(0, 30) as stage (stage.id)}
							<button
								class="btn-secondary known-chip"
								type="button"
								on:click={() => {
									stageInstanceId = stage.id;
								}}
								title={copy().use_stage}
							>
								{stageLabel(stage)}
							</button>
						{/each}
					</div>
				{/if}
			</article>
		</div>
	</section>

	<section class="page-panel">
		<header class="section-heading">
			<h2>{copy().entry_title}</h2>
		</header>
		<form class="entry-grid" on:submit={onAddLog}>
			<label>
				<span>{copy().happened_on}</span>
				<input bind:value={happenedOn} type="date" />
			</label>
			<label>
				<span>{copy().minutes}</span>
				<input bind:value={minutes} type="number" min="1" />
			</label>
			<label>
				<span>{copy().log_type}</span>
				<select bind:value={logType}>
					{#each LOG_TYPES as option (option)}
						<option value={option}>{logTypeLabel(option)}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().stage_optional}</span>
				<select bind:value={stageInstanceId}>
					<option value="">{copy().none}</option>
					{#each stageInstances as stage (stage.id)}
						<option value={stage.id}>{stageLabel(stage)}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().framework_optional}</span>
				<select
					bind:value={frameworkId}
					on:change={() => {
						topicId = '';
					}}
				>
					<option value="">{copy().none}</option>
					{#each frameworks as framework (framework.id)}
						<option value={framework.id}>{frameworkLabel(framework)}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().topic_optional}</span>
				<select bind:value={topicId}>
					<option value="">{copy().none}</option>
					{#each filteredTopics() as topic (topic.id)}
						<option value={topic.id}>{topicLabel(topic)}</option>
					{/each}
				</select>
			</label>
			<label class="wide">
				<span>{copy().note_optional}</span>
				<input bind:value={note} />
			</label>
			<label class="wide">
				<span>{copy().resource_url_optional}</span>
				<input bind:value={resourceUrl} placeholder="https://..." />
			</label>
			<div class="actions wide">
				<button class="btn-primary" type="submit" disabled={working || loading}>{copy().save_log}</button>
				<button
					class="btn-secondary"
					type="button"
					on:click={() => activeToken && loadPrep(activeToken)}
					disabled={working || loading}
				>
					{copy().refresh}
				</button>
			</div>
		</form>
	</section>

	<section class="page-panel">
		<header class="section-heading">
			<h2>{copy().logs_title}</h2>
		</header>
		{#if !isStudent}
			<p class="page-subtitle">{copy().student_only_hint}</p>
		{:else if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else if logs.length === 0}
			<p class="page-subtitle">{copy().no_logs}</p>
		{:else}
			<div class="log-cards">
				{#each logs as entry (entry.id)}
					<article class="surface-card log-card">
						<h3>{formatDate(entry.happened_on)}</h3>
						<p>{logTypeLabel(entry.log_type)}</p>
						<p>{entry.minutes} min</p>
						<p>{entry.note ?? '-'}</p>
						{#if entry.topics.length > 0}
							<div class="pill-row">
								{#each entry.topics as topic (topic.id)}
									<span class="pill">{resolveLocale() === 'kz' ? topic.name_kz ?? topic.name_ru : topic.name_ru}</span>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="page-panel">
		<header class="section-heading">
			<h2>{copy().analytics_title}</h2>
		</header>
		{#if !isStudent}
			<p class="page-subtitle">{copy().student_only_hint}</p>
		{:else if loading || !analytics}
			<p class="page-subtitle">{copy().loading}</p>
		{:else}
			<div class="summary-grid">
				<article class="surface-card">
					<h3>{copy().sessions}</h3>
					<p>{analytics.summary.sessions}</p>
				</article>
				<article class="surface-card">
					<h3>{copy().total_minutes}</h3>
					<p>{analytics.summary.minutes}</p>
				</article>
				<article class="surface-card">
					<h3>{copy().avg_minutes}</h3>
					<p>{analytics.summary.avg_minutes}</p>
				</article>
			</div>

			<div class="analytics-grid">
				<section class="surface-card">
					<h3>{copy().by_type}</h3>
					<ul>
						{#each analytics.by_type as row (row.log_type)}
							<li>{logTypeLabel(row.log_type)}: {row.sessions} / {row.minutes}</li>
						{/each}
					</ul>
				</section>
				<section class="surface-card">
					<h3>{copy().by_day}</h3>
					<ul>
						{#each analytics.by_day.slice(0, 14) as row (row.happened_on)}
							<li>{formatDate(row.happened_on)}: {row.sessions} / {row.minutes}</li>
						{/each}
					</ul>
				</section>
				<section class="surface-card">
					<h3>{copy().recent_results}</h3>
					{#if analytics.recent_results.length === 0}
						<p>{copy().no_results}</p>
					{:else}
						<ul>
							{#each analytics.recent_results as row (row.stage_instance_id + row.created_at)}
								<li>
									{resultStatusLabel(row.result_status)}
									{#if row.score !== null}
										- {row.score}
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
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
		gap: 0.75rem;
	}

	.filters label,
	.entry-grid label {
		display: grid;
		gap: 0.35rem;
		padding: 0.7rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.72rem;
		background: #fff;
	}

	.filters span,
	.entry-grid span {
		font-size: 0.73rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ol-primary);
	}

	.filters input,
	.entry-grid input,
	.entry-grid select {
		font: inherit;
		border: 1px solid var(--ol-border);
		border-radius: 0.58rem;
		padding: 0.5rem 0.58rem;
		min-height: 2.45rem;
	}

	.entry-grid {
		display: grid;
		gap: 0.75rem;
	}

	.wide {
		grid-column: span 1;
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

	.known-grid {
		display: grid;
		gap: 0.7rem;
	}

	.known-grid h3,
	.known-grid p {
		margin: 0;
	}

	.known-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.known-chip {
		min-height: 0;
		padding: 0.36rem 0.62rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.log-cards {
		display: grid;
		gap: 0.7rem;
	}

	.log-card {
		display: grid;
		gap: 0.25rem;
	}

	.log-card h3,
	.log-card p {
		margin: 0;
	}

	.summary-grid,
	.analytics-grid {
		display: grid;
		gap: 0.7rem;
	}

	.analytics-grid ul {
		margin: 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.25rem;
	}

	@media (min-width: 900px) {
		.entry-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.wide {
			grid-column: span 2;
		}

		.actions {
			grid-template-columns: repeat(2, minmax(0, max-content));
		}

		.actions button {
			width: auto;
		}

		.log-cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.summary-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.analytics-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.known-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
