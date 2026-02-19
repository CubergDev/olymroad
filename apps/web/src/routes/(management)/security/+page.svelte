<svelte:options runes={false} />

<script lang="ts">
	import { resolve } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { api, getErrorMessage, type MeSecurityResponse, type SecurityPasskey } from '$lib/api';
	import { resolveLocale } from '$lib/i18n';
	import { OAuthPopupError, startGoogleOAuth } from '$lib/oauth';
	import { currentToken, session } from '$lib/session';

	type Provider = 'google';

	type ProviderView = {
		linked: boolean;
		providerAccountId: string | null;
		linkedAt: string | null;
	};

	type SecurityView = {
		hasPassword: boolean;
		passkeys: SecurityPasskey[];
		oauth: Record<Provider, ProviderView>;
	};

	type UiCopy = {
		security_section: string;
		security_title: string;
		security_subtitle: string;
		refresh: string;
		loading: string;
		sign_in_required: string;
		signed_in_as: string;
		email_change_title: string;
		new_email: string;
		email_code: string;
		send_code: string;
		resend_code: string;
		verify_email_change: string;
		email_required: string;
		email_invalid: string;
		code_required: string;
		email_code_sent: string;
		email_changed: string;
		password_title: string;
		current_password: string;
		new_password: string;
		password_min_length: string;
		update_password: string;
		password_updated: string;
		passkeys_title: string;
		add_passkey: string;
		no_passkeys: string;
		remove_passkey: string;
		passkey_added: string;
		passkey_removed: string;
		passkey_not_supported: string;
		passkey_options_invalid: string;
		linked_accounts_title: string;
		linked: string;
		not_linked: string;
		link: string;
		unlink: string;
		google_not_configured: string;
		google_popup_blocked: string;
		google_popup_closed: string;
		google_popup_timeout: string;
		google_provider_error: string;
		google_invalid_response: string;
		provider_linked: string;
		provider_unlinked: string;
		created_at: string;
		last_used: string;
		not_available: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			security_section: 'Security',
			security_title: 'Security settings',
			security_subtitle: 'Manage sign-in methods, email, and password.',
			refresh: 'Refresh',
			loading: 'Loading security state...',
			sign_in_required: 'Sign in to manage account security.',
			signed_in_as: 'Signed in as',
			email_change_title: 'Change email',
			new_email: 'New email',
			email_code: 'Verification code',
			send_code: 'Send code',
			resend_code: 'Resend code',
			verify_email_change: 'Verify and change email',
			email_required: 'Email is required.',
			email_invalid: 'Enter a valid email address.',
			code_required: 'Verification code is required.',
			email_code_sent: 'Verification code sent to the new email.',
			email_changed: 'Email address updated.',
			password_title: 'Change password',
			current_password: 'Current password',
			new_password: 'New password',
			password_min_length: 'New password must be at least 8 characters.',
			update_password: 'Update password',
			password_updated: 'Password updated.',
			passkeys_title: 'Passkeys',
			add_passkey: 'Add passkey',
			no_passkeys: 'No passkeys linked yet.',
			remove_passkey: 'Remove',
			passkey_added: 'Passkey added.',
			passkey_removed: 'Passkey removed.',
			passkey_not_supported: 'Passkeys are not supported in this browser.',
			passkey_options_invalid: 'Invalid passkey options returned by server.',
			linked_accounts_title: 'Linked OAuth accounts',
			linked: 'Linked',
			not_linked: 'Not linked',
			link: 'Link',
			unlink: 'Unlink',
			google_not_configured: 'Google OAuth is not configured.',
			google_popup_blocked: 'Browser blocked the Google sign-in popup.',
			google_popup_closed: 'Google sign-in popup was closed before completion.',
			google_popup_timeout: 'Google sign-in timed out. Please try again.',
			google_provider_error: 'Google returned an authentication error.',
			google_invalid_response: 'Google did not return a valid token.',
			provider_linked: 'OAuth account linked.',
			provider_unlinked: 'OAuth account unlinked.',
			created_at: 'Created',
			last_used: 'Last used',
			not_available: 'n/a'
		},
		ru: {
			security_section: 'Безопасность',
			security_title: 'Настройки безопасности',
			security_subtitle: 'Управляйте способами входа, email и паролем.',
			refresh: 'Обновить',
			loading: 'Загрузка состояния безопасности...',
			sign_in_required: 'Войдите, чтобы управлять безопасностью аккаунта.',
			signed_in_as: 'Вы вошли как',
			email_change_title: 'Смена email',
			new_email: 'Новый email',
			email_code: 'Код подтверждения',
			send_code: 'Отправить код',
			resend_code: 'Отправить код повторно',
			verify_email_change: 'Подтвердить и сменить email',
			email_required: 'Email обязателен.',
			email_invalid: 'Введите корректный email.',
			code_required: 'Код подтверждения обязателен.',
			email_code_sent: 'Код подтверждения отправлен на новый email.',
			email_changed: 'Email обновлен.',
			password_title: 'Сменить пароль',
			current_password: 'Текущий пароль',
			new_password: 'Новый пароль',
			password_min_length: 'Новый пароль должен быть не короче 8 символов.',
			update_password: 'Обновить пароль',
			password_updated: 'Пароль обновлен.',
			passkeys_title: 'Passkey',
			add_passkey: 'Добавить passkey',
			no_passkeys: 'Passkey пока не добавлены.',
			remove_passkey: 'Удалить',
			passkey_added: 'Passkey добавлен.',
			passkey_removed: 'Passkey удален.',
			passkey_not_supported: 'Passkey не поддерживается в этом браузере.',
			passkey_options_invalid: 'Сервер вернул некорректные параметры passkey.',
			linked_accounts_title: 'Привязанные OAuth-аккаунты',
			linked: 'Привязан',
			not_linked: 'Не привязан',
			link: 'Привязать',
			unlink: 'Отвязать',
			google_not_configured: 'Google OAuth не настроен.',
			google_popup_blocked: 'Браузер заблокировал окно входа Google.',
			google_popup_closed: 'Окно входа Google было закрыто до завершения.',
			google_popup_timeout: 'Время ожидания входа Google истекло. Повторите попытку.',
			google_provider_error: 'Google вернул ошибку аутентификации.',
			google_invalid_response: 'Google не вернул корректный токен.',
			provider_linked: 'OAuth-аккаунт привязан.',
			provider_unlinked: 'OAuth-аккаунт отвязан.',
			created_at: 'Создан',
			last_used: 'Последнее использование',
			not_available: 'н/д'
		},
		kz: {
			security_section: 'Қауіпсіздік',
			security_title: 'Қауіпсіздік баптаулары',
			security_subtitle: 'Кіру тәсілдерін, email және құпиясөзді басқарыңыз.',
			refresh: 'Жаңарту',
			loading: 'Қауіпсіздік күйі жүктелуде...',
			sign_in_required: 'Аккаунт қауіпсіздігін басқару үшін кіріңіз.',
			signed_in_as: 'Жүйеге кірген пайдаланушы',
			email_change_title: 'Email өзгерту',
			new_email: 'Жаңа email',
			email_code: 'Растау коды',
			send_code: 'Код жіберу',
			resend_code: 'Кодты қайта жіберу',
			verify_email_change: 'Растап, email өзгерту',
			email_required: 'Email міндетті.',
			email_invalid: 'Дұрыс email енгізіңіз.',
			code_required: 'Растау коды міндетті.',
			email_code_sent: 'Растау коды жаңа email мекенжайына жіберілді.',
			email_changed: 'Email жаңартылды.',
			password_title: 'Құпиясөзді өзгерту',
			current_password: 'Ағымдағы құпиясөз',
			new_password: 'Жаңа құпиясөз',
			password_min_length: 'Жаңа құпиясөз кемінде 8 таңбадан тұруы керек.',
			update_password: 'Құпиясөзді жаңарту',
			password_updated: 'Құпиясөз жаңартылды.',
			passkeys_title: 'Passkey',
			add_passkey: 'Passkey қосу',
			no_passkeys: 'Әзірге passkey қосылмаған.',
			remove_passkey: 'Өшіру',
			passkey_added: 'Passkey қосылды.',
			passkey_removed: 'Passkey өшірілді.',
			passkey_not_supported: 'Бұл браузер passkey қолдамайды.',
			passkey_options_invalid: 'Сервер passkey параметрлерін қате қайтарды.',
			linked_accounts_title: 'Байланысқан OAuth аккаунттары',
			linked: 'Байланысқан',
			not_linked: 'Байланыспаған',
			link: 'Байланыстыру',
			unlink: 'Ажырату',
			google_not_configured: 'Google OAuth бапталмаған.',
			google_popup_blocked: 'Браузер Google кіру терезесін бұғаттады.',
			google_popup_closed: 'Google кіру терезесі аяқталмай жабылды.',
			google_popup_timeout: 'Google кіру уақыты аяқталды. Қайталап көріңіз.',
			google_provider_error: 'Google аутентификация қатесін қайтарды.',
			google_invalid_response: 'Google жарамды токен қайтармады.',
			provider_linked: 'OAuth аккаунты байланыстырылды.',
			provider_unlinked: 'OAuth аккаунты ажыратылды.',
			created_at: 'Құрылған',
			last_used: 'Соңғы қолдану',
			not_available: 'жоқ'
		}
	};

	const providers: Provider[] = ['google'];
	const GOOGLE_CLIENT_ID = env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';

	let loading = false;
	let actionLoading: string | null = null;
	let errorMessage: string | null = null;
	let successMessage: string | null = null;
	let currentPassword = '';
	let newPassword = '';
	let emailCandidate = '';
	let emailOtp = '';
	let pendingEmail = '';
	let securityState: SecurityView = {
		hasPassword: true,
		passkeys: [],
		oauth: {
			google: { linked: false, providerAccountId: null, linkedAt: null }
		}
	};

	const copy = (): UiCopy => COPY[resolveLocale()];

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const toStringOrNull = (value: unknown): string | null =>
		typeof value === 'string' && value.trim().length > 0 ? value : null;

	const formatDateTime = (value: string | null): string => {
		if (!value) {
			return copy().not_available;
		}
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}
		return date.toLocaleString();
	};

	const extractPasskeyOptions = (payload: unknown): Record<string, unknown> | null => {
		if (isRecord(payload) && isRecord(payload.options)) {
			return payload.options;
		}
		if (isRecord(payload)) {
			return payload;
		}
		return null;
	};

	const normalizePasskeys = (payload: unknown): SecurityPasskey[] => {
		if (!Array.isArray(payload)) {
			return [];
		}

		return payload
			.filter(isRecord)
			.map((item): SecurityPasskey | null => {
				const idRaw =
					typeof item.id === 'number'
						? item.id
						: typeof item.id === 'string' && item.id.trim().length > 0
							? Number(item.id)
							: null;
				if (idRaw === null || !Number.isFinite(idRaw)) {
					return null;
				}
				return {
					id: Math.floor(idRaw),
					credential_id: toStringOrNull(item.credential_id) ?? '',
					transports: Array.isArray(item.transports)
						? item.transports.filter((entry): entry is string => typeof entry === 'string')
						: [],
					created_at: toStringOrNull(item.created_at),
					last_used_at: toStringOrNull(item.last_used_at)
				};
			})
			.filter((item): item is SecurityPasskey => item !== null);
	};

	const normalizeProviderView = (payload: unknown): ProviderView => {
		if (!isRecord(payload)) {
			return { linked: false, providerAccountId: null, linkedAt: null };
		}
		return {
			linked: typeof payload.linked === 'boolean' ? payload.linked : true,
			providerAccountId:
				toStringOrNull(payload.provider_account_id) ??
				toStringOrNull(payload.providerAccountId) ??
				null,
			linkedAt: toStringOrNull(payload.created_at) ?? toStringOrNull(payload.linked_at) ?? null
		};
	};

	const toSecurityView = (payload: MeSecurityResponse): SecurityView => {
		const securityPayload = isRecord(payload.security)
			? payload.security
			: (payload as unknown as Record<string, unknown>);

		const oauth: Record<Provider, ProviderView> = {
			google: { linked: false, providerAccountId: null, linkedAt: null }
		};

		if (Array.isArray(securityPayload.oauth_accounts)) {
			for (const item of securityPayload.oauth_accounts) {
				if (!isRecord(item)) {
					continue;
				}
				const provider = toStringOrNull(item.provider);
				if (provider === 'google') {
					oauth[provider] = normalizeProviderView(item);
				}
			}
		} else if (Array.isArray(payload.oauth_accounts)) {
			for (const item of payload.oauth_accounts) {
				if (!isRecord(item)) {
					continue;
				}
				const provider = toStringOrNull(item.provider);
				if (provider === 'google') {
					oauth[provider] = normalizeProviderView(item);
				}
			}
		} else if (isRecord(payload.oauth)) {
			for (const provider of providers) {
				oauth[provider] = normalizeProviderView(payload.oauth[provider]);
			}
		} else if (isRecord(payload.providers)) {
			for (const provider of providers) {
				oauth[provider] = normalizeProviderView(payload.providers[provider]);
			}
		}

		return {
			hasPassword:
				typeof securityPayload.has_password === 'boolean'
					? securityPayload.has_password
					: typeof payload.has_password === 'boolean'
						? payload.has_password
						: true,
			passkeys: normalizePasskeys(securityPayload.passkeys ?? payload.passkeys),
			oauth
		};
	};

	const loadSecurity = async () => {
		const token = currentToken();
		if (!token || !$session.user) {
			return;
		}

		loading = true;
		errorMessage = null;
		try {
			const response = await api.getMeSecurity(token);
			securityState = toSecurityView(response);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			loading = false;
		}
	};

	const looksLikeEmail = (value: string): boolean =>
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

	const normalizedEmailCandidate = (): string => emailCandidate.trim().toLowerCase();

	const resolvedEmailCandidate = (): string => {
		const current = normalizedEmailCandidate();
		if (current.length > 0) {
			return current;
		}
		return pendingEmail;
	};

	onMount(() => {
		void (async () => {
			await session.bootstrap();
			await loadSecurity();
		})();
	});

	const runAction = async (key: string, action: () => Promise<void>) => {
		actionLoading = key;
		errorMessage = null;
		successMessage = null;
		try {
			await action();
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			actionLoading = null;
		}
	};

	const onRefresh = () => {
		void loadSecurity();
	};

	const onSendEmailCode = async () => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const nextEmail = normalizedEmailCandidate();
		if (nextEmail.length === 0) {
			errorMessage = copy().email_required;
			return;
		}
		if (!looksLikeEmail(nextEmail)) {
			errorMessage = copy().email_invalid;
			return;
		}

		await runAction('email-send', async () => {
			await api.requestMyEmailChange(token, { email: nextEmail });
			pendingEmail = nextEmail;
			successMessage = copy().email_code_sent;
		});
	};

	const onResendEmailCode = async () => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const nextEmail = resolvedEmailCandidate();
		if (nextEmail.length === 0) {
			errorMessage = copy().email_required;
			return;
		}
		if (!looksLikeEmail(nextEmail)) {
			errorMessage = copy().email_invalid;
			return;
		}

		await runAction('email-resend', async () => {
			await api.resendMyEmailChange(token, { email: nextEmail });
			pendingEmail = nextEmail;
			successMessage = copy().email_code_sent;
		});
	};

	const onVerifyEmailChange = async (event: SubmitEvent) => {
		event.preventDefault();

		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		const nextEmail = resolvedEmailCandidate();
		if (nextEmail.length === 0) {
			errorMessage = copy().email_required;
			return;
		}
		const otp = emailOtp.trim();
		if (otp.length === 0) {
			errorMessage = copy().code_required;
			return;
		}

		await runAction('email-verify', async () => {
			await api.verifyMyEmailChange(token, {
				email: nextEmail,
				otp
			});
			emailCandidate = '';
			emailOtp = '';
			pendingEmail = '';
			successMessage = copy().email_changed;
			await session.refresh();
			await loadSecurity();
		});
	};

	const onChangePassword = async (event: SubmitEvent) => {
		event.preventDefault();

		if (newPassword.length < 8) {
			errorMessage = copy().password_min_length;
			return;
		}

		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		await runAction('password', async () => {
			await api.changeMyPassword(token, {
				old_password: currentPassword,
				new_password: newPassword
			});
			currentPassword = '';
			newPassword = '';
			successMessage = copy().password_updated;
			await loadSecurity();
		});
	};

	const onAddPasskey = async () => {
		if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
			errorMessage = copy().passkey_not_supported;
			return;
		}

		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		await runAction('passkey-add', async () => {
			const optionsResponse = await api.getPasskeyRegistrationOptions(token);
			const optionsJSON = extractPasskeyOptions(optionsResponse);
			if (!optionsJSON) {
				throw new Error(copy().passkey_options_invalid);
			}

			const { startRegistration } = await import('@simplewebauthn/browser');
			const credential = await startRegistration({
				optionsJSON: optionsJSON as unknown as Parameters<
					typeof startRegistration
				>[0]['optionsJSON']
			});

			await api.verifyPasskeyRegistration(token, {
				response: credential as unknown as Record<string, unknown>
			});
			successMessage = copy().passkey_added;
			await loadSecurity();
		});
	};

	const onRemovePasskey = async (passkeyId: number) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		await runAction(`passkey-remove-${passkeyId}`, async () => {
			await api.deletePasskey(token, String(passkeyId));
			successMessage = copy().passkey_removed;
			await loadSecurity();
		});
	};

	const oauthErrorMessage = (error: unknown): string => {
		if (error instanceof OAuthPopupError) {
			if (error.code === 'missing_config') {
				return copy().google_not_configured;
			}
			if (error.code === 'popup_blocked') {
				return copy().google_popup_blocked;
			}
			if (error.code === 'popup_closed') {
				return copy().google_popup_closed;
			}
			if (error.code === 'popup_timeout') {
				return copy().google_popup_timeout;
			}
			if (error.code === 'provider_error') {
				const providerDetails = error.providerErrorDescription ?? error.providerError;
				return providerDetails
					? `${copy().google_provider_error} (${providerDetails})`
					: copy().google_provider_error;
			}
			if (error.code === 'invalid_response') {
				return copy().google_invalid_response;
			}
		}
		return getErrorMessage(error);
	};

	const onLinkGoogle = async () => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		actionLoading = 'google-link';
		errorMessage = null;
		successMessage = null;
		try {
			const idToken = await startGoogleOAuth(GOOGLE_CLIENT_ID);
			await api.linkMyOAuthProvider(token, 'google', { id_token: idToken });
			successMessage = copy().provider_linked;
			await loadSecurity();
		} catch (error) {
			errorMessage = oauthErrorMessage(error);
		} finally {
			actionLoading = null;
		}
	};

	const onUnlinkProvider = async (provider: Provider) => {
		const token = currentToken();
		if (!token) {
			errorMessage = copy().sign_in_required;
			return;
		}

		await runAction(`${provider}-unlink`, async () => {
			await api.unlinkMyOAuthProvider(token, provider);
			successMessage = copy().provider_unlinked;
			await loadSecurity();
		});
	};

	const onLinkProvider = (provider: Provider) => {
		if (provider === 'google') {
			void onLinkGoogle();
		}
	};
