<svelte:options runes={false} />

<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { resolveLocale } from '$lib/i18n';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { session } from '$lib/session';

	type ManagementHref = '/profile' | '/security';
	type UserRole = 'student' | 'teacher' | 'admin';

	type UiCopy = {
		menu_title_student: string;
		menu_title_teacher: string;
		menu_title_admin: string;
		menu_subtitle_student: string;
		menu_subtitle_teacher: string;
		menu_subtitle_admin: string;
		navigation_title: string;
		nav_profile: string;
		nav_security: string;
		open_menu: string;
		close_menu: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			menu_title_student: 'Student profile settings',
			menu_title_teacher: 'Teacher profile settings',
			menu_title_admin: 'Admin profile settings',
			menu_subtitle_student: 'Manage personal data, learning directions, and security methods.',
			menu_subtitle_teacher: 'Manage personal data, teaching profile fields, and security methods.',
			menu_subtitle_admin: 'Manage personal data, admin account controls, and security methods.',
			navigation_title: 'Profile management navigation',
			nav_profile: 'Profile',
			nav_security: 'Security',
			open_menu: 'Open menu',
			close_menu: 'Close'
		},
		ru: {
			menu_title_student: 'Настройки профиля ученика',
			menu_title_teacher: 'Настройки профиля учителя',
			menu_title_admin: 'Настройки профиля администратора',
			menu_subtitle_student: 'Управляйте личными данными, направлениями и способами входа.',
			menu_subtitle_teacher:
				'Управляйте личными данными, полями профиля учителя и способами входа.',
			menu_subtitle_admin:
				'Управляйте личными данными, админ-контролями аккаунта и способами входа.',
			navigation_title: 'Навигация по управлению профилем',
			nav_profile: 'Профиль',
			nav_security: 'Безопасность',
			open_menu: 'Открыть меню',
			close_menu: 'Закрыть'
		},
		kz: {
			menu_title_student: 'Оқушы профилі баптаулары',
			menu_title_teacher: 'Мұғалім профилі баптаулары',
			menu_title_admin: 'Әкімші профилі баптаулары',
			menu_subtitle_student:
				'Жеке деректерді, оқу бағыттарын және кіру әдістерін басқарыңыз.',
			menu_subtitle_teacher:
				'Жеке деректерді, мұғалім профилі өрістерін және кіру әдістерін басқарыңыз.',
			menu_subtitle_admin:
				'Жеке деректерді, әкімші аккаунт бақылауын және кіру әдістерін басқарыңыз.',
			navigation_title: 'Профильді басқару навигациясы',
			nav_profile: 'Профиль',
			nav_security: 'Қауіпсіздік',
			open_menu: 'Мәзірді ашу',
			close_menu: 'Жабу'
		}
	};

	type ManagementNavItem = {
		href: ManagementHref;
		label: (copy: UiCopy) => string;
	};

	const navItems: ManagementNavItem[] = [
		{ href: '/profile', label: (copy) => copy.nav_profile },
		{ href: '/security', label: (copy) => copy.nav_security }
	];

	let menuOpen = false;

	const copy = (): UiCopy => COPY[resolveLocale()];
	const currentRole = (): UserRole => ($session.user?.role as UserRole | undefined) ?? 'student';

	const menuTitle = (): string => {
		const role = currentRole();
		if (role === 'teacher') {
			return copy().menu_title_teacher;
		}
		if (role === 'admin') {
			return copy().menu_title_admin;
		}
		return copy().menu_title_student;
	};

	const menuSubtitle = (): string => {
		const role = currentRole();
		if (role === 'teacher') {
			return copy().menu_subtitle_teacher;
		}
		if (role === 'admin') {
			return copy().menu_subtitle_admin;
		}
		return copy().menu_subtitle_student;
	};

	const isActive = (href: ManagementHref): boolean => {
		const localized = resolve(localizeHref(resolve(href)) as ManagementHref);
		return page.url.pathname === localized || page.url.pathname.startsWith(`${localized}/`);
	};

	const closeMenu = () => {
		menuOpen = false;
	};
