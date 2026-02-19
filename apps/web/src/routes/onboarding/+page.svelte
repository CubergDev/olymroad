<script lang="ts">
	import { onMount } from 'svelte';
	import {
		api,
		getErrorMessage,
		type DictionaryEntry,
		type OnboardingRecommendationsResponse
	} from '$lib/api';
	import { dictionaryLabel, resolveLocale } from '$lib/i18n';
	import { session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		setup_eyebrow: string;
		setup_title: string;
		directions_required: string;
		no_subjects_hint: string;
		grade_required: string;
		grade_select: string;
		school_optional: string;
		school_placeholder: string;
		goals_required: string;
		goals_placeholder: string;
		saving: string;
		complete_onboarding: string;
		refresh: string;
		loading_profile: string;
		error_only_students: string;
		error_sign_in_first: string;
		error_pick_direction: string;
		error_goals_required: string;
		error_grade_invalid: string;
		info_saved: string;
		recommendations_loading: string;
		recommendations_title: string;
		recommendations_subtitle: string;
		recommendations_db_title: string;
		recommendations_db_empty: string;
		recommendations_ai_title: string;
		recommendations_ai_empty: string;
		recommendation_deadline: string;
		recommendation_fit_score: string;
		recommendation_source: string;
		recommendation_plan: string;
		recommendations_warning_prefix: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Initial Setup | OlymRoad',
			meta_description: 'Set student profile directions, class, and season goals.',
			hero_eyebrow: 'Initial setup',
			hero_title: 'Create your olympiad profile in one pass',
			hero_subtitle:
				'Set directions, goals, and class/grade so your study plan and preparation are relevant from day one.',
			sign_in_required: 'Sign in to finish initial setup.',
			setup_eyebrow: 'Profile setup',
			setup_title: 'Directions, class, and season goals',
			directions_required: 'Directions (required)',
			no_subjects_hint: 'No subjects found in dictionaries yet.',
			grade_required: 'Grade (required)',
			grade_select: 'Select grade',
			school_optional: 'School (optional)',
			school_placeholder: 'School name',
			goals_required: 'Goals (required)',
			goals_placeholder: 'Describe your season goals and target results',
			saving: 'Saving...',
			complete_onboarding: 'Finish setup',
			refresh: 'Refresh',
			loading_profile: 'Loading profile data...',
			error_only_students: 'Only student accounts can complete initial setup.',
			error_sign_in_first: 'Sign in first to finish initial setup.',
			error_pick_direction: 'Select at least one direction.',
			error_goals_required: 'Goals text is required.',
			error_grade_invalid: 'Grade must be an integer between 1 and 12.',
			info_saved: 'Initial setup completed and saved to the server.',
			recommendations_loading: 'Generating tailored olympiad recommendations...',
			recommendations_title: 'Recommended olympiads for your profile',
			recommendations_subtitle:
				'We combined OlymRoad database candidates and live web search with AI fit analysis.',
			recommendations_db_title: 'From OlymRoad database',
			recommendations_db_empty: 'No direct DB matches found yet. Try broadening directions.',
			recommendations_ai_title: 'Web + AI shortlist',
			recommendations_ai_empty:
				'AI shortlist is unavailable right now. Your onboarding data is still saved.',
			recommendation_deadline: 'Nearest deadline',
			recommendation_fit_score: 'Fit score',
			recommendation_source: 'Source',
			recommendation_plan: '30-day action plan',
			recommendations_warning_prefix: 'Note'
		},
		ru: {
			meta_title: 'Первичная настройка | OlymRoad',
			meta_description: 'Настройка направлений, класса и целей ученика.',
			hero_eyebrow: 'Первичная настройка',
			hero_title: 'Создайте олимпиадный профиль за один шаг',
			hero_subtitle:
				'Укажите направления, цели и класс, чтобы дорожная карта и планы подготовки сразу были релевантны.',
			sign_in_required: 'Войдите в систему, чтобы завершить первичную настройку.',
			setup_eyebrow: 'Настройка профиля',
			setup_title: 'Направления, класс и цели сезона',
			directions_required: 'Направления (обязательно)',
			no_subjects_hint: 'В словарях пока нет предметов.',
			grade_required: 'Класс (обязательно)',
			grade_select: 'Выберите класс',
			school_optional: 'Школа (необязательно)',
			school_placeholder: 'Название школы',
			goals_required: 'Цели (обязательно)',
			goals_placeholder: 'Опишите цели сезона и целевые результаты',
			saving: 'Сохранение...',
			complete_onboarding: 'Завершить настройку',
			refresh: 'Обновить',
			loading_profile: 'Загрузка данных профиля...',
			error_only_students: 'Первичная настройка доступна только для учеников.',
			error_sign_in_first: 'Сначала выполните вход.',
			error_pick_direction: 'Выберите хотя бы одно направление.',
			error_goals_required: 'Поле целей обязательно.',
			error_grade_invalid: 'Класс должен быть целым числом от 1 до 12.',
			info_saved: 'Первичная настройка завершена и сохранена на сервере.',
			recommendations_loading: 'Формируем персональные рекомендации олимпиад...',
			recommendations_title: 'Рекомендованные олимпиады под ваш профиль',
			recommendations_subtitle:
				'Мы объединили кандидатов из базы OlymRoad и свежий веб-поиск с AI-анализом соответствия целям.',
			recommendations_db_title: 'Из базы OlymRoad',
			recommendations_db_empty:
				'Прямые совпадения в базе пока не найдены. Попробуйте расширить направления.',
			recommendations_ai_title: 'Подборка из веба + AI',
			recommendations_ai_empty:
				'AI-подборка сейчас недоступна. Данные первичной настройки всё равно сохранены.',
			recommendation_deadline: 'Ближайший дедлайн',
			recommendation_fit_score: 'Оценка соответствия',
			recommendation_source: 'Источник',
			recommendation_plan: 'План на 30 дней',
			recommendations_warning_prefix: 'Примечание'
		},
		kz: {
			meta_title: 'Бастапқы баптау | OlymRoad',
			meta_description: 'Оқушы бағытын, сыныбын және маусым мақсаттарын баптау.',
			hero_eyebrow: 'Бастапқы баптау',
			hero_title: 'Олимпиада профилін бір қадамда жасаңыз',
			hero_subtitle:
				'Бағыттар, мақсаттар және сыныпты орнатыңыз. Осыдан кейін жол картасы мен дайындық жоспарлары сізге бейімделеді.',
			sign_in_required: 'Бастапқы баптауды аяқтау үшін жүйеге кіріңіз.',
			setup_eyebrow: 'Профиль баптауы',
			setup_title: 'Бағыттар, сынып және маусым мақсаттары',
			directions_required: 'Бағыттар (міндетті)',
			no_subjects_hint: 'Анықтамалықтарда пәндер әлі жоқ.',
			grade_required: 'Сынып (міндетті)',
			grade_select: 'Сыныпты таңдаңыз',
			school_optional: 'Мектеп (міндетті емес)',
			school_placeholder: 'Мектеп атауы',
			goals_required: 'Мақсаттар (міндетті)',
			goals_placeholder: 'Маусым мақсаты мен күтілетін нәтижелерді жазыңыз',
			saving: 'Сақталуда...',
			complete_onboarding: 'Баптауды аяқтау',
			refresh: 'Жаңарту',
			loading_profile: 'Профиль деректері жүктелуде...',
			error_only_students: 'Бұл баптауды тек оқушы аккаунты орындай алады.',
			error_sign_in_first: 'Алдымен жүйеге кіріңіз.',
			error_pick_direction: 'Кемінде бір бағыт таңдаңыз.',
			error_goals_required: 'Мақсат мәтіні міндетті.',
			error_grade_invalid: 'Сынып 1 мен 12 аралығындағы бүтін сан болуы керек.',
			info_saved: 'Бастапқы баптау аяқталып, серверге сақталды.',
			recommendations_loading: 'Сізге лайық олимпиада ұсыныстары дайындалуда...',
			recommendations_title: 'Профиліңізге сай ұсынылатын олимпиадалар',
			recommendations_subtitle:
				'Біз OlymRoad базасындағы нұсқаларды және вебтен алынған жаңа деректерді AI арқылы сәйкестендірдік.',
			recommendations_db_title: 'OlymRoad дерекқорынан',
			recommendations_db_empty:
				'Дерекқордан тікелей сәйкес келетін нұсқалар табылмады. Бағыттарды кеңейтіп көріңіз.',
			recommendations_ai_title: 'Веб + AI іріктемесі',
			recommendations_ai_empty:
				'AI іріктемесі қазір қолжетімсіз. Бастапқы баптау деректері бәрібір сақталды.',
			recommendation_deadline: 'Ең жақын мерзім',
			recommendation_fit_score: 'Сәйкестік ұпайы',
			recommendation_source: 'Дереккөз',
			recommendation_plan: '30 күндік әрекет жоспары',
			recommendations_warning_prefix: 'Ескерту'
		}
	};

	const gradeOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

	let loading = false;
	let saving = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;

	let availableDirections: string[] = [];
	let selectedDirections: string[] = [];
	let grade = '';
	let school = '';
	let goalsText = '';
	let recommendations: OnboardingRecommendationsResponse | null = null;
	let recommendationsLoading = false;
	let recommendationsError: string | null = null;

	let activeToken: string | null = null;

	const copy = (): UiCopy => COPY[resolveLocale()];

	const normalizeName = (entry: DictionaryEntry): string => dictionaryLabel(entry);

	const resetOnboardingDraft = () => {
		availableDirections = [];
		selectedDirections = [];
		goalsText = '';
		grade = '';
		school = '';
		recommendations = null;
		recommendationsLoading = false;
		recommendationsError = null;
	};

	const loadOnboardingData = async (token: string) => {
		loading = true;
		errorMessage = null;
		infoMessage = null;
		recommendations = null;
		recommendationsError = null;
		recommendationsLoading = false;

		try {
			const [dictionaries, me] = await Promise.all([api.getDictionaries(), api.getMe(token)]);

			if (me.user.role !== 'student') {
				errorMessage = copy().error_only_students;
				availableDirections = [];
				selectedDirections = [];
				return;
			}

			availableDirections = dictionaries.subjects
				.map((subject) => normalizeName(subject).trim())
				.filter((name) => name.length > 0);

			school = me.user.school ?? '';
			grade = me.user.grade !== null ? String(me.user.grade) : '';

			if (me.profile && Array.isArray(me.profile.directions_json)) {
				selectedDirections = me.profile.directions_json.filter(
					(entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
				);
			} else {
				selectedDirections = [];
			}

			if (me.profile && typeof me.profile.goals_text === 'string') {
				goalsText = me.profile.goals_text;
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			loading = false;
		}
	};

	const parseGrade = (raw: string): number | null => {
		const trimmed = raw.trim();
		if (!trimmed) {
			return null;
		}
		const value = Number(trimmed);
		if (!Number.isInteger(value)) {
			return null;
		}
		if (value < 1 || value > 12) {
			return null;
		}
		return value;
	};

	const submitOnboarding = async (event: SubmitEvent) => {
		event.preventDefault();

		const token = $session.token;
		if (!token || !$session.user) {
			errorMessage = copy().error_sign_in_first;
			return;
		}

		const normalizedDirections = selectedDirections
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
		const normalizedGoals = goalsText.trim();
		const parsedGrade = parseGrade(grade);

		if (normalizedDirections.length === 0) {
			errorMessage = copy().error_pick_direction;
			return;
		}
		if (!normalizedGoals) {
			errorMessage = copy().error_goals_required;
			return;
		}
		if (parsedGrade === null) {
			errorMessage = copy().error_grade_invalid;
			return;
		}
		const onboardingPayload = {
			directions: normalizedDirections,
			goals_text: normalizedGoals,
			grade: parsedGrade
		};

		saving = true;
		errorMessage = null;
		infoMessage = null;
		recommendationsError = null;
		recommendations = null;

		try {
			await api.updateMe(token, {
				school: school.trim().length > 0 ? school.trim() : null,
				grade: parsedGrade,
				directions: normalizedDirections,
				goals_text: normalizedGoals
			});

			await api.completeOnboarding(token, onboardingPayload);

			await session.refresh();
			recommendationsLoading = true;
			try {
				recommendations = await api.getOnboardingRecommendations(token, onboardingPayload);
			} catch (recommendationsFailure) {
				recommendationsError = getErrorMessage(recommendationsFailure);
			} finally {
				recommendationsLoading = false;
			}
			infoMessage = copy().info_saved;
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			saving = false;
		}
	};

	onMount(() => {
		void session.bootstrap();
	});

	$: if ($session.initialized) {
		const token = $session.token;
		if (!token) {
			activeToken = null;
			loading = false;
			resetOnboardingDraft();
		} else if (token !== activeToken) {
			activeToken = token;
			void loadOnboardingData(token);
		}
	}
</script>

<svelte:head>
	<title>{copy().meta_title}</title>
	<meta name="description" content={copy().meta_description} />
</svelte:head>

<section class="onboarding-shell">
	<section class="page-panel page-hero onboarding-hero">
		<p class="page-eyebrow">{copy().hero_eyebrow}</p>
		<h1 class="page-title">{copy().hero_title}</h1>
		<p class="page-subtitle">{copy().hero_subtitle}</p>
	</section>

	{#if !$session.initialized}
		<section class="page-panel onboarding-card">
			<p class="hint">{copy().loading_profile}</p>
		</section>
	{:else if !$session.user}
		<section class="page-panel onboarding-card">
			<p class="page-subtitle">{copy().sign_in_required}</p>
		</section>
	{:else}
		<section class="page-panel onboarding-card">
			<header class="section-heading">
				<p>{copy().setup_eyebrow}</p>
				<h2>{copy().setup_title}</h2>
			</header>

			<form class="form-grid" on:submit={submitOnboarding}>
				<fieldset class="wide direction-fieldset">
					<legend>{copy().directions_required}</legend>
					<div class="checkbox-grid">
						{#if availableDirections.length === 0}
							<p class="hint">{copy().no_subjects_hint}</p>
						{:else}
							{#each availableDirections as direction (direction)}
								<label class="check-item" data-selected={selectedDirections.includes(direction)}>
									<input
										class="check-item-input"
										type="checkbox"
										value={direction}
										bind:group={selectedDirections}
									/>
									<span class="check-item-label">{direction}</span>
								</label>
							{/each}
						{/if}
					</div>
				</fieldset>

				<label>
					<span>{copy().grade_required}</span>
					<select bind:value={grade}>
						<option value="">{copy().grade_select}</option>
						{#each gradeOptions as item (item)}
							<option value={item}>{item}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>{copy().school_optional}</span>
					<input bind:value={school} placeholder={copy().school_placeholder} />
				</label>

				<label class="wide">
					<span>{copy().goals_required}</span>
					<textarea bind:value={goalsText} rows="5" placeholder={copy().goals_placeholder}></textarea>
				</label>

				<div class="hero-actions actions-row wide">
					<button class="btn-primary" type="submit" disabled={saving || loading}>
						{#if saving}
							{copy().saving}
						{:else}
							{copy().complete_onboarding}
						{/if}
					</button>
					<button
						class="btn-secondary"
						type="button"
						on:click={() => activeToken && void loadOnboardingData(activeToken)}
						disabled={saving || loading}
					>
						{copy().refresh}
					</button>
				</div>
			</form>

			<div class="status-stack">
				{#if loading}
					<p class="hint">{copy().loading_profile}</p>
				{/if}
				{#if errorMessage}
					<p class="error-banner">{errorMessage}</p>
				{/if}
				{#if recommendationsError}
					<p class="error-banner">{recommendationsError}</p>
				{/if}
				{#if infoMessage}
					<p class="info-banner">{infoMessage}</p>
				{/if}
			</div>

			{#if recommendationsLoading}
				<p class="hint">{copy().recommendations_loading}</p>
			{/if}

			{#if recommendations}
				<section class="recommendations-panel">
					<header class="recommendations-head">
						<h3>{copy().recommendations_title}</h3>
						<p>{copy().recommendations_subtitle}</p>
					</header>
					<div class="recommendations-columns">
						<section class="recommendation-block">
							<h4>{copy().recommendations_db_title}</h4>
							{#if recommendations.db_recommendations.length === 0}
								<p class="hint">{copy().recommendations_db_empty}</p>
							{:else}
								<ul class="recommendation-list">
									{#each recommendations.db_recommendations as item (item.id)}
										<li class="recommendation-item">
											<p class="recommendation-title">{item.title}</p>
											<p class="recommendation-meta">
												{item.subject_label} · {item.level_label} · {item.season}
											</p>
											{#if item.next_deadline}
												<p class="recommendation-meta">
													{copy().recommendation_deadline}: {item.next_deadline}
												</p>
											{/if}
											{#if item.rules_url}
												<a
													class="recommendation-link"
													href={item.rules_url}
													target="_blank"
													rel="noreferrer"
													>{copy().recommendation_source}</a
												>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</section>

						<section class="recommendation-block">
							<h4>{copy().recommendations_ai_title}</h4>
							{#if recommendations.ai_recommendations}
								<p class="recommendation-summary">{recommendations.ai_recommendations.summary}</p>

								{#if recommendations.ai_recommendations.goal_alignment.length > 0}
									<ul class="recommendation-points">
										{#each recommendations.ai_recommendations.goal_alignment as point (point)}
											<li>{point}</li>
										{/each}
									</ul>
								{/if}

								{#if recommendations.ai_recommendations.web_picks.length > 0}
									<ul class="recommendation-list">
										{#each recommendations.ai_recommendations.web_picks as item (item.title + item.source_url)}
											<li class="recommendation-item">
												<p class="recommendation-title">{item.title}</p>
												{#if item.organizer}
													<p class="recommendation-meta">{item.organizer}</p>
												{/if}
												<p class="recommendation-meta">
													{copy().recommendation_fit_score}: {item.fit_score}
												</p>
												<p class="recommendation-meta">{item.why_fit}</p>
												{#if item.expected_deadline}
													<p class="recommendation-meta">
														{copy().recommendation_deadline}: {item.expected_deadline}
													</p>
												{/if}
												{#if item.source_url}
													<a
														class="recommendation-link"
														href={item.source_url}
														target="_blank"
														rel="noreferrer"
													>
														{copy().recommendation_source}
														{#if item.source_name}
															: {item.source_name}
														{/if}
													</a>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}

								{#if recommendations.ai_recommendations.plan_30_days.length > 0}
									<p class="recommendation-subhead">{copy().recommendation_plan}</p>
									<ol class="recommendation-plan">
										{#each recommendations.ai_recommendations.plan_30_days as step (step)}
											<li>{step}</li>
										{/each}
									</ol>
								{/if}
							{:else}
								<p class="hint">{copy().recommendations_ai_empty}</p>
							{/if}
						</section>
					</div>
					{#if recommendations.warnings.length > 0}
						<div class="recommendation-warnings">
							{#each recommendations.warnings as warning (warning)}
								<p>{copy().recommendations_warning_prefix}: {warning}</p>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</section>
	{/if}
</section>

<style>
	.onboarding-shell {
		width: min(1100px, 100%);
		margin: 0 auto;
		padding: clamp(0.5rem, 2vw, 1.25rem);
		display: grid;
		gap: clamp(0.85rem, 2.2vw, 1.35rem);
		align-items: start;
	}

	.onboarding-hero {
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(circle at 15% 15%, rgba(20, 184, 166, 0.16), transparent 52%),
			radial-gradient(circle at 85% 0%, rgba(59, 130, 246, 0.15), transparent 44%),
			linear-gradient(145deg, #f8fbff, #eef4ff 55%, #ffffff);
		border: 1px solid rgba(15, 23, 42, 0.1);
	}

	.onboarding-hero::after {
		content: '';
		position: absolute;
		inset: auto -1.6rem -1.6rem auto;
		width: clamp(110px, 20vw, 190px);
		aspect-ratio: 1;
		border-radius: 999px;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(59, 130, 246, 0.12));
		filter: blur(1px);
		pointer-events: none;
	}

	.onboarding-card {
		border: 1px solid rgba(15, 23, 42, 0.1);
		background: linear-gradient(180deg, #ffffff, #fbfdff);
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
	}

	.section-heading {
		margin-bottom: 0.9rem;
	}

	.section-heading p {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ol-primary);
	}

	.section-heading h2 {
		margin: 0.35rem 0 0;
		font-size: clamp(1.2rem, 1rem + 0.8vw, 1.6rem);
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.form-grid label {
		display: grid;
		gap: 0.4rem;
		min-width: 0;
	}

	.form-grid fieldset {
		display: grid;
		gap: 0.4rem;
		min-width: 0;
		border: 0;
		padding: 0;
		margin: 0;
	}

	.form-grid legend {
		padding: 0;
	}

	.form-grid span {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--ol-primary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.form-grid legend {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--ol-primary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.form-grid input:not([type='checkbox']),
	.form-grid select,
	.form-grid textarea {
		width: 100%;
		border: 1px solid var(--ol-border);
		border-radius: 0.7rem;
		padding: 0.62rem 0.72rem;
		font: inherit;
		color: var(--ol-ink);
		background: #fff;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	.form-grid input:not([type='checkbox']):focus-visible,
	.form-grid select:focus-visible,
	.form-grid textarea:focus-visible {
		outline: none;
		border-color: rgba(59, 130, 246, 0.6);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
	}

	.form-grid textarea {
		min-height: 8.2rem;
		resize: vertical;
	}

	.wide {
		grid-column: 1 / -1;
	}

	.checkbox-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.check-item {
		display: inline-flex !important;
		flex: 0 0 auto;
		width: auto;
		max-width: 100%;
		align-items: center;
		gap: 0.5rem;
		padding: 0.42rem 0.64rem;
		border: 1px solid var(--ol-border);
		border-radius: 999px;
		background: #fff;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			border-color 150ms ease,
			background-color 150ms ease,
			box-shadow 150ms ease,
			transform 150ms ease;
	}

	.check-item:hover,
	.check-item:focus-within {
		border-color: rgba(59, 130, 246, 0.52);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
		transform: translateY(-1px);
	}

	.check-item[data-selected='true'] {
		border-color: rgba(37, 99, 235, 0.58);
		background: linear-gradient(180deg, rgba(239, 246, 255, 0.92), rgba(255, 255, 255, 0.96));
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.13);
	}

	.form-grid .check-item-input {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		padding: 0;
		accent-color: #2563eb;
		flex: 0 0 1.05rem;
	}

	.check-item-label {
		font-size: 0.84rem;
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
		color: var(--ol-ink);
		line-height: 1.2;
		white-space: nowrap;
	}

	.hint {
		margin: 0;
		color: var(--ol-ink-soft);
	}

	.actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		justify-content: center;
	}

	.actions-row button {
		flex: 0 0 auto;
		min-width: 10rem;
	}

	.status-stack {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.95rem;
	}

	.status-stack > p {
		margin: 0;
	}

	.recommendations-panel {
		margin-top: 1rem;
		padding-top: 0.95rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
		display: grid;
		gap: 0.8rem;
	}

	.recommendations-head h3 {
		margin: 0;
		font-size: 1rem;
	}

	.recommendations-head p {
		margin: 0.28rem 0 0;
		color: var(--ol-ink-soft);
		font-size: 0.88rem;
		line-height: 1.35;
	}

	.recommendations-columns {
		display: grid;
		gap: 0.72rem;
	}

	.recommendation-block {
		border: 1px solid var(--ol-border);
		border-radius: 0.8rem;
		padding: 0.72rem;
		background: linear-gradient(180deg, #ffffff, #fbfdff);
		display: grid;
		gap: 0.6rem;
	}

	.recommendation-block h4 {
		margin: 0;
		font-size: 0.92rem;
	}

	.recommendation-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.52rem;
	}

	.recommendation-item {
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 0.72rem;
		padding: 0.56rem 0.62rem;
		background: #fff;
		display: grid;
		gap: 0.28rem;
	}

	.recommendation-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--ol-ink);
	}

	.recommendation-meta {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ol-ink-soft);
		line-height: 1.35;
	}

	.recommendation-link {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ol-primary);
		text-decoration: underline;
	}

	.recommendation-summary {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.45;
		color: var(--ol-ink);
	}

	.recommendation-points,
	.recommendation-plan {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.36rem;
		font-size: 0.84rem;
		color: var(--ol-ink);
	}

	.recommendation-subhead {
		margin: 0.2rem 0 0;
		font-size: 0.84rem;
		font-weight: 700;
		color: var(--ol-ink);
	}

	.recommendation-warnings {
		display: grid;
		gap: 0.35rem;
	}

	.recommendation-warnings p {
		margin: 0;
		font-size: 0.78rem;
		color: var(--ol-ink-soft);
	}

	@media (min-width: 980px) {
		.onboarding-shell {
			grid-template-columns: minmax(250px, 0.9fr) minmax(0, 1.25fr);
		}

		.onboarding-hero {
			position: sticky;
			top: 0.9rem;
		}
	}

	@media (max-width: 900px) {
		.form-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.checkbox-grid {
			justify-content: flex-start;
		}

		.wide {
			grid-column: auto;
		}

		.actions-row {
			flex-direction: row;
			align-items: center;
			justify-content: center;
		}

		.actions-row button {
			flex: 0 0 auto;
			min-width: 9.25rem;
		}
	}

	@media (min-width: 900px) {
		.recommendations-columns {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
