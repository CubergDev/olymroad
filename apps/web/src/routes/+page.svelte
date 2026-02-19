<script lang="ts">
	import { resolve } from '$app/paths';
	import { resolveLocale } from '$lib/i18n';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { session } from '$lib/session';

	type Metric = { value: string; label: string };
	type Feature = { icon: string; title: string; description: string };
	type Step = { number: string; title: string; description: string; subtitle: string };
	type GroupBenefit = { emoji: string; title: string; description: string };

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		hero_primary_guest: string;
		hero_primary_member: string;
		hero_secondary: string;
		metrics: Metric[];
		core_tagline: string;
		section_core_label: string;
		platform_title: string;
		platform_subtitle: string;
		platform_features: Feature[];
		section_flow_label: string;
		process_title: string;
		process_subtitle: string;
		process_steps: Step[];
		section_community_label: string;
		groups_title: string;
		groups_subtitle: string;
		group_benefits: GroupBenefit[];
		section_institution_label: string;
		school_title: string;
		school_subtitle: string;
		school_benefits: string[];
		school_primary: string;
		school_secondary: string;
		cta_title: string;
		cta_subtitle: string;
		cta_action: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'OlymRoad | Build Your Olympiad Path',
			meta_description:
				'OlymRoad is a focused platform for olympiad planning, preparation tracking, team learning, and progress analytics.',
			hero_eyebrow: 'OlymRoad Platform',
			hero_title: 'Build your olympiad journey with a clear system and measurable progress.',
			hero_subtitle:
				'Choose olympiads, track prep, learn in groups, and see exactly what to improve next without scattered tools.',
			hero_primary_guest: 'Start with a plan',
			hero_primary_member: 'Open workspace',
			hero_secondary: 'Complete initial setup',
			metrics: [
				{ value: '1 platform', label: 'for planning, practice, and outcomes' },
				{ value: '4 steps', label: 'from season goal to result review' },
				{ value: '3 roles', label: 'student, teacher, and admin views' }
			],
			core_tagline: 'Plan. Practice. Results.',
			section_core_label: 'Core Platform',
			platform_title: 'What Is OlymRoad',
			platform_subtitle: 'Core capabilities required for consistent olympiad preparation.',
			platform_features: [
				{
					icon: 'Calendar',
					title: 'Stage calendar and deadlines',
					description: 'All olympiad stages and registration windows in one timeline.'
				},
				{
					icon: 'Plan',
					title: 'Personal study plan',
					description: 'Build a subject-focused seasonal plan with deadline control.'
				},
				{
					icon: 'Tracker',
					title: 'Prep tracker',
					description: 'Log theory, problems, and mock exams in a structured flow.'
				},
				{
					icon: 'Analytics',
					title: 'Progress analytics',
					description: 'See score trends, activity quality, and weak topic zones.'
				},
				{
					icon: 'Groups',
					title: 'Teacher collaboration',
					description: 'Coordinate group prep, feedback, and assigned plans.'
				}
			],
			section_flow_label: 'Flow',
			process_title: 'How It Works',
			process_subtitle: 'A practical flow inspired by the Figma landing template.',
			process_steps: [
				{
					number: '1',
					title: 'Choose direction',
					description: 'Set subject focus and season objective.',
					subtitle: 'OlymRoad shows suitable olympiads and stages.'
				},
				{
					number: '2',
					title: 'Build your plan',
					description: 'Review stage cards with dates and deadlines.',
					subtitle: 'Mark target olympiads and keep registration under control.'
				},
				{
					number: '3',
					title: 'Train by system',
					description: 'Track sessions, solved sets, and mock exams.',
					subtitle: 'Every preparation activity stays measurable.'
				},
				{
					number: '4',
					title: 'Adjust by analytics',
					description: 'Review scores, trends, and bottlenecks.',
					subtitle: 'Update plan weekly and stay aligned with your goal.'
				}
			],
			section_community_label: 'Community',
			groups_title: 'Prepare Together',
			groups_subtitle: 'After joining olympiads, collaboration tools open right away.',
			group_benefits: [
				{
					emoji: '🤝',
					title: 'Join prep groups',
					description: 'Study with peers focused on the same olympiad track.'
				},
				{
					emoji: '👨‍🏫',
					title: 'Work with teachers',
					description: 'Get structured guidance from mentors and instructors.'
				},
				{
					emoji: '💬',
					title: 'Discuss and iterate',
					description: 'Exchange solutions, feedback, and improvement tactics.'
				},
				{
					emoji: '📝',
					title: 'Receive assignments',
					description: 'Keep regular home tasks and check progress continuity.'
				}
			],
			section_institution_label: 'Institution',
			school_title: 'Built For Schools And Teachers',
			school_subtitle: 'Institution-level control without losing student-level detail.',
			school_benefits: [
				'Track student participation across olympiads and stages',
				'Monitor preparation activity and weekly intensity',
				'Manage groups and task assignment with clarity',
				'Review outcomes and improve training decisions'
			],
			school_primary: 'Open teacher workspace',
			school_secondary: 'Open analytics',
			cta_title: 'Start your olympiad journey with OlymRoad today',
			cta_subtitle: 'Access a focused platform to plan, train, and improve results continuously.',
			cta_action: 'Start now'
		},
		ru: {
			meta_title: 'OlymRoad | Построй свой олимпиадный путь',
			meta_description:
				'OlymRoad — платформа для планирования подготовки, командной работы и аналитики прогресса.',
			hero_eyebrow: 'Платформа OlymRoad',
			hero_title: 'Построй свой олимпиадный путь через систему и измеримый прогресс.',
			hero_subtitle:
				'Выбирай олимпиады, веди подготовку, учись в группах и точно понимай, что улучшать дальше.',
			hero_primary_guest: 'Начать с плана',
			hero_primary_member: 'Открыть рабочее пространство',
			hero_secondary: 'Пройти первичную настройку',
			metrics: [
				{ value: '1 платформа', label: 'для плана, подготовки и результата' },
				{ value: '4 шага', label: 'от цели сезона до разбора результата' },
				{ value: '3 роли', label: 'сценарии ученика, учителя и админа' }
			],
			core_tagline: 'План. Подготовка. Результат.',
			section_core_label: 'Платформа',
			platform_title: 'Что Такое OlymRoad',
			platform_subtitle: 'Ключевые инструменты для стабильной олимпиадной подготовки.',
			platform_features: [
				{
					icon: 'Календарь',
					title: 'Календарь этапов и дедлайнов',
					description: 'Все этапы и окна регистрации в одной временной шкале.'
				},
				{
					icon: 'План',
					title: 'Личный план подготовки',
					description: 'Планируй сезон по предмету и контролируй критичные сроки.'
				},
				{
					icon: 'Трекер',
					title: 'Трекер подготовки',
					description: 'Фиксируй теорию, задачи и пробники в едином процессе.'
				},
				{
					icon: 'Аналитика',
					title: 'Аналитика прогресса',
					description: 'Смотри тренды баллов, активность и слабые темы.'
				},
				{
					icon: 'Группы',
					title: 'Работа с учителем',
					description: 'Веди подготовку в группах с комментариями и планами.'
				}
			],
			section_flow_label: 'Как это устроено',
			process_title: 'Как Это Работает',
			process_subtitle: 'Практичная последовательность, основанная на шаблоне лендинга из Figma.',
			process_steps: [
				{
					number: '1',
					title: 'Выбери направление',
					description: 'Определи предметный фокус и цель сезона.',
					subtitle: 'OlymRoad покажет подходящие олимпиады и этапы.'
				},
				{
					number: '2',
					title: 'Соберите план',
					description: 'Изучи карточки этапов с датами и дедлайнами.',
					subtitle: 'Отметь целевые олимпиады и держи регистрацию под контролем.'
				},
				{
					number: '3',
					title: 'Готовься по системе',
					description: 'Веди занятия, задачи и пробные экзамены.',
					subtitle: 'Каждая активность остается измеримой.'
				},
				{
					number: '4',
					title: 'Корректируй по аналитике',
					description: 'Отслеживай баллы, тренды и узкие места.',
					subtitle: 'Обновляй план каждую неделю и держи курс к цели.'
				}
			],
			section_community_label: 'Сообщество',
			groups_title: 'Готовься Вместе',
			groups_subtitle: 'После записи на олимпиады сразу открываются инструменты командной работы.',
			group_benefits: [
				{
					emoji: '🤝',
					title: 'Вступай в группы',
					description: 'Учись с ребятами, которые идут по схожему треку.'
				},
				{
					emoji: '👨‍🏫',
					title: 'Работай с учителем',
					description: 'Получай структурированную поддержку от наставников.'
				},
				{
					emoji: '💬',
					title: 'Обсуждай и улучшай',
					description: 'Обменивайся решениями, комментариями и тактиками.'
				},
				{
					emoji: '📝',
					title: 'Получай задания',
					description: 'Держи регулярную практику и непрерывность подготовки.'
				}
			],
			section_institution_label: 'Для школ',
			school_title: 'Для Школ И Преподавателей',
			school_subtitle: 'Управление на уровне школы без потери детализации по каждому ученику.',
			school_benefits: [
				'Отслеживание участия учеников по олимпиадам и этапам',
				'Контроль подготовки и недельной интенсивности',
				'Прозрачное управление группами и назначениями',
				'Анализ результатов для улучшения учебных решений'
			],
			school_primary: 'Открыть кабинет учителя',
			school_secondary: 'Открыть аналитику',
			cta_title: 'Начни олимпиадный путь с OlymRoad уже сегодня',
			cta_subtitle:
				'Используй единую платформу для планирования, подготовки и постоянного улучшения результатов.',
			cta_action: 'Начать'
		},
		kz: {
			meta_title: 'OlymRoad | Олимпиада жолыңды құр',
			meta_description:
				'OlymRoad — олимпиада дайындығын жоспарлау, топпен оқу және прогресті талдау платформасы.',
			hero_eyebrow: 'OlymRoad платформасы',
			hero_title: 'Олимпиада жолыңды жүйе және өлшенетін прогресс арқылы құр.',
			hero_subtitle:
				'Олимпиадаларды таңда, дайындықты жүргіз, топпен оқы және келесі жақсарту нүктесін дәл көр.',
			hero_primary_guest: 'Жоспардан бастау',
			hero_primary_member: 'Жұмыс кеңістігін ашу',
			hero_secondary: 'Бастапқы баптауды бастау',
			metrics: [
				{ value: '1 платформа', label: 'жоспар, дайындық және нәтиже үшін' },
				{ value: '4 қадам', label: 'маусым мақсаты мен нәтиже талдауына дейін' },
				{ value: '3 рөл', label: 'оқушы, мұғалім және әкімші сценарийлері' }
			],
			core_tagline: 'Жоспар. Дайындық. Нәтиже.',
			section_core_label: 'Негізгі мүмкіндіктер',
			platform_title: 'OlymRoad Деген Не',
			platform_subtitle: 'Тұрақты олимпиадалық дайындыққа қажет негізгі құралдар.',
			platform_features: [
				{
					icon: 'Күнтізбе',
					title: 'Кезеңдер мен дедлайндар күнтізбесі',
					description: 'Кезеңдер мен тіркелу терезелері бір уақыт сызығында.'
				},
				{
					icon: 'Жоспар',
					title: 'Жеке дайындық жоспары',
					description: 'Пән бойынша маусымдық жоспар құрып, маңызды мерзімдерді басқар.'
				},
				{
					icon: 'Трекер',
					title: 'Дайындық трекері',
					description: 'Теория, есеп және сынақ емтихандарын бір процесте тірке.'
				},
				{
					icon: 'Аналитика',
					title: 'Прогресс аналитикасы',
					description: 'Ұпай трендтерін, белсенділікті және әлсіз тақырыптарды көр.'
				},
				{
					icon: 'Топтар',
					title: 'Мұғаліммен жұмыс',
					description: 'Топтарда пікірлер мен жоспарлар арқылы жүйелі дайындал.'
				}
			],
			section_flow_label: 'Қалай жүреді',
			process_title: 'Қалай Жұмыс Істейді',
			process_subtitle: 'Figma-дағы лендинг шаблонына сүйенген практикалық тізбек.',
			process_steps: [
				{
					number: '1',
					title: 'Бағытты таңда',
					description: 'Пән фокусын және маусым мақсатын анықта.',
					subtitle: 'OlymRoad лайық олимпиадалар мен кезеңдерді ұсынады.'
				},
				{
					number: '2',
					title: 'Жоспар құр',
					description: 'Кезең карталарын даталар мен дедлайнмен қара.',
					subtitle: 'Мақсат олимпиадаларды белгілеп, тіркеуді бақылауда ұста.'
				},
				{
					number: '3',
					title: 'Жүйемен дайындал',
					description: 'Сабақтарды, есептерді және сынақтарды тірке.',
					subtitle: 'Әр дайындық әрекеті өлшенетін болады.'
				},
				{
					number: '4',
					title: 'Аналитикамен түзет',
					description: 'Ұпайды, трендтерді және тар жерлерді бақыла.',
					subtitle: 'Апта сайын жоспарды жаңартып, мақсатқа жақында.'
				}
			],
			section_community_label: 'Қауымдастық',
			groups_title: 'Бірге Дайындал',
			groups_subtitle: 'Олимпиадаға тіркелгеннен кейін командалық құралдар бірден ашылады.',
			group_benefits: [
				{
					emoji: '🤝',
					title: 'Топтарға қосыл',
					description: 'Ұқсас трекпен жүрген оқушылармен бірге оқы.'
				},
				{
					emoji: '👨‍🏫',
					title: 'Мұғаліммен жұмыс істе',
					description: 'Тәлімгерлерден құрылымды қолдау ал.'
				},
				{
					emoji: '💬',
					title: 'Талқыла және жақсарт',
					description: 'Шешімдер, пікірлер және тактикалармен алмас.'
				},
				{
					emoji: '📝',
					title: 'Тапсырмалар ал',
					description: 'Тұрақты практиканы сақтап, дайындықты үзбе.'
				}
			],
			section_institution_label: 'Мектептер үшін',
			school_title: 'Мектептер Және Мұғалімдер Үшін',
			school_subtitle:
				'Мектеп деңгейіндегі басқару және әр оқушы бойынша нақты детализация бір жерде.',
			school_benefits: [
				'Оқушылардың олимпиада мен кезеңдерге қатысуын бақылау',
				'Дайындық белсенділігі мен апталық қарқынды қадағалау',
				'Топтар мен тапсырмаларды айқын басқару',
				'Оқу шешімдерін жақсарту үшін нәтижені талдау'
			],
			school_primary: 'Мұғалім кабинетіне өту',
			school_secondary: 'Аналитиканы ашу',
			cta_title: 'OlymRoad-пен олимпиада жолыңды бүгін баста',
			cta_subtitle:
				'Жоспарлау, дайындық және нәтижені тұрақты жақсарту үшін бір платформаны қолдан.',
			cta_action: 'Бастау'
		}
	};

	const copy = (): UiCopy => COPY[resolveLocale()];

	const loginRedirectPath = (path: string): string =>
		`/login?redirect_to=${encodeURIComponent(path)}`;

	const authAwarePath = (path: string): string => ($session.user ? path : loginRedirectPath(path));
	type RoleEntryPath = '/' | '/onboarding' | '/teacher' | '/admin' | '/profile';

	const primaryCtaPath = (): string => {
		const role = $session.user?.role;
		if (role === 'teacher') {
			return '/teacher';
		}
		if (role === 'admin') {
			return '/admin';
		}
		if (role === 'student') {
			return '/onboarding';
		}
		return loginRedirectPath('/onboarding');
	};

	const primaryCtaLabel = (): string =>
		$session.user ? copy().hero_primary_member : copy().hero_primary_guest;

	const secondaryCtaPath = (): string => {
		const role = $session.user?.role;
		if (role === 'teacher' || role === 'admin') {
			return authAwarePath('/profile');
		}
		return authAwarePath('/onboarding');
	};

	const secondaryCtaLabel = (): string => {
		const locale = resolveLocale();
		const role = $session.user?.role;

		if (role === 'teacher' || role === 'admin') {
			if (locale === 'ru') {
				return 'Открыть профильные настройки';
			}
			if (locale === 'kz') {
				return 'Профиль баптауларын ашу';
			}
			return 'Open profile settings';
		}

		return copy().hero_secondary;
	};

	const roleEntryTitle = (): string => {
		const locale = resolveLocale();
		const role = $session.user?.role;

		if (role === 'teacher') {
			if (locale === 'ru') {
				return 'Режим учителя: управление группами и планами';
			}
			if (locale === 'kz') {
				return 'Мұғалім режимі: топтар мен жоспарларды басқару';
			}
			return 'Teacher mode: manage groups and assigned plans';
		}
		if (role === 'admin') {
			if (locale === 'ru') {
				return 'Режим администратора: управление олимпиадами и доступами';
			}
			if (locale === 'kz') {
				return 'Әкімші режимі: олимпиада мен қолжетімділікті басқару';
			}
			return 'Admin mode: manage olympiads, stages, and access';
		}
		if (role === 'student') {
			if (locale === 'ru') {
				return 'Режим ученика: персональная траектория подготовки';
			}
			if (locale === 'kz') {
				return 'Оқушы режимі: жеке дайындық траекториясы';
			}
			return 'Student mode: personal preparation trajectory';
		}

		if (locale === 'ru') {
			return 'Гостевой режим: войдите и получите персональный сценарий';
		}
		if (locale === 'kz') {
			return 'Қонақ режимі: кіріп, жеке сценарийді ашыңыз';
		}
		return 'Guest mode: sign in to get a role-specific flow';
	};

	const roleEntryActionPath = (): RoleEntryPath => {
		const role = $session.user?.role;
		if (role === 'teacher') {
			return '/teacher';
		}
		if (role === 'admin') {
			return '/admin';
		}
		if (role === 'student') {
			return '/onboarding';
		}
		return '/';
	};

	const roleEntryActionLabel = (): string => {
		const locale = resolveLocale();
		const role = $session.user?.role;

		if (role === 'teacher') {
			if (locale === 'ru') {
				return 'Перейти в кабинет учителя';
			}
			if (locale === 'kz') {
				return 'Мұғалім панеліне өту';
			}
			return 'Go to teacher workspace';
		}
		if (role === 'admin') {
			if (locale === 'ru') {
				return 'Перейти в кабинет администратора';
			}
			if (locale === 'kz') {
				return 'Әкімші панеліне өту';
			}
			return 'Go to admin workspace';
		}
		if (role === 'student') {
			if (locale === 'ru') {
				return 'Завершить первичную настройку';
			}
			if (locale === 'kz') {
				return 'Бастапқы баптауды аяқтау';
			}
			return 'Complete initial setup';
		}
		return copy().cta_action;
	};
