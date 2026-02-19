<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { resolveLocale, roleLabel } from '$lib/i18n';
	import { deLocalizeUrl, locales, localizeHref, setLocale } from '$lib/paraglide/runtime';
	import { session } from '$lib/session';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	type Role = 'student' | 'teacher' | 'admin';
	type RoleHomePath = '/onboarding' | '/teacher' | '/admin';

	type UiCopy = {
		skip_to_main: string;
		nav_landing: string;
		nav_onboarding: string;
		nav_roadmap: string;
		nav_prep: string;
		nav_results: string;
		nav_analytics: string;
		nav_teacher: string;
		nav_admin: string;
		nav_notifications: string;
		nav_profile: string;
		nav_login: string;
		nav_logout: string;
		primary_navigation: string;
		locale_switcher: string;
		signed_in_as: string;
		role_focus_guest: string;
		role_focus_student: string;
		role_focus_teacher: string;
		role_focus_admin: string;
		open_role_workspace: string;
		role_redirect_notice: string;
		footer_note: string;
		footer_home: string;
		footer_roadmap: string;
		footer_updates: string;
		open_menu: string;
		close_menu: string;
		mobile_tabs: string;
		mobile_home: string;
		mobile_workspace_student: string;
		mobile_workspace_teacher: string;
		mobile_workspace_admin: string;
		mobile_updates: string;
		mobile_profile: string;
		mobile_login: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			skip_to_main: 'Skip to main content',
			nav_landing: 'Home',
			nav_onboarding: 'First setup (recommended)',
			nav_roadmap: 'Plan',
			nav_prep: 'Prep',
			nav_results: 'Results',
			nav_analytics: 'Analytics',
			nav_teacher: 'Teacher',
			nav_admin: 'Admin',
			nav_notifications: 'Notifications',
			nav_profile: 'Profile',
			nav_login: 'Login',
			nav_logout: 'Sign out',
			primary_navigation: 'Primary navigation',
			locale_switcher: 'Locale switcher',
			signed_in_as: 'Signed in as',
			role_focus_guest: 'Guest mode',
			role_focus_student: 'Student mode',
			role_focus_teacher: 'Teacher mode',
			role_focus_admin: 'Admin mode',
			open_role_workspace: 'Workspace',
			role_redirect_notice: 'Redirected to your role section.',
			footer_note: 'OlymRoad',
			footer_home: 'Home',
			footer_roadmap: 'Plan',
			footer_updates: 'Updates',
			open_menu: 'Menu',
			close_menu: 'Close',
			mobile_tabs: 'Bottom navigation',
			mobile_home: 'Home',
			mobile_workspace_student: 'Study',
			mobile_workspace_teacher: 'Classes',
			mobile_workspace_admin: 'Admin',
			mobile_updates: 'Updates',
			mobile_profile: 'Profile',
			mobile_login: 'Login'
		},
		ru: {
			skip_to_main: 'Перейти к основному содержимому',
			nav_landing: 'Главная',
			nav_onboarding: 'Первичная настройка (рекомендуется)',
			nav_roadmap: 'План',
			nav_prep: 'Подготовка',
			nav_results: 'Результаты',
			nav_analytics: 'Аналитика',
			nav_teacher: 'Учитель',
			nav_admin: 'Админ',
			nav_notifications: 'Уведомления',
			nav_profile: 'Профиль',
			nav_login: 'Войти',
			nav_logout: 'Выйти',
			primary_navigation: 'Основная навигация',
			locale_switcher: 'Переключение языка',
			signed_in_as: 'Вы вошли как',
			role_focus_guest: 'Режим гостя',
			role_focus_student: 'Режим ученика',
			role_focus_teacher: 'Режим учителя',
			role_focus_admin: 'Режим администратора',
			open_role_workspace: 'К разделу',
			role_redirect_notice: 'Перенаправлено в раздел вашей роли.',
			footer_note: 'OlymRoad',
			footer_home: 'Главная',
			footer_roadmap: 'План',
			footer_updates: 'Обновления',
			open_menu: 'Меню',
			close_menu: 'Закрыть',
			mobile_tabs: 'Нижняя навигация',
			mobile_home: 'Главная',
			mobile_workspace_student: 'Учеба',
			mobile_workspace_teacher: 'Классы',
			mobile_workspace_admin: 'Админ',
			mobile_updates: 'Обновления',
			mobile_profile: 'Профиль',
			mobile_login: 'Войти'
		},
		kz: {
			skip_to_main: 'Негізгі мазмұнға өту',
			nav_landing: 'Басты бет',
			nav_onboarding: 'Бастапқы баптау (ұсынылады)',
			nav_roadmap: 'Жоспар',
			nav_prep: 'Дайындық',
			nav_results: 'Нәтижелер',
			nav_analytics: 'Аналитика',
			nav_teacher: 'Мұғалім',
			nav_admin: 'Әкімші',
			nav_notifications: 'Хабарламалар',
			nav_profile: 'Профиль',
			nav_login: 'Кіру',
			nav_logout: 'Шығу',
			primary_navigation: 'Негізгі навигация',
			locale_switcher: 'Тіл ауыстырғыш',
			signed_in_as: 'Жүйеге кірген пайдаланушы',
			role_focus_guest: 'Қонақ режимі',
			role_focus_student: 'Оқушы режимі',
			role_focus_teacher: 'Мұғалім режимі',
			role_focus_admin: 'Әкімші режимі',
			open_role_workspace: 'Бөлімге өту',
			role_redirect_notice: 'Рөліңізге сай бөлімге бағытталды.',
			footer_note: 'OlymRoad',
			footer_home: 'Басты бет',
			footer_roadmap: 'Жоспар',
			footer_updates: 'Жаңартулар',
			open_menu: 'Мәзір',
			close_menu: 'Жабу',
			mobile_tabs: 'Төменгі навигация',
			mobile_home: 'Басты',
			mobile_workspace_student: 'Оқу',
			mobile_workspace_teacher: 'Сынып',
			mobile_workspace_admin: 'Әкімші',
			mobile_updates: 'Жаңарту',
			mobile_profile: 'Профиль',
			mobile_login: 'Кіру'
		}
	};

	type NavItem = {
		href:
			| '/'
			| '/onboarding'
			| '/roadmap'
			| '/roadmap-v2'
			| '/prep'
			| '/prep-v2'
			| '/results'
			| '/analytics'
			| '/teacher'
			| '/admin'
			| '/notifications'
			| '/profile';
		label: (copy: UiCopy) => string;
		visibility: 'public' | 'auth';
		roles?: Role[];
		recommended?: boolean;
	};

	type AppHref = NavItem['href'] | '/login';
