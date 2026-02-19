<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		api,
		getErrorMessage,
		type PublicUser,
		type UserRole,
		type V2AdminSeries,
		type V2AdminStageTemplate,
		type V2RoadmapItem
	} from '$lib/api';
	import { eventTypeLabel, formatDate, resolveLocale, roleLabel, stageTypeLabel } from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		admin_required: string;
		series_title: string;
		stage_templates_title: string;
		stage_instances_title: string;
		users_title: string;
		loading: string;
		refresh: string;
		create_stage: string;
		series: string;
		template: string;
		label: string;
		date_precision: string;
		starts_on: string;
		ends_on: string;
		registration_deadline: string;
		location_text: string;
		format: string;
		save: string;
		search_users: string;
		active_only: string;
		all: string;
		yes: string;
		no: string;
		none: string;
		role: string;
		active: string;
		error_series_required: string;
		error_template_required: string;
		info_stage_created: string;
		info_user_role_updated: string;
		info_user_active_updated: string;
		col_stage: string;
		col_dates: string;
		col_deadline: string;
		col_status: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Admin v2 | OlymRoad',
			meta_description: 'Admin panel for v2 olympiad stage instances and users.',
			hero_eyebrow: 'Admin workspace v2',
			hero_title: 'Manage stage instances and user access on new schema',
			hero_subtitle:
				'Uses competition_series, stage_templates, stage_instances and role controls for v2 flows.',
			sign_in_required: 'Sign in to open admin workspace.',
			admin_required: 'Admin role is required.',
			series_title: 'Competition series',
			stage_templates_title: 'Stage templates',
			stage_instances_title: 'Stage instances',
			users_title: 'Users and access',
			loading: 'Loading...',
			refresh: 'Refresh',
			create_stage: 'Create stage instance',
			series: 'Series',
			template: 'Template',
			label: 'Label',
			date_precision: 'Date precision',
			starts_on: 'Starts on',
			ends_on: 'Ends on',
			registration_deadline: 'Registration deadline',
			location_text: 'Location',
			format: 'Format',
			save: 'Save',
			search_users: 'Search users',
			active_only: 'Active filter',
			all: 'All',
			yes: 'Yes',
			no: 'No',
			none: 'None',
			role: 'Role',
			active: 'Active',
			error_series_required: 'Series is required.',
			error_template_required: 'Template is required.',
			info_stage_created: 'Stage instance created.',
			info_user_role_updated: 'User role updated.',
			info_user_active_updated: 'User active state updated.',
			col_stage: 'Stage',
			col_dates: 'Dates',
			col_deadline: 'Deadline',
			col_status: 'Status'
		},
		ru: {
			meta_title: 'Админ v2 | OlymRoad',
			meta_description: 'Админ-панель для v2 этапов олимпиады и доступа пользователей.',
			hero_eyebrow: 'Админ workspace v2',
			hero_title: 'Управление этапами и доступом пользователей на новой схеме',
			hero_subtitle:
				'Используются competition_series, stage_templates, stage_instances и контроль ролей для v2 потоков.',
			sign_in_required: 'Войдите, чтобы открыть админ-раздел.',
			admin_required: 'Требуется роль администратора.',
			series_title: 'Серии соревнований',
			stage_templates_title: 'Шаблоны этапов',
			stage_instances_title: 'Экземпляры этапов',
			users_title: 'Пользователи и доступ',
			loading: 'Загрузка...',
			refresh: 'Обновить',
			create_stage: 'Создать экземпляр этапа',
			series: 'Серия',
			template: 'Шаблон',
			label: 'Метка',
			date_precision: 'Точность даты',
			starts_on: 'Дата начала',
			ends_on: 'Дата окончания',
			registration_deadline: 'Дедлайн регистрации',
			location_text: 'Локация',
			format: 'Формат',
			save: 'Сохранить',
			search_users: 'Поиск пользователей',
			active_only: 'Фильтр активности',
			all: 'Все',
			yes: 'Да',
			no: 'Нет',
			none: 'Нет',
			role: 'Роль',
			active: 'Активен',
			error_series_required: 'Серия обязательна.',
			error_template_required: 'Шаблон обязателен.',
			info_stage_created: 'Экземпляр этапа создан.',
			info_user_role_updated: 'Роль пользователя обновлена.',
			info_user_active_updated: 'Состояние активности пользователя обновлено.',
			col_stage: 'Этап',
			col_dates: 'Даты',
			col_deadline: 'Дедлайн',
			col_status: 'Статус'
		},
		kz: {
			meta_title: 'Әкімші v2 | OlymRoad',
			meta_description: 'v2 олимпиада кезеңдері мен пайдаланушы рұқсатына арналған әкімші панелі.',
			hero_eyebrow: 'Әкімші workspace v2',
			hero_title: 'Жаңа схемада кезеңдер мен пайдаланушы рұқсатын басқару',
			hero_subtitle:
				'v2 ағымдары үшін competition_series, stage_templates, stage_instances және рөлдік бақылау қолданылады.',
			sign_in_required: 'Әкімші бөліміне кіру үшін жүйеге кіріңіз.',
			admin_required: 'Әкімші рөлі қажет.',
			series_title: 'Жарыс сериялары',
			stage_templates_title: 'Кезең шаблондары',
			stage_instances_title: 'Кезең нұсқалары',
			users_title: 'Пайдаланушылар және рұқсат',
			loading: 'Жүктелуде...',
			refresh: 'Жаңарту',
			create_stage: 'Кезең нұсқасын құру',
			series: 'Серия',
			template: 'Шаблон',
			label: 'Белгі',
			date_precision: 'Күн дәлдігі',
			starts_on: 'Басталу күні',
			ends_on: 'Аяқталу күні',
			registration_deadline: 'Тіркелу дедлайны',
			location_text: 'Өтетін жері',
			format: 'Формат',
			save: 'Сақтау',
			search_users: 'Пайдаланушыларды іздеу',
			active_only: 'Белсенділік сүзгісі',
			all: 'Барлығы',
			yes: 'Иә',
			no: 'Жоқ',
			none: 'Жоқ',
			role: 'Рөл',
			active: 'Белсенді',
			error_series_required: 'Серия міндетті.',
			error_template_required: 'Шаблон міндетті.',
			info_stage_created: 'Кезең нұсқасы құрылды.',
			info_user_role_updated: 'Пайдаланушы рөлі жаңартылды.',
			info_user_active_updated: 'Пайдаланушы белсенділік күйі жаңартылды.',
			col_stage: 'Кезең',
			col_dates: 'Күндер',
			col_deadline: 'Дедлайн',
			col_status: 'Күй'
		}
	};

	const copy = (): UiCopy => COPY[resolveLocale()];

	let loading = false;
	let working = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;
	let activeToken: string | null = null;

	let series: V2AdminSeries[] = [];
	let stageTemplates: V2AdminStageTemplate[] = [];
	let stageInstances: V2RoadmapItem[] = [];
	let users: PublicUser[] = [];

	let stageSeriesId = '';
	let stageTemplateId = '';
	let stageLabel = '';
	let stageDatePrecision: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN' = 'DAY';
	let stageStartsOn = '';
	let stageEndsOn = '';
	let stageRegistrationDeadline = '';
	let stageLocationText = '';
	let stageFormat: 'online' | 'offline' | 'hybrid' = 'offline';

	let userSearch = '';
	let userActiveFilter: 'all' | 'true' | 'false' = 'all';
	let userRoleDrafts: Record<number, UserRole> = {};
	let userActiveDrafts: Record<number, boolean> = {};

	const stageTitle = (item: V2RoadmapItem): string =>
		[item.stage_template_name_ru, item.label].filter((value) => value && value.trim().length > 0).join(' - ');

	const userFiltersQuery = () => ({
		search: userSearch.trim() || undefined,
		is_active:
			userActiveFilter === 'all' ? null : userActiveFilter === 'true' ? true : userActiveFilter === 'false' ? false : null,
		limit: 200
	});

	const loadAll = async (token: string) => {
		loading = true;
		errorMessage = null;
		try {
			const [seriesResponse, templatesResponse, stagesResponse, usersResponse] = await Promise.all([
				api.getAdminSeriesV2(token, { limit: 300 }),
				api.getAdminStageTemplatesV2(token),
				api.getAdminStageInstancesV2(token, { limit: 300 }),
				api.getAdminUsersV2(token, userFiltersQuery())
			]);

			series = seriesResponse.items;
			stageTemplates = templatesResponse.items;
			stageInstances = stagesResponse.items;
			users = usersResponse.items;

			if (!stageSeriesId && series.length > 0) {
				stageSeriesId = series[0].id;
			}
			if (!stageTemplateId && stageTemplates.length > 0) {
				stageTemplateId = stageTemplates[0].id;
			}

			const nextRoleDrafts: Record<number, UserRole> = {};
			const nextActiveDrafts: Record<number, boolean> = {};
			for (const user of users) {
				nextRoleDrafts[user.id] = user.role;
				nextActiveDrafts[user.id] = user.is_active;
			}
			userRoleDrafts = nextRoleDrafts;
			userActiveDrafts = nextActiveDrafts;
		} catch (error) {
			errorMessage = getErrorMessage(error);
			series = [];
			stageTemplates = [];
			stageInstances = [];
			users = [];
		} finally {
			loading = false;
		}
	};

	const onRefresh = async () => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}
		await loadAll(token);
	};

	const onCreateStageInstance = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}
		if (!stageSeriesId) {
			errorMessage = copy().error_series_required;
			return;
		}
		if (!stageTemplateId) {
			errorMessage = copy().error_template_required;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.createAdminStageInstanceV2(token, {
				series_id: stageSeriesId,
				stage_template_id: stageTemplateId,
				label: stageLabel.trim() || null,
				date_precision: stageDatePrecision,
				starts_on: stageStartsOn || null,
				ends_on: stageEndsOn || null,
				registration_deadline: stageRegistrationDeadline || null,
				location_text: stageLocationText.trim() || null,
				format: stageFormat,
				is_seed: false
			});
			infoMessage = copy().info_stage_created;
			stageLabel = '';
			stageStartsOn = '';
			stageEndsOn = '';
			stageRegistrationDeadline = '';
			stageLocationText = '';
			await loadAll(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onUpdateUserRole = async (userId: number) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const role = userRoleDrafts[userId];
		if (!role) {
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.patchAdminUserRoleV2(token, userId, role);
			infoMessage = copy().info_user_role_updated;
			await loadAll(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onUpdateUserActive = async (userId: number) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.patchAdminUserActiveV2(token, userId, Boolean(userActiveDrafts[userId]));
			infoMessage = copy().info_user_active_updated;
			await loadAll(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onUserSearch = async (event: SubmitEvent) => {
		event.preventDefault();
		await onRefresh();
	};

	onMount(() => {
		const syncFromSession = () => {
			const token = currentToken();
			if (!token) {
				activeToken = null;
				series = [];
				stageTemplates = [];
				stageInstances = [];
				users = [];
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadAll(token);
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
	<section class="page-panel"><p class="page-subtitle">{copy().sign_in_required}</p></section>
{:else if $session.user?.role !== 'admin'}
	<section class="page-panel"><p class="page-subtitle">{copy().admin_required}</p></section>
{:else}
	<section class="page-panel">
		<div class="row-head">
			<h2>{copy().series_title}</h2>
			<button class="btn-secondary" type="button" on:click={onRefresh} disabled={loading || working}
				>{copy().refresh}</button
			>
		</div>
		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else}
			<div class="grid-auto simple-grid">
				{#each series as item (item.id)}
					<article class="surface-card simple-card">
						<h3>{item.abbr ?? item.id}</h3>
						<p>{item.name_ru}</p>
						<p>{eventTypeLabel(item.event_type)} - {item.level}</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="page-panel">
		<header class="section-heading"><h2>{copy().create_stage}</h2></header>
		<form class="grid-auto stage-form" on:submit={onCreateStageInstance}>
			<label>
				<span>{copy().series}</span>
				<select bind:value={stageSeriesId}>
					<option value="">{copy().none}</option>
					{#each series as item (item.id)}
						<option value={item.id}>{item.abbr ?? item.name_ru}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().template}</span>
				<select bind:value={stageTemplateId}>
					<option value="">{copy().none}</option>
					{#each stageTemplates as template (template.id)}
						<option value={template.id}>{template.name_ru}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>{copy().label}</span>
				<input bind:value={stageLabel} />
			</label>
			<label>
				<span>{copy().date_precision}</span>
				<select bind:value={stageDatePrecision}>
					<option value="DAY">DAY</option>
					<option value="RANGE">RANGE</option>
					<option value="MONTH">MONTH</option>
					<option value="UNKNOWN">UNKNOWN</option>
				</select>
			</label>
			<label>
				<span>{copy().starts_on}</span>
				<input bind:value={stageStartsOn} type="date" />
			</label>
			<label>
				<span>{copy().ends_on}</span>
				<input bind:value={stageEndsOn} type="date" />
			</label>
			<label>
				<span>{copy().registration_deadline}</span>
				<input bind:value={stageRegistrationDeadline} type="date" />
			</label>
			<label>
				<span>{copy().location_text}</span>
				<input bind:value={stageLocationText} />
			</label>
			<label>
				<span>{copy().format}</span>
				<select bind:value={stageFormat}>
					<option value="offline">offline</option>
					<option value="online">online</option>
					<option value="hybrid">hybrid</option>
				</select>
			</label>
			<div class="actions">
				<button class="btn-primary" type="submit" disabled={loading || working}>{copy().save}</button>
			</div>
		</form>
	</section>

	<section class="page-panel">
		<header class="section-heading"><h2>{copy().stage_instances_title}</h2></header>
		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else}
			<div class="grid-auto stages-grid">
				{#each stageInstances as item (item.id)}
					<article class="surface-card stage-card">
						<h3>{stageTitle(item)}</h3>
						<p><strong>{copy().col_stage}:</strong> {item.series_abbr ?? item.series_name_ru}</p>
						<p>
							<strong>{copy().col_dates}:</strong>
							{item.starts_on ? formatDate(item.starts_on) : '-'}
							{#if item.ends_on}
								- {formatDate(item.ends_on)}
							{/if}
						</p>
						<p>
							<strong>{copy().col_deadline}:</strong>
							{item.registration_deadline ? formatDate(item.registration_deadline) : '-'}
						</p>
						<p><strong>{copy().col_status}:</strong> {stageTypeLabel(item.stage_type)}</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="page-panel">
		<div class="row-head">
			<h2>{copy().users_title}</h2>
			<form class="search-form" on:submit={onUserSearch}>
				<input bind:value={userSearch} placeholder={copy().search_users} />
				<select bind:value={userActiveFilter}>
					<option value="all">{copy().active_only}: {copy().all}</option>
					<option value="true">{copy().active_only}: {copy().yes}</option>
					<option value="false">{copy().active_only}: {copy().no}</option>
				</select>
				<button class="btn-secondary" type="submit" disabled={loading || working}>{copy().refresh}</button>
			</form>
		</div>
		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else}
			<div class="grid-auto users-grid">
				{#each users as user (user.id)}
					<article class="surface-card user-card">
						<h3>{user.name}</h3>
						<p>{user.email}</p>
						<div class="field-row">
							<label>
								<span>{copy().role}</span>
								<select
									value={userRoleDrafts[user.id] ?? user.role}
									on:change={(event) => {
										const value = (event.currentTarget as HTMLSelectElement).value as UserRole;
										userRoleDrafts = { ...userRoleDrafts, [user.id]: value };
									}}
								>
									<option value="student">{roleLabel('student')}</option>
									<option value="teacher">{roleLabel('teacher')}</option>
									<option value="admin">{roleLabel('admin')}</option>
								</select>
							</label>
							<button
								class="btn-secondary"
								type="button"
								on:click={() => onUpdateUserRole(user.id)}
								disabled={working}
							>
								{copy().save}
							</button>
						</div>
						<div class="field-row">
							<label class="toggle-label">
								<span>{copy().active}</span>
								<input
									type="checkbox"
									checked={userActiveDrafts[user.id] ?? user.is_active}
									on:change={(event) => {
										const value = (event.currentTarget as HTMLInputElement).checked;
										userActiveDrafts = { ...userActiveDrafts, [user.id]: value };
									}}
								/>
							</label>
							<button
								class="btn-secondary"
								type="button"
								on:click={() => onUpdateUserActive(user.id)}
								disabled={working}
							>
								{copy().save}
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

{#if errorMessage}
	<section class="page-panel"><p class="error-banner">{errorMessage}</p></section>
{/if}
{#if infoMessage}
	<section class="page-panel"><p class="info-banner">{infoMessage}</p></section>
{/if}

<style>
	.row-head {
		display: flex;
		gap: 0.6rem;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
	}

	.row-head h2 {
		margin: 0;
	}

	.simple-grid,
	.stages-grid,
	.users-grid {
		gap: 0.7rem;
	}

	.simple-card,
	.stage-card,
	.user-card {
		display: grid;
		gap: 0.35rem;
	}

	.simple-card h3,
	.stage-card h3,
	.user-card h3,
	.simple-card p,
	.stage-card p,
	.user-card p {
		margin: 0;
	}

	.stage-form {
		gap: 0.7rem;
	}

	.stage-form label {
		display: grid;
		gap: 0.32rem;
		padding: 0.7rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.72rem;
		background: #fff;
	}

	.stage-form span,
	.field-row span {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ol-primary);
	}

	.stage-form input,
	.stage-form select,
	.search-form input,
	.search-form select,
	.field-row select {
		font: inherit;
		min-height: 2.3rem;
		padding: 0.44rem 0.55rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.56rem;
	}

	.actions {
		display: flex;
		align-items: center;
	}

	.search-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.45rem;
		align-items: end;
	}

	.field-row label {
		display: grid;
		gap: 0.3rem;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	@media (min-width: 980px) {
		.stage-form {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.actions {
			grid-column: span 3;
		}
	}
</style>
