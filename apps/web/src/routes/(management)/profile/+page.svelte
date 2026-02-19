<svelte:options runes={false} />

<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, getErrorMessage, type Locale, type UserRole } from '$lib/api';
	import { resolveLocale } from '$lib/i18n';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		profile_section: string;
		profile_title: string;
		profile_subtitle_student: string;
		profile_subtitle_teacher: string;
		profile_subtitle_admin: string;
		sign_in_required: string;
		loading: string;
		name: string;
		email: string;
		school_optional: string;
		grade_optional: string;
		locale_label: string;
		student_profile_title: string;
		student_directions: string;
		student_directions_hint: string;
		student_goals: string;
		student_goals_hint: string;
		student_onboarding_status: string;
		student_onboarding_complete: string;
		student_onboarding_pending: string;
		open_student_setup: string;
		teacher_profile_title: string;
		teacher_subjects: string;
		teacher_subjects_hint: string;
		open_teacher_workspace: string;
		admin_profile_title: string;
		admin_scope_hint: string;
		open_admin_workspace: string;
		save_changes: string;
		manage_security: string;
		name_required: string;
		grade_integer: string;
		profile_saved: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			profile_section: 'Profile',
			profile_title: 'Personal data',
			profile_subtitle_student: 'Manage student identity, learning profile fields, and preferences.',
			profile_subtitle_teacher: 'Manage teacher identity, teaching profile fields, and preferences.',
			profile_subtitle_admin: 'Manage admin identity, account preferences, and security access.',
			sign_in_required: 'Sign in to manage profile settings.',
			loading: 'Loading profile data...',
			name: 'Name',
			email: 'Email',
			school_optional: 'School (optional)',
			grade_optional: 'Grade (optional)',
			locale_label: 'Locale',
			student_profile_title: 'Student profile',
			student_directions: 'Directions',
			student_directions_hint: 'Comma-separated values. Example: Math, Physics',
			student_goals: 'Goals',
			student_goals_hint: 'Describe your target stage, score, or preparation milestone.',
			student_onboarding_status: 'Initial setup status',
			student_onboarding_complete: 'Completed',
			student_onboarding_pending: 'Pending',
			open_student_setup: 'Open initial setup',
			teacher_profile_title: 'Teacher profile',
			teacher_subjects: 'Subjects',
			teacher_subjects_hint: 'Comma-separated values. Example: Algebra, Geometry',
			open_teacher_workspace: 'Open teacher workspace',
			admin_profile_title: 'Admin profile',
			admin_scope_hint:
				'Admin accounts manage olympiads, stages, dictionaries, and role/access governance.',
			open_admin_workspace: 'Open admin workspace',
			save_changes: 'Save changes',
			manage_security: 'Open security settings',
			name_required: 'Name is required.',
			grade_integer: 'Grade must be an integer.',
			profile_saved: 'Profile updated.'
		},
		ru: {
			profile_section: 'Профиль',
			profile_title: 'Персональные данные',
			profile_subtitle_student:
				'Управляйте данными ученика, учебным профилем и персональными настройками.',
			profile_subtitle_teacher:
				'Управляйте данными учителя, полями преподавательского профиля и настройками.',
			profile_subtitle_admin:
				'Управляйте данными администратора, настройками аккаунта и доступами.',
			sign_in_required: 'Войдите, чтобы управлять профилем.',
			loading: 'Загрузка данных профиля...',
			name: 'Имя',
			email: 'Email',
			school_optional: 'Школа (необязательно)',
			grade_optional: 'Класс (необязательно)',
			locale_label: 'Язык',
			student_profile_title: 'Профиль ученика',
			student_directions: 'Направления',
			student_directions_hint: 'Через запятую. Пример: Математика, Физика',
			student_goals: 'Цели',
			student_goals_hint: 'Опишите целевой этап, балл или ориентир по подготовке.',
			student_onboarding_status: 'Статус первичной настройки',
			student_onboarding_complete: 'Завершена',
			student_onboarding_pending: 'Не завершена',
			open_student_setup: 'Открыть первичную настройку',
			teacher_profile_title: 'Профиль учителя',
			teacher_subjects: 'Предметы',
			teacher_subjects_hint: 'Через запятую. Пример: Алгебра, Геометрия',
			open_teacher_workspace: 'Открыть кабинет учителя',
			admin_profile_title: 'Профиль администратора',
			admin_scope_hint:
				'Администратор управляет олимпиадами, этапами, словарями и ролями/доступами.',
			open_admin_workspace: 'Открыть кабинет администратора',
			save_changes: 'Сохранить изменения',
			manage_security: 'Открыть безопасность',
			name_required: 'Имя обязательно.',
			grade_integer: 'Класс должен быть целым числом.',
			profile_saved: 'Профиль обновлен.'
		},
		kz: {
			profile_section: 'Профиль',
			profile_title: 'Жеке деректер',
			profile_subtitle_student:
				'Оқушы деректерін, оқу профилі өрістерін және жеке баптауларды басқарыңыз.',
			profile_subtitle_teacher:
				'Мұғалім деректерін, оқыту профилі өрістерін және баптауларды басқарыңыз.',
			profile_subtitle_admin:
				'Әкімші деректерін, аккаунт баптауларын және қолжетімділікті басқарыңыз.',
			sign_in_required: 'Профильді басқару үшін кіріңіз.',
			loading: 'Профиль деректері жүктелуде...',
			name: 'Аты',
			email: 'Email',
			school_optional: 'Мектеп (міндетті емес)',
			grade_optional: 'Сынып (міндетті емес)',
			locale_label: 'Тіл',
			student_profile_title: 'Оқушы профилі',
			student_directions: 'Бағыттар',
			student_directions_hint: 'Үтір арқылы. Мысалы: Математика, Физика',
			student_goals: 'Мақсаттар',
			student_goals_hint: 'Мақсатты кезеңді, баллды немесе дайындық межесін сипаттаңыз.',
			student_onboarding_status: 'Бастапқы баптау күйі',
			student_onboarding_complete: 'Аяқталған',
			student_onboarding_pending: 'Аяқталмаған',
			open_student_setup: 'Бастапқы баптауды ашу',
			teacher_profile_title: 'Мұғалім профилі',
			teacher_subjects: 'Пәндер',
			teacher_subjects_hint: 'Үтір арқылы. Мысалы: Алгебра, Геометрия',
			open_teacher_workspace: 'Мұғалім панелін ашу',
			admin_profile_title: 'Әкімші профилі',
			admin_scope_hint:
				'Әкімші олимпиадаларды, кезеңдерді, анықтамалықтарды және рөл/қолжетімділікті басқарады.',
			open_admin_workspace: 'Әкімші панелін ашу',
			save_changes: 'Өзгерістерді сақтау',
			manage_security: 'Қауіпсіздік баптауларын ашу',
			name_required: 'Аты міндетті.',
			grade_integer: 'Сынып бүтін сан болуы керек.',
			profile_saved: 'Профиль жаңартылды.'
		}
	};

	let loading = false;
	let saving = false;
	let errorMessage: string | null = null;
	let successMessage: string | null = null;
	let name = '';
	let email = '';
	let school = '';
	let grade = '';
	let locale: Locale = 'ru';
	let role: UserRole | null = null;
	let studentDirections = '';
	let studentGoals = '';
	let studentOnboardingCompletedAt: string | null = null;
	let teacherSubjects = '';

	const copy = (): UiCopy => COPY[resolveLocale()];

	const profileSubtitle = (): string => {
		if (role === 'teacher') {
			return copy().profile_subtitle_teacher;
		}
		if (role === 'admin') {
			return copy().profile_subtitle_admin;
		}
		return copy().profile_subtitle_student;
	};

	const parseGrade = (value: string): number | null => {
		if (value.trim().length === 0) {
			return null;
		}
		const parsed = Number(value);
		if (!Number.isInteger(parsed)) {
			return null;
		}
		return parsed;
	};

	const normalizeLocale = (value: unknown): Locale => {
		if (value === 'en' || value === 'ru' || value === 'kz') {
			return value;
		}
		return 'ru';
	};

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const normalizeStringArray = (value: unknown): string[] => {
		if (!Array.isArray(value)) {
			return [];
		}
		return value
			.filter((item): item is string => typeof item === 'string')
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	};

	const toListInput = (items: string[]): string => items.join(', ');

	const parseListInput = (value: string): string[] =>
		Array.from(
			new Set(
				value
					.split(',')
					.map((item) => item.trim())
					.filter((item) => item.length > 0)
			)
		);

	const loadProfile = async () => {
		const token = currentToken();
		if (!token || !$session.user) {
			return;
		}

		loading = true;
		errorMessage = null;
		try {
			const me = await api.getMe(token);
			const user = me.user;
			name = user.name ?? '';
			email = user.email ?? '';
			role = user.role;
			school = typeof user.school === 'string' ? user.school : '';
			grade =
				typeof user.grade === 'number'
					? String(user.grade)
					: typeof user.grade === 'string'
						? user.grade
						: '';
			locale = normalizeLocale(user.locale);
			studentDirections = '';
			studentGoals = '';
			studentOnboardingCompletedAt = null;
			teacherSubjects = '';

			if (isRecord(me.profile)) {
				if (user.role === 'student') {
					studentDirections = toListInput(normalizeStringArray(me.profile.directions_json));
					studentGoals = typeof me.profile.goals_text === 'string' ? me.profile.goals_text : '';
					studentOnboardingCompletedAt =
						typeof me.profile.onboarding_completed_at === 'string'
							? me.profile.onboarding_completed_at
							: null;
				} else if (user.role === 'teacher') {
					teacherSubjects = toListInput(normalizeStringArray(me.profile.subjects_json));
				}
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void (async () => {
			await session.bootstrap();
			await loadProfile();
		})();
	});

	const onSave = async (event: SubmitEvent) => {
		event.preventDefault();

		const token = currentToken();
		if (!token || !$session.user) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const trimmedName = name.trim();
		if (trimmedName.length === 0) {
			errorMessage = copy().name_required;
			return;
		}

		const parsedGrade = parseGrade(grade);
		if (grade.trim().length > 0 && parsedGrade === null) {
			errorMessage = copy().grade_integer;
			return;
		}

		saving = true;
		errorMessage = null;
		successMessage = null;
		try {
			const payload: {
				name: string;
				school: string | null;
				grade: number | null;
				locale: Locale;
				directions?: string[];
				goals_text?: string | null;
				subjects?: string[];
			} = {
				name: trimmedName,
				school: school.trim().length > 0 ? school.trim() : null,
				grade: parsedGrade,
				locale
			};

			if (role === 'student') {
				payload.directions = parseListInput(studentDirections);
				payload.goals_text = studentGoals.trim().length > 0 ? studentGoals.trim() : null;
			}
			if (role === 'teacher') {
				payload.subjects = parseListInput(teacherSubjects);
			}

			await api.updateMe(token, payload);
			await session.refresh();
			successMessage = copy().profile_saved;
			await loadProfile();
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			saving = false;
		}
	};
</script>

<section class="page-panel profile-panel">
	<header class="section-heading">
		<p>{copy().profile_section}</p>
		<h2>{copy().profile_title}</h2>
		<p class="session-meta">{profileSubtitle()}</p>
	</header>

	{#if !$session.user}
		<p class="error-banner">{copy().sign_in_required}</p>
	{:else}
		<form class="auth-form profile-form" on:submit={onSave}>
			<section class="profile-card profile-main-card">
				<div class="auth-grid profile-main-grid">
					<label class="profile-field">
					<span>{copy().name}</span>
					<input bind:value={name} />
				</label>
					<label class="profile-field">
					<span>{copy().email}</span>
					<input value={email} type="email" disabled />
				</label>
					<label class="profile-field">
					<span>{copy().school_optional}</span>
					<input bind:value={school} />
				</label>
					<label class="profile-field">
					<span>{copy().grade_optional}</span>
					<input bind:value={grade} type="number" min="1" max="12" />
				</label>
					<label class="profile-field profile-field-locale">
					<span>{copy().locale_label}</span>
					<select bind:value={locale}>
						<option value="ru">RU</option>
						<option value="en">EN</option>
						<option value="kz">KZ</option>
					</select>
				</label>
				</div>
			</section>

			{#if role === 'student'}
				<section class="role-profile-card profile-card">
					<h3>{copy().student_profile_title}</h3>
					<div class="auth-grid role-grid">
						<label class="wide profile-field">
							<span>{copy().student_directions}</span>
							<input bind:value={studentDirections} />
							<small>{copy().student_directions_hint}</small>
						</label>
						<label class="wide profile-field">
							<span>{copy().student_goals}</span>
							<textarea bind:value={studentGoals} rows="4"></textarea>
							<small>{copy().student_goals_hint}</small>
						</label>
					</div>
					<p class="session-meta">
						{copy().student_onboarding_status}:
						{studentOnboardingCompletedAt
							? copy().student_onboarding_complete
							: copy().student_onboarding_pending}
					</p>
					<div class="hero-actions profile-actions">
						<a class="btn-secondary" href={resolve(localizeHref(resolve('/onboarding')) as '/onboarding')}>
							{copy().open_student_setup}
						</a>
					</div>
				</section>
			{:else if role === 'teacher'}
				<section class="role-profile-card profile-card">
					<h3>{copy().teacher_profile_title}</h3>
					<div class="auth-grid role-grid">
						<label class="wide profile-field">
							<span>{copy().teacher_subjects}</span>
							<input bind:value={teacherSubjects} />
							<small>{copy().teacher_subjects_hint}</small>
						</label>
					</div>
					<div class="hero-actions profile-actions">
						<a class="btn-secondary" href={resolve(localizeHref(resolve('/teacher')) as '/teacher')}>
							{copy().open_teacher_workspace}
						</a>
					</div>
				</section>
			{:else if role === 'admin'}
				<section class="role-profile-card profile-card">
					<h3>{copy().admin_profile_title}</h3>
					<p class="session-meta">{copy().admin_scope_hint}</p>
					<div class="hero-actions profile-actions">
						<a class="btn-secondary" href={resolve(localizeHref(resolve('/admin')) as '/admin')}>
							{copy().open_admin_workspace}
						</a>
					</div>
				</section>
			{/if}

			<section class="profile-card profile-submit-card">
				<div class="hero-actions profile-actions">
					<button class="btn-primary" type="submit" disabled={saving || loading}>
						{copy().save_changes}
					</button>
					<a class="btn-secondary" href={resolve(localizeHref(resolve('/security')) as '/security')}>
						{copy().manage_security}
					</a>
				</div>
			</section>
		</form>
	{/if}

	{#if loading}
		<p class="info-banner">{copy().loading}</p>
	{/if}
	{#if errorMessage}
		<p class="error-banner">{errorMessage}</p>
	{/if}
	{#if successMessage}
		<p class="info-banner">{successMessage}</p>
	{/if}
</section>

<style>
	.profile-panel {
		display: grid;
		gap: 1rem;
		width: min(100%, 72rem);
		margin: 0 auto;
	}

	.profile-form {
		display: grid;
		gap: 1rem;
	}

	.profile-card {
		border: 1px solid color-mix(in oklab, var(--text-main) 14%, transparent);
		border-radius: 1rem;
		padding: clamp(0.9rem, 1.4vw, 1.2rem);
		background: linear-gradient(
			170deg,
			color-mix(in oklab, var(--surface-soft) 92%, white 8%) 0%,
			color-mix(in oklab, var(--surface-soft) 84%, white 16%) 100%
		);
		box-shadow: 0 10px 24px -20px color-mix(in oklab, var(--text-main) 52%, transparent);
	}

	.profile-main-grid,
	.role-grid {
		margin: 0;
		gap: 0.85rem;
	}

	.profile-field {
		display: grid;
		gap: 0.45rem;
	}

	.profile-field-locale {
		max-width: 14rem;
	}

	.profile-panel input,
	.profile-panel select,
	.profile-panel textarea {
		width: 100%;
	}

	.profile-panel textarea {
		min-height: 7rem;
		resize: vertical;
	}

	.profile-panel input[disabled] {
		background: color-mix(in oklab, var(--surface-soft) 88%, white 12%);
		color: var(--ol-ink-soft);
		cursor: not-allowed;
	}

	.profile-actions {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		justify-content: stretch;
	}

	.profile-actions > * {
		width: 100%;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.role-profile-card {
		display: grid;
		gap: 0.85rem;
	}

	.role-profile-card h3 {
		margin: 0;
	}

	.role-grid {
		margin: 0;
	}

	.role-profile-card small {
		font-size: 0.75rem;
		color: var(--ol-ink-soft);
	}

	@media (max-width: 900px) {
		.profile-main-grid,
		.role-grid {
			grid-template-columns: 1fr;
		}

		.profile-field-locale {
			max-width: none;
		}

		.profile-actions {
			grid-template-columns: 1fr;
		}
	}

	@media (min-width: 1024px) {
		.profile-panel {
			gap: 1.25rem;
		}

		.profile-form {
			gap: 1.1rem;
		}

		.profile-main-grid {
			grid-template-columns: repeat(12, minmax(0, 1fr));
		}

		.profile-main-grid .profile-field {
			grid-column: span 6;
		}

		.profile-main-grid .profile-field-locale {
			grid-column: span 4;
		}
	}
</style>
