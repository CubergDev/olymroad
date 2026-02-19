<script lang="ts">
	import { onMount } from 'svelte';
	import { api, getErrorMessage, type NotificationItem } from '$lib/api';
	import { formatDateTime, notificationTypeLabel, resolveLocale } from '$lib/i18n';
	import { session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		feed_eyebrow: string;
		feed_title: string;
		unread_only: string;
		refresh: string;
		total: string;
		unread: string;
		loading: string;
		no_items: string;
		unread_badge: string;
		mark_as_read: string;
		error_sign_in_first: string;
		info_marked_prefix: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Notifications | OlymRoad',
			meta_description: 'Deadline alerts, teacher comments, results, and reminders in one feed.',
			hero_eyebrow: 'Notifications',
			hero_title: 'Deadline, result, and coaching signals in one feed',
			hero_subtitle:
				'Notification center shows key events: upcoming deadlines, teacher comments, added results, and reminders.',
			sign_in_required: 'Sign in to load notifications.',
			feed_eyebrow: 'Feed',
			feed_title: 'Unread first, then history',
			unread_only: 'Unread only',
			refresh: 'Refresh',
			total: 'Total',
			unread: 'Unread',
			loading: 'Loading notifications...',
			no_items: 'No notifications found.',
			unread_badge: 'Unread',
			mark_as_read: 'Mark as read',
			error_sign_in_first: 'Sign in first.',
			info_marked_prefix: 'Notification marked as read'
		},
		ru: {
			meta_title: 'Уведомления | OlymRoad',
			meta_description:
				'Сигналы о дедлайнах, комментариях, результатах и напоминаниях в единой ленте.',
			hero_eyebrow: 'Уведомления',
			hero_title: 'Дедлайны, результаты и сигналы наставника в одной ленте',
			hero_subtitle:
				'Центр уведомлений показывает ключевые события: дедлайны, комментарии учителя, добавленные результаты и напоминания.',
			sign_in_required: 'Войдите, чтобы загрузить уведомления.',
			feed_eyebrow: 'Лента',
			feed_title: 'Сначала непрочитанные, затем история',
			unread_only: 'Только непрочитанные',
			refresh: 'Обновить',
			total: 'Всего',
			unread: 'Непрочитано',
			loading: 'Загрузка уведомлений...',
			no_items: 'Уведомления не найдены.',
			unread_badge: 'Непрочитано',
			mark_as_read: 'Отметить как прочитанное',
			error_sign_in_first: 'Сначала выполните вход.',
			info_marked_prefix: 'Уведомление отмечено как прочитанное'
		},
		kz: {
			meta_title: 'Хабарламалар | OlymRoad',
			meta_description: 'Дедлайн, мұғалім пікірі, нәтиже және еске салулар бір лентада.',
			hero_eyebrow: 'Хабарламалар',
			hero_title: 'Дедлайн, нәтиже және жетекші сигналдары бір лентада',
			hero_subtitle:
				'Хабарлама орталығы негізгі оқиғаларды көрсетеді: дедлайндар, мұғалім пікірі, қосылған нәтижелер және еске салулар.',
			sign_in_required: 'Хабарламаларды көру үшін жүйеге кіріңіз.',
			feed_eyebrow: 'Лента',
			feed_title: 'Алдымен оқылмаған, кейін тарих',
			unread_only: 'Тек оқылмаған',
			refresh: 'Жаңарту',
			total: 'Жалпы',
			unread: 'Оқылмаған',
			loading: 'Хабарламалар жүктелуде...',
			no_items: 'Хабарламалар табылмады.',
			unread_badge: 'Оқылмаған',
			mark_as_read: 'Оқылды деп белгілеу',
			error_sign_in_first: 'Алдымен жүйеге кіріңіз.',
			info_marked_prefix: 'Хабарлама оқылды деп белгіленді'
		}
	};

	let loading = $state(false);
	let working = $state(false);
	let errorMessage = $state<string | null>(null);
	let infoMessage = $state<string | null>(null);

	let unreadOnly = $state(false);
	let notifications = $state<NotificationItem[]>([]);
	let totalCount = $state(0);
	let unreadCount = $state(0);
	let activeToken = $state(null as string | null);

	const copy = (): UiCopy => COPY[resolveLocale()];

	const loadNotifications = async (token: string) => {
		loading = true;
		errorMessage = null;
		try {
			const response = await api.getNotifications(token, {
				unread_only: unreadOnly,
				limit: 100,
				offset: 0
			});
			notifications = response.items;
			totalCount = response.summary.total_count;
			unreadCount = response.summary.unread_count;
		} catch (error) {
			errorMessage = getErrorMessage(error);
			notifications = [];
		} finally {
			loading = false;
		}
	};

	const onToggleUnread = async () => {
		const token = activeToken;
		if (!token) {
			return;
		}
		await loadNotifications(token);
	};

	const onMarkRead = async (notificationId: number) => {
		const token = activeToken;
		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.markNotificationRead(token, notificationId);
			infoMessage = `${copy().info_marked_prefix} #${notificationId}.`;
			await loadNotifications(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	onMount(() => {
		const syncFromSession = (token: string | null) => {
			if (!token) {
				activeToken = null;
				notifications = [];
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadNotifications(token);
		};

		const unsubscribe = session.subscribe((state) => {
			syncFromSession(state.token);
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

{#if !activeToken}
	<section class="page-panel">
		<p class="page-subtitle">{copy().sign_in_required}</p>
	</section>
{:else}
	<section class="page-panel">
		<header class="section-heading">
			<p>{copy().feed_eyebrow}</p>
			<h2>{copy().feed_title}</h2>
		</header>
		<div class="feed-controls">
			<label class="check-filter">
				<span>{copy().unread_only}</span>
				<input bind:checked={unreadOnly} type="checkbox" onchange={onToggleUnread} />
			</label>
			<button
				class="btn-secondary"
				type="button"
				onclick={() => activeToken && loadNotifications(activeToken)}
				disabled={loading || working}
			>
				{copy().refresh}
			</button>
		</div>
		<div class="feed-stats" role="status" aria-live="polite">
			<p class="stat-chip">
				<span>{copy().total}</span>
				<strong>{totalCount}</strong>
			</p>
			<p class="stat-chip">
				<span>{copy().unread}</span>
				<strong>{unreadCount}</strong>
			</p>
		</div>

		{#if loading}
			<p class="page-subtitle">{copy().loading}</p>
		{:else if notifications.length === 0}
			<p class="page-subtitle">{copy().no_items}</p>
		{:else}
			<div class="feed-list">
				{#each notifications as note (note.id)}
					<article class="surface-card feed-item" data-unread={!note.is_read}>
						<div class="feed-head">
							<div class="pill-row">
								<span class="pill" data-tone="primary">{notificationTypeLabel(note.type)}</span>
								{#if !note.is_read}
									<span class="pill unread-pill">{copy().unread_badge}</span>
								{/if}
							</div>
							<small>{formatDateTime(note.created_at)}</small>
						</div>
						<h3 class="feed-item-title">{note.title}</h3>
						<p class="feed-item-body">{note.body}</p>
						<div class="feed-item-actions">
							{#if !note.is_read}
								<button
									class="btn-secondary"
									type="button"
									onclick={() => onMarkRead(note.id)}
									disabled={working}
								>
									{copy().mark_as_read}
								</button>
							{/if}
						</div>
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
	.feed-controls {
		display: grid;
		gap: 0.65rem;
		margin: 0.35rem 0 0.5rem;
	}

	.feed-controls .btn-secondary {
		width: 100%;
	}

	.feed-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
		margin-bottom: 0.3rem;
	}

	.stat-chip {
		display: grid;
		gap: 0.12rem;
		margin: 0;
		padding: 0.55rem 0.65rem;
		border-radius: 0.75rem;
		border: 1px solid var(--ol-border);
		background: #fff;
	}

	.stat-chip span {
		font-size: 0.76rem;
		color: var(--ol-ink-soft);
	}

	.stat-chip strong {
		font-size: 1.05rem;
		line-height: 1.1;
	}

	.feed-list {
		display: grid;
		gap: 0.85rem;
	}

	.feed-item {
		display: grid;
		gap: 0.55rem;
		align-content: start;
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			transform 0.18s ease;
	}

	.feed-item[data-unread='true'] {
		border-color: var(--ol-border-strong);
		box-shadow: 0 14px 28px rgba(95, 90, 186, 0.11);
	}

	.feed-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: space-between;
	}

	.feed-head small {
		color: var(--ol-ink-soft);
		font-size: 0.76rem;
		line-height: 1.25;
	}

	.feed-item-title {
		margin: 0;
		font-size: clamp(1.03rem, 1.4vw, 1.14rem);
		line-height: 1.3;
	}

	.feed-item-body {
		margin: 0;
		color: var(--ol-ink-soft);
		line-height: 1.45;
		word-break: break-word;
	}

	.feed-item-actions {
		display: flex;
	}

	.feed-item-actions button {
		width: 100%;
	}

	.unread-pill {
		border-color: rgba(95, 90, 186, 0.3);
		background: rgba(95, 90, 186, 0.12);
		color: var(--ol-primary);
	}

	.check-filter {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		border-radius: 0.7rem;
		border: 1px solid var(--ol-border);
		background: #fff;
	}

	.check-filter input {
		inline-size: 1rem;
		block-size: 1rem;
	}

	button {
		cursor: pointer;
	}

	@media (min-width: 36rem) {
		.feed-controls {
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
		}

		.feed-controls .btn-secondary {
			width: auto;
		}

		.feed-item-actions {
			justify-content: flex-end;
		}

		.feed-item-actions button {
			width: auto;
		}
	}

	@media (min-width: 64rem) {
		.feed-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