</script>

<section class="management-shell">
	<div class="management-mobile-tools">
		<button
			class="btn-secondary management-burger"
			type="button"
			aria-label={copy().open_menu}
			on:click={() => (menuOpen = true)}
		>
			{copy().open_menu}
		</button>
	</div>

	<aside class="management-sidebar">
		<p class="management-menu-title">{menuTitle()}</p>
		<p class="management-menu-subtitle">{menuSubtitle()}</p>
		<nav class="management-nav" aria-label={copy().navigation_title}>
			{#each navItems as item (item.href)}
				<a
					href={resolve(localizeHref(resolve(item.href)) as ManagementHref)}
					data-active={isActive(item.href)}
					on:click={closeMenu}>{item.label(copy())}</a
				>
			{/each}
		</nav>
	</aside>

	<div class="management-content">
		<slot />
	</div>

	{#if menuOpen}
		<button
			class="management-overlay"
			type="button"
			aria-label={copy().close_menu}
			on:click={closeMenu}
		></button>
		<aside class="management-drawer" aria-label={copy().navigation_title}>
			<div class="management-drawer-head">
				<p class="management-menu-title">{menuTitle()}</p>
				<button class="btn-secondary management-drawer-close" type="button" on:click={closeMenu}>
					{copy().close_menu}
				</button>
			</div>
			<p class="management-menu-subtitle">{menuSubtitle()}</p>
			<nav class="management-nav">
				{#each navItems as item (item.href)}
					<a
						href={resolve(localizeHref(resolve(item.href)) as ManagementHref)}
						data-active={isActive(item.href)}
						on:click={closeMenu}>{item.label(copy())}</a
					>
				{/each}
			</nav>
		</aside>
	{/if}
</section>

<style>
	.management-shell {
		display: grid;
		gap: 1rem;
		align-items: start;
	}

	.management-mobile-tools {
		display: flex;
		justify-content: flex-end;
	}

	.management-burger {
		font-size: 0.82rem;
	}

	.management-sidebar {
		display: none;
	}

	.management-menu-title {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ol-primary);
	}

	.management-menu-subtitle {
		margin: 0.45rem 0 0;
		font-size: 0.82rem;
		line-height: 1.4;
		color: var(--ol-ink-soft);
	}

	.management-nav {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}

	.management-nav a {
		text-decoration: none;
		border: 1px solid var(--ol-border);
		border-radius: 0.72rem;
		padding: 0.55rem 0.7rem;
		font-weight: 700;
		font-size: 0.87rem;
		color: var(--ol-ink);
		background: #ffffff;
	}

	.management-nav a:hover,
	.management-nav a:focus-visible {
		color: var(--ol-primary);
		border-color: var(--ol-border-strong);
		background: var(--ol-primary-soft);
	}

	.management-nav a[data-active='true'] {
		color: var(--ol-primary);
		border-color: var(--ol-border-strong);
		background: var(--ol-primary-soft);
	}

	.management-content {
		min-width: 0;
	}

	.management-overlay {
		position: fixed;
		inset: 0;
		border: 0;
		background: rgba(11, 18, 34, 0.35);
		z-index: 39;
	}

	.management-drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: min(320px, 88vw);
		background: #ffffff;
		border-left: 1px solid var(--ol-border);
		box-shadow: -12px 0 30px rgba(18, 30, 57, 0.2);
		padding: 1rem;
		z-index: 40;
	}

	.management-drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.management-drawer-close {
		font-size: 0.82rem;
		padding: 0.42rem 0.7rem;
	}

	@media (min-width: 920px) {
		.management-shell {
			grid-template-columns: minmax(210px, 250px) 1fr;
		}

		.management-mobile-tools {
			display: none;
		}

		.management-sidebar {
			display: block;
			position: sticky;
			top: 6.2rem;
			padding: 1rem;
			border: 1px solid var(--ol-border);
			border-radius: 1rem;
			background: rgba(255, 255, 255, 0.92);
			box-shadow: 0 10px 22px rgba(24, 40, 76, 0.08);
		}
	}
</style>