type MobileTabIcon = 'home' | 'workspace' | 'updates' | 'profile' | 'login';
type MobileTab = { href: AppHref; label: string; icon: MobileTabIcon };

	const navItems: NavItem[] = [
		{ href: '/', label: (copy) => copy.nav_landing, visibility: 'public' },
		{
			href: '/onboarding',
			label: (copy) => copy.nav_onboarding,
			visibility: 'auth',
			roles: ['student'],
			recommended: true
		},
		{
			href: '/roadmap-v2',
			label: (copy) => copy.nav_roadmap,
			visibility: 'auth',
			roles: ['student', 'teacher']
		},
		{ href: '/prep-v2', label: (copy) => copy.nav_prep, visibility: 'auth', roles: ['student'] },
		{
			href: '/results',
			label: (copy) => copy.nav_results,
			visibility: 'auth',
			roles: ['student']
		},
		{
			href: '/analytics',
			label: (copy) => copy.nav_analytics,
			visibility: 'auth',
			roles: ['student']
		},
		{
			href: '/teacher',
			label: (copy) => copy.nav_teacher,
			visibility: 'auth',
			roles: ['teacher']
		},
		{ href: '/admin', label: (copy) => copy.nav_admin, visibility: 'auth', roles: ['admin'] },
		{
			href: '/notifications',
			label: (copy) => copy.nav_notifications,
			visibility: 'auth',
			roles: ['student', 'teacher', 'admin']
		},
		{
			href: '/profile',
			label: (copy) => copy.nav_profile,
			visibility: 'auth',
			roles: ['student', 'teacher', 'admin']
		}
	];

	const PUBLIC_PATHS = new Set<string>(['/', '/login']);
	const ROLE_HOME: Record<Role, RoleHomePath> = {
		student: '/onboarding',
		teacher: '/teacher',
		admin: '/admin'
	};
	const ROLE_ALLOWED_PATH_PREFIXES: Record<Role, readonly string[]> = {
		student: [
			'/',
			'/profile',
			'/security',
			'/account',
			'/onboarding',
			'/roadmap',
			'/roadmap-v2',
			'/prep',
			'/prep-v2',
			'/results',
			'/analytics',
			'/notifications'
		],
		teacher: [
			'/',
			'/profile',
			'/security',
			'/account',
			'/teacher',
			'/roadmap',
			'/roadmap-v2',
			'/notifications'
		],
		admin: ['/', '/profile', '/security', '/account', '/admin', '/notifications']
	};

	let mobileMenuOpen = false;
	let authRedirectInFlight = false;

	const copy = (): UiCopy => COPY[resolveLocale()];
	const normalizeRole = (value: unknown): Role | 'guest' => {
		const role = typeof value === 'string' ? value.toLowerCase() : '';
		if (role === 'student' || role === 'teacher' || role === 'admin') {
			return role;
		}
		return 'guest';
	};
	const roleHomePath = (role: Role): RoleHomePath => ROLE_HOME[role];
	let currentRole: Role | 'guest' = 'guest';
	let roleFocusText = '';
	let roleWorkspaceLink = '';
	let appNavItems: NavItem[] = [];
	let appMobileTabs: MobileTab[] = [];

	const localizedHref = (href: AppHref): string =>
		resolve(localizeHref(resolve(href)) as AppHref);

	const matchesPathPrefix = (path: string, prefix: string): boolean => {
		if (prefix === '/') {
			return path === '/';
		}
		return path === prefix || path.startsWith(`${prefix}/`);
	};

	const isRoleRouteAllowed = (role: Role, path: string): boolean =>
		ROLE_ALLOWED_PATH_PREFIXES[role].some((prefix) => matchesPathPrefix(path, prefix));

	const roleFocusMessage = (role: Role | 'guest'): string => {
		if (role === 'teacher') {
			return copy().role_focus_teacher;
		}
		if (role === 'admin') {
			return copy().role_focus_admin;
		}
		if (role === 'student') {
			return copy().role_focus_student;
		}
		return copy().role_focus_guest;
	};

	const roleWorkspaceHref = (role: Role | 'guest'): string => {
		if (role === 'guest') {
			return localizedHref('/');
		}
		const target = roleHomePath(role);
		return localizedHref(target);
	};

	const mobileWorkspaceLabel = (role: Role | 'guest'): string => {
		if (role === 'teacher') {
			return copy().mobile_workspace_teacher;
		}
		if (role === 'admin') {
			return copy().mobile_workspace_admin;
		}
		return copy().mobile_workspace_student;
	};

	const mobileTabs = (role: Role | 'guest'): MobileTab[] => {
		if (role === 'student') {
			return [
				{ href: '/onboarding', label: mobileWorkspaceLabel(role), icon: 'workspace' },
				{ href: '/roadmap-v2', label: copy().footer_roadmap, icon: 'updates' },
				{ href: '/notifications', label: copy().mobile_updates, icon: 'updates' },
				{ href: '/profile', label: copy().mobile_profile, icon: 'profile' }
			];
		}
		if (role === 'teacher') {
			return [
				{ href: '/teacher', label: mobileWorkspaceLabel(role), icon: 'workspace' },
				{ href: '/roadmap-v2', label: copy().footer_roadmap, icon: 'updates' },
				{ href: '/notifications', label: copy().mobile_updates, icon: 'updates' },
				{ href: '/profile', label: copy().mobile_profile, icon: 'profile' }
			];
		}
		if (role === 'admin') {
			return [
				{ href: '/admin', label: mobileWorkspaceLabel(role), icon: 'workspace' },
				{ href: '/notifications', label: copy().mobile_updates, icon: 'updates' },
				{ href: '/profile', label: copy().mobile_profile, icon: 'profile' },
				{ href: '/', label: copy().mobile_home, icon: 'home' }
			];
		}
		return [
			{ href: '/', label: copy().mobile_home, icon: 'home' },
			{ href: '/login', label: copy().mobile_login, icon: 'login' }
		];
	};

	const localeSwitchHref = (locale: (typeof locales)[number]): string => {
		const basePath = deLocalizeUrl(page.url).pathname;
		const localizedPath = localizeHref(basePath, { locale });
		return `${localizedPath}${page.url.search}`;
	};

	const onLocaleSwitch = async (event: MouseEvent, locale: (typeof locales)[number]) => {
		event.preventDefault();
		if (resolveLocale() === locale) {
			return;
		}
		const target = localeSwitchHref(locale);
		await setLocale(locale, { reload: false });
		await goto(resolve(target), { invalidateAll: true });
	};

	const isActive = (href: AppHref): boolean => {
		const localized = localizedHref(href);
		if (href === '/admin') {
			return page.url.pathname === localized;
		}
		return page.url.pathname === localized || page.url.pathname.startsWith(`${localized}/`);
	};

	const canShowItem = (item: NavItem, role: Role | 'guest'): boolean => {
		if (item.visibility === 'public') {
			return true;
		}

		if (role === 'guest') {
			return false;
		}

		if (item.roles && !item.roles.includes(role)) {
			return false;
		}

		return true;
	};

	const visibleNavItems = (role: Role | 'guest'): NavItem[] =>
		navItems.filter((item) => canShowItem(item, role));

	$: currentRole = normalizeRole($session.user?.role);
	$: roleFocusText = roleFocusMessage(currentRole);
	$: roleWorkspaceLink = roleWorkspaceHref(currentRole);
	$: appNavItems = visibleNavItems(currentRole);
	$: appMobileTabs = mobileTabs(currentRole);

	onMount(() => {
		void session.bootstrap();
	});

	const redirectSafely = async (target: string) => {
		if (authRedirectInFlight) {
			return;
		}
		authRedirectInFlight = true;
		try {
			await goto(resolve(target), { replaceState: true });
		} finally {
			authRedirectInFlight = false;
		}
	};

	$: if ($session.initialized && !authRedirectInFlight) {
		const normalizedPath = deLocalizeUrl(page.url).pathname;
		if (!$session.user && !PUBLIC_PATHS.has(normalizedPath)) {
			const redirectTo = `${normalizedPath}${page.url.search}`;
			const redirectParam = encodeURIComponent(redirectTo);
			const localizedLogin = localizedHref('/login');
			const localizedTarget = `${localizedLogin}?redirect_to=${redirectParam}`;
			const currentPathWithQuery = `${page.url.pathname}${page.url.search}`;
			if (currentPathWithQuery !== localizedTarget) {
				void redirectSafely(localizedTarget);
			}
		}

		if ($session.user) {
			const role = normalizeRole($session.user.role);
			if (role !== 'guest' && !isRoleRouteAllowed(role, normalizedPath)) {
				const target = roleHomePath(role);
				const localizedTarget = localizedHref(target);
				const redirectWithNotice = `${localizedTarget}?role_redirect=1`;
				const currentPathWithQuery = `${page.url.pathname}${page.url.search}`;
				if (currentPathWithQuery !== redirectWithNotice) {
					void redirectSafely(redirectWithNotice);
				}
			}
		}
	}

	const onLogout = async () => {
		session.logout();
		mobileMenuOpen = false;
		await goto(resolve(localizedHref('/')));
	};

	const closeMobileMenu = () => {
		mobileMenuOpen = false;
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<a class="skip-link" href="#main-content">{copy().skip_to_main}</a>

<div class="app-shell" data-role={currentRole}>
	<header class="app-header-wrap">
		<div class="app-header">
			<div class="app-top-row">
				<a class="app-brand" href={resolve(localizedHref('/'))}>
					<span>OlymRoad</span>
				</a>
				<button
					class="btn-secondary nav-toggle"
					type="button"
					aria-controls="app-drawer"
					aria-expanded={mobileMenuOpen}
					aria-label={mobileMenuOpen ? copy().close_menu : copy().open_menu}
					on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
				>
					<span class="burger-icon" aria-hidden="true">
						<span></span>
						<span></span>
						<span></span>
					</span>
					<span class="visually-hidden">{mobileMenuOpen ? copy().close_menu : copy().open_menu}</span>
				</button>
			</div>

			<div class="app-tools app-tools-header">
				<div class="app-lang" aria-label={copy().locale_switcher}>
					{#each locales as locale (locale)}
						<a
							href={resolve(localeSwitchHref(locale))}
							data-active={resolveLocale() === locale}
							on:click={(event) => onLocaleSwitch(event, locale)}
							>{locale.toUpperCase()}</a
						>
					{/each}
				</div>

				{#if $session.user}
					<p class="session-chip">
						<a
							href={resolve(localizedHref('/profile'))}
							style="color: inherit; text-decoration: underline;"
						>
							{copy().signed_in_as} {$session.user.name}
						</a>
						<strong>{roleLabel($session.user.role)}</strong>
					</p>
				{/if}

				<div class="app-user-controls">
					{#if $session.user}
						<button class="btn-secondary app-auth-btn" type="button" on:click={onLogout}
							>{copy().nav_logout}</button
						>
					{:else}
						<a class="btn-secondary app-auth-btn" href={resolve(localizedHref('/login'))}>
							{copy().nav_login}
						</a>
					{/if}
				</div>
			</div>

			<nav class="app-nav app-nav-desktop" aria-label={copy().primary_navigation}>
				{#each appNavItems as item (item.href)}
					<a
						href={resolve(localizedHref(item.href))}
						data-recommended={item.recommended === true}
						data-active={isActive(item.href)}
					>
						{item.label(copy())}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main id="main-content" class="app-main">
		{#if $session.user}
			<section class="app-role-strip" data-role={currentRole}>
				<p>{roleFocusText}</p>
				<a href={resolve(roleWorkspaceLink)}>{copy().open_role_workspace}</a>
			</section>
		{/if}
		{#if page.url.searchParams.get('role_redirect') === '1' && $session.user}
			<p class="app-role-redirect">{copy().role_redirect_notice}</p>
		{/if}
		<slot />
	</main>

	<footer class="app-footer">
		<div class="app-footer-inner">
			<small>{copy().footer_note}</small>
			<div class="app-footer-links">
				<a href={resolve(localizedHref('/'))}>{copy().footer_home}</a>
				{#if $session.user}
					<a href={resolve(localizedHref('/roadmap-v2'))}>{copy().footer_roadmap}</a>
					<a href={resolve(localizedHref('/notifications'))}>{copy().footer_updates}</a>
				{:else}
					<a href={resolve(localizeHref('/login?redirect_to=%2Froadmap-v2') as '/login')}>
						{copy().footer_roadmap}
					</a>
					<a href={resolve(localizeHref('/login?redirect_to=%2Fnotifications') as '/login')}>
						{copy().footer_updates}
					</a>
				{/if}
			</div>
		</div>
	</footer>

	<nav
		class="app-tabbar"
		aria-label={copy().mobile_tabs}
		style={`--mobile-tab-columns: ${appMobileTabs.length};`}
	>
		{#each appMobileTabs as item (item.href)}
			<a href={resolve(localizedHref(item.href))} data-active={isActive(item.href)}>
				{#if item.icon === 'home'}
					<span class="app-tabbar-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M3 12.5L12 5L21 12.5V20a1 1 0 01-1 1h-5v-6h-2v6H4a1 1 0 01-1-1V12.5Z"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
						</svg>
					</span>
				{:else if item.icon === 'workspace'}
					<span class="app-tabbar-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M4 3h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm10 0h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1V4a1 1 0 011-1zm-10 10h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6a1 1 0 011-1zm10 0h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-6a1 1 0 011-1z"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
						</svg>
					</span>
				{:else if item.icon === 'updates'}
					<span class="app-tabbar-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M14.5 19a2.5 2.5 0 11-5 0M18 16.5a4 4 0 00-8 0v.75h4v-.75zM6 8.5A6 6 0 1118 8.5a6 6 0 01-12 0zm4-4 1.5 1.5 3-3"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
						</svg>
					</span>
				{:else if item.icon === 'profile'}
					<span class="app-tabbar-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M20 21v-1a4 4 0 00-4-4h-8a4 4 0 00-4 4v1"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
							<path
								d="M12 11a4 4 0 100-8 4 4 0 000 8z"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
						</svg>
					</span>
				{:else if item.icon === 'login'}
					<span class="app-tabbar-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M8 17 4 12l4-5M4 12h13.5M15 6l2.5 2.5M17.5 12 15 17"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
							<path
								d="M19 9v6"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.6"
							/>
						</svg>
					</span>
				{/if}
				<span class="app-tabbar-label">{item.label}</span>
			</a>
		{/each}
	</nav>

	{#if mobileMenuOpen}
		<button
			class="app-drawer-overlay"
			type="button"
			aria-label={copy().close_menu}
			on:click={closeMobileMenu}
		></button>
		<aside id="app-drawer" class="app-drawer" aria-label={copy().primary_navigation}>
			<div class="app-drawer-head">
				<p class="app-drawer-title">OlymRoad</p>
				<button class="btn-secondary app-drawer-close" type="button" on:click={closeMobileMenu}>
					{copy().close_menu}
				</button>
			</div>
			<nav class="app-nav app-nav-drawer" aria-label={copy().primary_navigation}>
				{#each appNavItems as item (item.href)}
					<a
						href={resolve(localizedHref(item.href))}
						data-recommended={item.recommended === true}
						data-active={isActive(item.href)}
						on:click={closeMobileMenu}
					>
						{item.label(copy())}
					</a>
				{/each}
			</nav>
			<div class="app-drawer-foot">
				<div class="app-lang" aria-label={copy().locale_switcher}>
					{#each locales as locale (locale)}
						<a
							href={resolve(localeSwitchHref(locale))}
							data-active={resolveLocale() === locale}
							on:click={(event) => {
								void onLocaleSwitch(event, locale);
								closeMobileMenu();
							}}
							>{locale.toUpperCase()}</a
						>
					{/each}
				</div>
				{#if $session.user}
					<p class="session-chip">
						<a
							href={resolve(localizedHref('/profile'))}
							style="color: inherit; text-decoration: underline;"
							on:click={closeMobileMenu}
						>
							{copy().signed_in_as} {$session.user.name}
						</a>
						<strong>{roleLabel($session.user.role)}</strong>
					</p>
					<button class="btn-secondary app-auth-btn" type="button" on:click={onLogout}
						>{copy().nav_logout}</button
					>
				{:else}
					<a class="btn-secondary app-auth-btn" href={resolve(localizedHref('/login'))} on:click={closeMobileMenu}
						>{copy().nav_login}</a
					>
				{/if}
			</div>
		</aside>
	{/if}
</div>

<style>
	.app-shell[data-role='guest'] {
		--ol-role-accent: #4f63dd;
		--ol-role-surface: rgba(79, 99, 221, 0.08);
	}

	.app-shell[data-role='student'] {
		--ol-role-accent: #2f7d4c;
		--ol-role-surface: rgba(47, 125, 76, 0.12);
	}

	.app-shell[data-role='teacher'] {
		--ol-role-accent: #0d6f86;
		--ol-role-surface: rgba(13, 111, 134, 0.12);
	}

	.app-shell[data-role='admin'] {
		--ol-role-accent: #9a4a0d;
		--ol-role-surface: rgba(154, 74, 13, 0.12);
	}

	.app-lang a[data-active='true'] {
		color: var(--ol-primary);
		border-color: var(--ol-border-strong);
		background: rgba(79, 99, 221, 0.08);
	}

	.app-role-strip {
		margin-bottom: 0.2rem;
		padding: 0.16rem 0.58rem;
		border: 1px solid var(--ol-role-surface);
		border-radius: 0.72rem;
		background: color-mix(in oklab, var(--ol-role-surface) 72%, white 28%);
		display: flex;
		width: 100%;
		max-width: none;
		gap: 0.45rem;
		align-items: center;
		justify-content: space-between;
	}

	.app-role-strip p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.2;
		color: var(--ol-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.app-role-strip a {
		font-size: 0.74rem;
		font-weight: 700;
		text-decoration: none;
		color: var(--ol-role-accent);
		border: 1px solid var(--ol-role-surface);
		border-radius: 999px;
		padding: 0.14rem 0.4rem;
		background: #ffffff;
		white-space: nowrap;
	}

	.app-role-strip a:hover,
	.app-role-strip a:focus-visible {
		border-color: var(--ol-role-accent);
	}

	.app-role-redirect {
		margin: 0;
		padding: 0.16rem 0.58rem;
		border-radius: 0.62rem;
		border: 1px solid var(--ol-role-surface);
		background: color-mix(in oklab, var(--ol-role-surface) 65%, white 35%);
		color: var(--ol-ink);
		font-size: 0.8rem;
		line-height: 1.2;
		display: block;
		width: 100%;
		max-width: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 760px) {
		.app-role-strip {
			flex-direction: row;
			align-items: center;
		}
	}
</style>