</script>

<svelte:head>
	<title>{copy().meta_title}</title>
	<meta name="description" content={copy().meta_description} />
</svelte:head>

<section class="page-panel landing-hero">
	<div class="hero-orb hero-orb-a"></div>
	<div class="hero-orb hero-orb-b"></div>
	<div class="hero-orb hero-orb-c"></div>

	<div class="landing-hero-grid">
		<div class="landing-hero-copy reveal" style="--delay: 0.06s;">
			<p class="page-eyebrow">{copy().hero_eyebrow}</p>
			<h1 class="landing-title">{copy().hero_title}</h1>
			<p class="page-subtitle">{copy().hero_subtitle}</p>
			<div class="hero-actions">
				<a class="btn-primary" href={resolve(localizeHref(primaryCtaPath()) as '/')}
					>{primaryCtaLabel()}</a
				>
				<a class="btn-secondary" href={resolve(localizeHref(secondaryCtaPath()) as '/')}
					>{secondaryCtaLabel()}</a
				>
			</div>
			<div class="landing-metric-row">
				{#each copy().metrics as metric (metric.label)}
					<article class="landing-metric">
						<strong>{metric.value}</strong>
						<p>{metric.label}</p>
					</article>
				{/each}
			</div>
		</div>

		<div class="landing-art reveal" style="--delay: 0.16s;">
			<div class="landing-art-shell">
				<div class="landing-ring ring-a"></div>
				<div class="landing-ring ring-b"></div>
				<div class="landing-ring ring-c"></div>
				<div class="landing-core">
					<h3>OlymRoad</h3>
					<p>{copy().core_tagline}</p>
				</div>
				<div class="landing-chip chip-a">📚</div>
				<div class="landing-chip chip-b">🏆</div>
				<div class="landing-chip chip-c">✨</div>
			</div>
		</div>
	</div>
</section>

<section class="page-panel role-entry-panel reveal" style="--delay: 0.08s;">
	<header class="section-heading">
		<p>{copy().hero_eyebrow}</p>
		<h2>{roleEntryTitle()}</h2>
	</header>
	<div class="hero-actions">
		<a class="btn-primary" href={resolve(localizeHref(roleEntryActionPath()) as RoleEntryPath)}
			>{roleEntryActionLabel()}</a
		>
		<a class="btn-secondary" href={resolve(localizeHref('/profile') as '/profile')}
			>{secondaryCtaLabel()}</a
		>
	</div>
</section>

<section id="roles" class="page-panel reveal" style="--delay: 0.12s;">
	<header class="section-heading">
		<p>{copy().section_core_label}</p>
		<h2>{copy().platform_title}</h2>
	</header>
	<p class="page-subtitle">{copy().platform_subtitle}</p>
	<div class="grid-3 landing-feature-grid">
		{#each copy().platform_features as feature, index (feature.title)}
			<article class="surface-card reveal" style={`--delay: ${0.1 + index * 0.06}s;`}>
				<div class="feature-symbol">{feature.icon}</div>
				<h3>{feature.title}</h3>
				<p>{feature.description}</p>
			</article>
		{/each}
	</div>
</section>

<section id="platforms" class="page-panel reveal" style="--delay: 0.16s;">
	<header class="section-heading">
		<p>{copy().section_flow_label}</p>
		<h2>{copy().process_title}</h2>
	</header>
	<p class="page-subtitle">{copy().process_subtitle}</p>
	<div class="grid-2 landing-step-grid">
		{#each copy().process_steps as step, index (step.title)}
			<article class="surface-card reveal" style={`--delay: ${0.08 + index * 0.06}s;`}>
				<p class="step-mark">{step.number}</p>
				<h3>{step.title}</h3>
				<p>{step.description}</p>
				<p class="step-detail">{step.subtitle}</p>
			</article>
		{/each}
	</div>
</section>

<section class="page-panel reveal" style="--delay: 0.18s;">
	<header class="section-heading">
		<p>{copy().section_community_label}</p>
		<h2>{copy().groups_title}</h2>
	</header>
	<p class="page-subtitle">{copy().groups_subtitle}</p>
	<div class="grid-2 landing-group-grid">
		{#each copy().group_benefits as benefit, index (benefit.title)}
			<article class="surface-card group-card reveal" style={`--delay: ${0.08 + index * 0.06}s;`}>
				<div class="group-emoji">{benefit.emoji}</div>
				<h3>{benefit.title}</h3>
				<p>{benefit.description}</p>
			</article>
		{/each}
	</div>
</section>

<section id="possibilities" class="page-panel school-panel reveal" style="--delay: 0.2s;">
	<header class="section-heading">
		<p>{copy().section_institution_label}</p>
		<h2>{copy().school_title}</h2>
	</header>
	<p class="page-subtitle">{copy().school_subtitle}</p>
	<div class="school-layout">
		<ul class="benefit-list">
			{#each copy().school_benefits as benefit (benefit)}
				<li>{benefit}</li>
			{/each}
		</ul>
	</div>
</section>

<section id="contacts" class="page-panel cta-band reveal" style="--delay: 0.22s;">
	<h2>{copy().cta_title}</h2>
	<p>{copy().cta_subtitle}</p>
	<div class="hero-actions">
		<a class="btn-secondary cta-action" href={resolve(localizeHref(primaryCtaPath()) as '/')}
			>{copy().cta_action}</a
		>
	</div>
</section>

<style>
	.page-panel {
		padding-inline: clamp(1rem, 2.8vw, 2rem);
	}

	.landing-hero {
		position: relative;
		overflow: hidden;
		border-color: rgba(79, 99, 221, 0.18);
		background:
			radial-gradient(circle at 10% 0%, rgba(79, 99, 221, 0.12), transparent 52%),
			radial-gradient(circle at 100% 100%, rgba(59, 71, 84, 0.08), transparent 50%), #ffffff;
	}

	.hero-orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(16px);
		pointer-events: none;
		animation: float-soft 6s ease-in-out infinite;
	}

	.hero-orb-a {
		width: 180px;
		height: 180px;
		top: -40px;
		right: 10%;
		background: rgba(79, 99, 221, 0.2);
	}

	.hero-orb-b {
		width: 140px;
		height: 140px;
		bottom: -45px;
		left: 14%;
		background: rgba(79, 99, 221, 0.16);
		animation-delay: 0.8s;
	}

	.hero-orb-c {
		width: 90px;
		height: 90px;
		top: 34%;
		left: 48%;
		background: rgba(59, 71, 84, 0.12);
		animation-delay: 1.3s;
	}

	.landing-hero-grid {
		position: relative;
		display: grid;
		gap: 1.55rem;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		align-items: center;
	}

	.landing-hero-copy {
		display: grid;
		gap: 1rem;
		align-content: start;
		min-width: 0;
	}

	.landing-title {
		margin: 0;
		font-size: clamp(2.05rem, 5.3vw, 3.7rem);
		line-height: 1.06;
		max-width: 14ch;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.page-subtitle,
	.landing-metric p,
	.step-detail,
	.benefit-list li,
	.cta-band p {
		overflow-wrap: anywhere;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		align-items: center;
	}

	.hero-actions a {
		min-height: 2.85rem;
		text-align: center;
	}

	.landing-metric-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.landing-metric {
		border: 1px solid rgba(79, 99, 221, 0.18);
		border-radius: 1rem;
		padding: 0.82rem 0.84rem;
		background: rgba(255, 255, 255, 0.86);
		min-width: 0;
	}

	.landing-metric strong {
		display: block;
		font-family: var(--ol-font-display);
		font-size: 1.05rem;
		color: var(--ol-primary);
	}

	.landing-metric p {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--ol-ink-soft);
	}

	.landing-art {
		display: flex;
		justify-content: center;
		min-width: 0;
	}

	.landing-art-shell {
		position: relative;
		width: min(100%, 320px);
		aspect-ratio: 1 / 1;
		border-radius: 2rem;
		background:
			linear-gradient(160deg, rgba(79, 99, 221, 0.16), rgba(255, 255, 255, 0.94)), #ffffff;
		border: 1px solid rgba(79, 99, 221, 0.2);
		box-shadow: 0 26px 44px rgba(36, 49, 97, 0.16);
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.landing-ring {
		position: absolute;
		border-radius: 999px;
		border: 1px solid rgba(79, 99, 221, 0.22);
		animation: pulse-ring 4s ease-in-out infinite;
	}

	.ring-a {
		width: 74%;
		height: 74%;
	}

	.ring-b {
		width: 58%;
		height: 58%;
		animation-delay: 0.8s;
	}

	.ring-c {
		width: 40%;
		height: 40%;
		animation-delay: 1.3s;
	}

	.landing-core {
		position: relative;
		z-index: 2;
		text-align: center;
		border: 1px solid rgba(79, 99, 221, 0.25);
		border-radius: 1.3rem;
		padding: 1rem 1.1rem;
		background: rgba(255, 255, 255, 0.93);
	}

	.landing-core h3 {
		margin: 0;
		font-size: clamp(1.35rem, 2.2vw, 1.7rem);
	}

	.landing-core p {
		margin: 0.3rem 0 0;
		color: var(--ol-ink-soft);
		font-size: 0.9rem;
	}

	.landing-chip {
		position: absolute;
		z-index: 3;
		font-size: 1.4rem;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(79, 99, 221, 0.24);
		box-shadow: 0 12px 24px rgba(36, 49, 97, 0.12);
		animation: float-soft 4s ease-in-out infinite;
	}

	.chip-a {
		top: 10%;
		left: 9%;
	}

	.chip-b {
		right: 8%;
		bottom: 13%;
		animation-delay: 0.9s;
	}

	.chip-c {
		right: 12%;
		top: 16%;
		animation-delay: 1.4s;
	}

	.landing-feature-grid {
		margin-top: 1.2rem;
	}

	.feature-symbol {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ol-primary);
		margin-bottom: 0.4rem;
	}

	.step-mark {
		margin: 0 0 0.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.56rem;
		border-radius: 999px;
		background: rgba(79, 99, 221, 0.12);
		color: var(--ol-primary);
		font-weight: 800;
		font-size: 0.83rem;
	}

	.step-detail {
		margin-top: 0.48rem;
		font-size: 0.86rem;
	}

	.group-card {
		position: relative;
		overflow: hidden;
	}

	.group-card::after {
		content: '';
		position: absolute;
		right: -30px;
		top: -30px;
		width: 92px;
		height: 92px;
		background: radial-gradient(circle, rgba(79, 99, 221, 0.15), transparent 70%);
		pointer-events: none;
	}

	.group-emoji {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.82rem;
		background: rgba(79, 99, 221, 0.1);
		font-size: 1.25rem;
		margin-bottom: 0.4rem;
	}

	.school-panel {
		background:
			linear-gradient(170deg, rgba(79, 99, 221, 0.07), rgba(255, 255, 255, 0.95)), #ffffff;
	}

	.school-layout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.2rem;
		align-items: start;
	}

	.page-panel + .page-panel {
		margin-top: 0.5rem;
	}

	.benefit-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.46rem;
	}

	.benefit-list li {
		padding: 0.54rem 0.62rem;
		border-radius: 0.74rem;
		background: rgba(255, 255, 255, 0.86);
		border: 1px solid rgba(79, 99, 221, 0.15);
		font-size: 0.9rem;
		color: var(--ol-ink);
	}

	.cta-band {
		text-align: center;
		background: linear-gradient(125deg, rgba(79, 99, 221, 0.92), rgba(74, 95, 210, 0.75)), #4f63dd;
		border-color: rgba(79, 99, 221, 0.38);
	}

	.cta-band h2 {
		margin: 0;
		color: #ffffff;
		font-size: clamp(1.5rem, 3.5vw, 2.55rem);
	}

	.cta-band p {
		margin: 0.52rem auto 0;
		max-width: 56ch;
		color: rgba(255, 255, 255, 0.92);
	}

	.cta-band .hero-actions {
		justify-content: center;
		margin-top: 0.6rem;
	}

	.cta-action {
		background: #ffffff;
		color: var(--ol-primary);
	}

	.role-entry-panel {
		border-color: rgba(79, 99, 221, 0.22);
		background:
			linear-gradient(160deg, rgba(79, 99, 221, 0.1), rgba(255, 255, 255, 0.94)),
			rgba(255, 255, 255, 0.98);
	}

	@keyframes pulse-ring {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.9;
		}
		50% {
			transform: scale(1.08);
			opacity: 0.45;
		}
	}

	@keyframes float-soft {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@media (min-width: 721px) {
		.landing-art-shell {
			width: min(100%, 430px);
		}
	}

	@media (max-width: 720px) {
		.landing-hero-grid {
			grid-template-columns: 1fr;
			gap: 1.15rem;
		}

		.landing-title {
			max-width: 18ch;
		}

		.landing-metric-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.62rem;
		}

		.landing-feature-grid,
		.landing-step-grid,
		.landing-group-grid,
		.school-layout {
			grid-template-columns: 1fr;
		}

		.landing-art-shell {
			width: min(100%, 290px);
			border-radius: 1.6rem;
		}

		.landing-core {
			padding: 0.85rem 0.95rem;
			border-radius: 1rem;
		}

		.landing-chip {
			width: 46px;
			height: 46px;
			font-size: 1.2rem;
		}

		.group-card::after {
			width: 80px;
			height: 80px;
		}

		.cta-band h2 {
			max-width: 16ch;
			margin-inline: auto;
		}
	}

	@media (max-width: 430px) {
		.page-panel {
			padding-inline: 0.9rem;
		}

		.landing-title {
			font-size: clamp(1.66rem, 8.6vw, 2.3rem);
			line-height: 1.1;
			max-width: 100%;
		}

		.page-subtitle {
			font-size: 0.93rem;
		}

		.hero-actions {
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.55rem;
		}

		.hero-actions a {
			width: 100%;
		}

		.landing-metric-row {
			grid-template-columns: 1fr;
		}

		.landing-metric {
			padding: 0.72rem;
			border-radius: 0.85rem;
		}

		.landing-art-shell {
			width: min(100%, 268px);
		}

		.landing-chip {
			width: 42px;
			height: 42px;
			border-radius: 0.85rem;
			font-size: 1.1rem;
		}

		.hero-orb-c {
			display: none;
		}

		.step-mark {
			min-width: 1.8rem;
			height: 1.8rem;
			font-size: 0.78rem;
		}

		.benefit-list li {
			padding: 0.5rem 0.56rem;
			font-size: 0.87rem;
		}

		.cta-band p {
			font-size: 0.9rem;
		}
	}

	@media (max-width: 360px) {
		.landing-art-shell {
			width: min(100%, 236px);
		}

		.landing-core h3 {
			font-size: 1.15rem;
		}

		.landing-core p {
			font-size: 0.82rem;
		}

		.landing-chip {
			width: 38px;
			height: 38px;
			font-size: 1rem;
		}

		.chip-c {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-orb,
		.landing-ring,
		.landing-chip {
			animation: none !important;
		}
	}
</style>