</script>

<section class="page-panel security-panel">
	<header class="section-heading security-header">
		<div>
			<p>{copy().security_section}</p>
			<h2>{copy().security_title}</h2>
			<p class="session-meta">{copy().security_subtitle}</p>
		</div>
		<button
			class="btn-secondary"
			type="button"
			on:click={onRefresh}
			disabled={loading || actionLoading !== null}>{copy().refresh}</button
		>
	</header>

	{#if !$session.user}
		<p class="error-banner">{copy().sign_in_required}</p>
	{:else}
		<p class="session-meta">
			<a class="profile-link" href={resolve('/profile')}
				>{copy().signed_in_as}: {$session.user.email}</a
			>
		</p>

		<div class="security-grid">
			<section class="security-card">
				<h3>{copy().email_change_title}</h3>
				<form class="auth-form" on:submit={onVerifyEmailChange}>
					<label>
						<span>{copy().new_email}</span>
						<input bind:value={emailCandidate} type="email" autocomplete="email" />
					</label>
					<label>
						<span>{copy().email_code}</span>
						<input bind:value={emailOtp} inputmode="numeric" />
					</label>
					<div class="hero-actions">
						<button
							class="btn-secondary"
							type="button"
							on:click={onSendEmailCode}
							disabled={actionLoading !== null}
						>
							{copy().send_code}
						</button>
						<button
							class="btn-secondary"
							type="button"
							on:click={onResendEmailCode}
							disabled={actionLoading !== null}
						>
							{copy().resend_code}
						</button>
						<button class="btn-primary" type="submit" disabled={actionLoading !== null}>
							{copy().verify_email_change}
						</button>
					</div>
				</form>
			</section>

			<section class="security-card">
				<h3>{copy().password_title}</h3>
				<form class="auth-form" on:submit={onChangePassword}>
					<label>
						<span>{copy().current_password}</span>
						<input bind:value={currentPassword} type="password" autocomplete="current-password" />
					</label>
					<label>
						<span>{copy().new_password}</span>
						<input bind:value={newPassword} type="password" autocomplete="new-password" />
					</label>
					<div class="hero-actions">
						<button class="btn-primary" type="submit" disabled={actionLoading !== null}>
							{copy().update_password}
						</button>
					</div>
				</form>
			</section>

			<section class="security-card">
				<h3>{copy().passkeys_title}</h3>
				<div class="hero-actions">
					<button
						class="btn-secondary"
						type="button"
						on:click={onAddPasskey}
						disabled={actionLoading !== null}
					>
						{copy().add_passkey}
					</button>
				</div>

				{#if securityState.passkeys.length === 0}
					<p class="session-meta">{copy().no_passkeys}</p>
				{:else}
					<ul class="passkey-list">
						{#each securityState.passkeys as passkey (passkey.id)}
							<li class="passkey-item">
								<div>
									<p class="session-title">
										{passkey.credential_id ? `Passkey (${passkey.credential_id})` : 'Passkey'}
									</p>
									<p class="session-meta">
										{copy().created_at}: {formatDateTime(passkey.created_at)}
									</p>
									<p class="session-meta">
										{copy().last_used}: {formatDateTime(passkey.last_used_at)}
									</p>
								</div>
								<button
									class="btn-secondary"
									type="button"
									on:click={() => onRemovePasskey(passkey.id)}
									disabled={actionLoading !== null}
								>
									{copy().remove_passkey}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="security-card">
				<h3>{copy().linked_accounts_title}</h3>
				{#each providers as provider (provider)}
					<div class="provider-row">
						<div>
							<p class="session-title">Google</p>
							<p class="session-meta">
								{#if securityState.oauth[provider].linked}
									{copy().linked}
									{#if securityState.oauth[provider].providerAccountId}
										· {securityState.oauth[provider].providerAccountId}
									{/if}
								{:else}
									{copy().not_linked}
								{/if}
							</p>
						</div>
						{#if securityState.oauth[provider].linked}
							<button
								class="btn-secondary"
								type="button"
								on:click={() => onUnlinkProvider(provider)}
								disabled={actionLoading !== null}
							>
								{copy().unlink}
							</button>
						{:else}
							<button
								class="btn-secondary"
								type="button"
								on:click={() => onLinkProvider(provider)}
								disabled={actionLoading !== null}
							>
								{copy().link}
							</button>
						{/if}
					</div>
				{/each}
			</section>
		</div>
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
	.security-panel {
		display: grid;
		gap: 1.25rem;
	}

	.security-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid color-mix(in oklab, var(--text-main) 12%, transparent);
		border-radius: 1rem;
		background:
			linear-gradient(
				145deg,
				color-mix(in oklab, var(--surface-soft) 92%, white 8%),
				color-mix(in oklab, var(--surface-panel) 94%, var(--surface-soft) 6%)
			);
	}

	.security-header > div {
		min-width: 0;
		display: grid;
		gap: 0.25rem;
	}

	.security-header h2,
	.security-card h3,
	.security-panel :global(.session-title),
	.security-panel :global(.session-meta) {
		margin: 0;
	}

	.security-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		align-items: start;
	}

	.security-card {
		padding: 1rem;
		border: 1px solid color-mix(in oklab, var(--text-main) 14%, transparent);
		border-radius: 1rem;
		background:
			linear-gradient(
				150deg,
				color-mix(in oklab, var(--surface-soft) 93%, white 7%),
				color-mix(in oklab, var(--surface-panel) 96%, var(--surface-soft) 4%)
			);
		display: grid;
		gap: 0.875rem;
		min-width: 0;
		box-shadow: 0 8px 22px color-mix(in oklab, var(--text-main) 8%, transparent);
	}

	.security-card label {
		display: grid;
		gap: 0.375rem;
	}

	.security-card input {
		width: 100%;
	}

	.security-card .hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
	}

	.security-card .hero-actions > * {
		flex: 1 1 180px;
	}

	.passkey-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	.passkey-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid color-mix(in oklab, var(--text-main) 10%, transparent);
		background: color-mix(in oklab, var(--surface-soft) 88%, var(--surface-panel) 12%);
	}

	.passkey-item > div,
	.provider-row > div {
		min-width: 0;
	}

	.passkey-item .session-title {
		overflow-wrap: anywhere;
	}

	.provider-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid color-mix(in oklab, var(--text-main) 10%, transparent);
		background: color-mix(in oklab, var(--surface-soft) 88%, var(--surface-panel) 12%);
	}

	.profile-link {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.profile-link:hover {
		text-decoration-thickness: 2px;
	}

	.profile-link:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent, var(--text-main)) 65%, white 35%);
		outline-offset: 2px;
		border-radius: 0.25rem;
	}

	@media (hover: hover) {
		.security-card {
			transition: transform 0.18s ease, box-shadow 0.18s ease;
		}

		.security-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 14px 28px color-mix(in oklab, var(--text-main) 11%, transparent);
		}
	}

	@media (max-width: 720px) {
		.security-panel {
			gap: 1rem;
		}

		.security-header {
			flex-direction: column;
			align-items: stretch;
			padding: 0.875rem;
		}

		.security-header > button {
			width: 100%;
		}

		.security-grid {
			grid-template-columns: 1fr;
		}

		.security-card {
			padding: 0.875rem;
			border-radius: 0.875rem;
		}

		.security-card .hero-actions {
			flex-direction: column;
			flex-wrap: nowrap;
		}

		.security-card .hero-actions > * {
			flex: none;
			width: 100%;
		}

		.passkey-item,
		.provider-row {
			flex-direction: column;
			align-items: stretch;
		}

		.passkey-item :is(.btn-primary, .btn-secondary),
		.provider-row :is(.btn-primary, .btn-secondary) {
			width: 100%;
		}
	}
</style>
