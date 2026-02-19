<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { api, getErrorMessage } from '$lib/api';
	import { resolveLocale, roleLabel } from '$lib/i18n';
	import { OAuthPopupError, startGoogleOAuth } from '$lib/oauth';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		eyebrow: string;
		title: string;
		subtitle: string;
		redirect_notice: string;
		login_tab: string;
		register_tab: string;
		verify_email_title: string;
		verify_email_hint: string;
		otp_code_label: string;
		otp_code_placeholder: string;
		name: string;
		name_placeholder: string;
		role_label: string;
		email: string;
		password: string;
		school_optional: string;
		school_placeholder: string;
		grade_optional: string;
		locale_label: string;
		working: string;
		create_account: string;
		sign_in: string;
		or_continue_with: string;
		continue_google: string;
		sign_in_passkey: string;
		passkey_working: string;
		forgot_password_link: string;
		forgot_password_title: string;
		forgot_password_request_button: string;
		forgot_password_reset_button: string;
		new_password_label: string;
		verify_email_button: string;
		resend_otp_button: string;
		error_email_password_required: string;
		error_name_required: string;
		error_grade_integer: string;
		error_otp_required: string;
		error_oauth_google_not_configured: string;
		error_oauth_popup_blocked: string;
		error_oauth_popup_closed: string;
		error_oauth_popup_timeout: string;
		error_oauth_failed: string;
		error_passkey_not_supported: string;
		error_passkey_options_invalid: string;
		error_passkey_failed: string;
		info_registration_success: string;
		info_login_success: string;
		info_otp_sent: string;
		info_password_reset_success: string;
		info_forgot_password_sent: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'OlymRoad | Login',
			meta_description: 'Sign in or create an account to continue your olympiad journey.',
			eyebrow: 'Account Access',
			title: 'Sign in to OlymRoad',
			subtitle: 'Use email, Google, or passkey. New users can register in one card.',
			redirect_notice: 'You were redirected from a protected page.',
			login_tab: 'Login',
			register_tab: 'Register',
			verify_email_title: 'Verify your email',
			verify_email_hint: 'Enter the 6-digit code sent to your email.',
			otp_code_label: 'Verification code',
			otp_code_placeholder: '6-digit code',
			name: 'Name',
			name_placeholder: 'Your name',
			role_label: 'Role',
			email: 'Email',
			password: 'Password',
			school_optional: 'School (optional)',
			school_placeholder: 'School',
			grade_optional: 'Grade (optional)',
			locale_label: 'Locale',
			working: 'Working...',
			create_account: 'Create account',
			sign_in: 'Sign in',
			or_continue_with: 'or continue with',
			continue_google: 'Continue with Google',
			sign_in_passkey: 'Sign in with passkey',
			passkey_working: 'Checking passkey...',
			forgot_password_link: 'Forgot password?',
			forgot_password_title: 'Reset password',
			forgot_password_request_button: 'Send reset code',
			forgot_password_reset_button: 'Reset password',
			new_password_label: 'New password',
			verify_email_button: 'Verify email',
			resend_otp_button: 'Resend code',
			error_email_password_required: 'Email and password are required.',
			error_name_required: 'Name is required for registration.',
			error_grade_integer: 'Grade must be an integer.',
			error_otp_required: 'Enter the verification code.',
			error_oauth_google_not_configured: 'Google sign-in is not configured.',
			error_oauth_popup_blocked: 'OAuth popup was blocked. Allow popups and try again.',
			error_oauth_popup_closed: 'OAuth popup was closed before completion.',
			error_oauth_popup_timeout: 'OAuth sign-in timed out. Try again.',
			error_oauth_failed: 'OAuth sign-in failed.',
			error_passkey_not_supported: 'Passkeys are not supported in this browser.',
			error_passkey_options_invalid: 'Passkey options returned by server are invalid.',
			error_passkey_failed: 'Passkey sign-in failed.',
			info_registration_success: 'Registration successful. You are signed in.',
			info_login_success: 'Login successful.',
			info_otp_sent: 'Verification code sent.',
			info_password_reset_success: 'Password reset successful. Sign in with your new password.',
			info_forgot_password_sent: 'If this email exists, a reset code was sent.'
		},
		ru: {
			meta_title: 'OlymRoad | Вход',
			meta_description: 'Войдите или зарегистрируйтесь, чтобы продолжить олимпиадный путь.',
			eyebrow: 'Доступ к аккаунту',
			title: 'Вход в OlymRoad',
			subtitle: 'Используй email, Google или passkey. Регистрация доступна в этой же форме.',
			redirect_notice: 'Вы были перенаправлены с защищенной страницы.',
			login_tab: 'Вход',
			register_tab: 'Регистрация',
			verify_email_title: 'Подтвердите email',
			verify_email_hint: 'Введите 6-значный код, отправленный на ваш email.',
			otp_code_label: 'Код подтверждения',
			otp_code_placeholder: '6-значный код',
			name: 'Имя',
			name_placeholder: 'Ваше имя',
			role_label: 'Роль',
			email: 'Email',
			password: 'Пароль',
			school_optional: 'Школа (необязательно)',
			school_placeholder: 'Школа',
			grade_optional: 'Класс (необязательно)',
			locale_label: 'Язык',
			working: 'Обработка...',
			create_account: 'Создать аккаунт',
			sign_in: 'Войти',
			or_continue_with: 'или продолжить через',
			continue_google: 'Войти через Google',
			sign_in_passkey: 'Войти с passkey',
			passkey_working: 'Проверка passkey...',
			forgot_password_link: 'Забыли пароль?',
			forgot_password_title: 'Сброс пароля',
			forgot_password_request_button: 'Отправить код сброса',
			forgot_password_reset_button: 'Сбросить пароль',
			new_password_label: 'Новый пароль',
			verify_email_button: 'Подтвердить email',
			resend_otp_button: 'Отправить код снова',
			error_email_password_required: 'Email и пароль обязательны.',
			error_name_required: 'Имя обязательно для регистрации.',
			error_grade_integer: 'Класс должен быть целым числом.',
			error_otp_required: 'Введите код подтверждения.',
			error_oauth_google_not_configured: 'Вход через Google не настроен.',
			error_oauth_popup_blocked:
				'Всплывающее окно OAuth заблокировано. Разрешите pop-up и повторите попытку.',
			error_oauth_popup_closed: 'Окно OAuth было закрыто до завершения.',
			error_oauth_popup_timeout: 'Время OAuth-входа истекло. Повторите попытку.',
			error_oauth_failed: 'OAuth-вход завершился ошибкой.',
			error_passkey_not_supported: 'Passkey не поддерживается в этом браузере.',
			error_passkey_options_invalid: 'Сервер вернул некорректные параметры passkey.',
			error_passkey_failed: 'Вход по passkey завершился ошибкой.',
			info_registration_success: 'Регистрация успешна. Вы вошли в систему.',
			info_login_success: 'Вход выполнен успешно.',
			info_otp_sent: 'Код подтверждения отправлен.',
			info_password_reset_success:
				'Пароль успешно обновлен. Войдите с новым паролем.',
			info_forgot_password_sent:
				'Если такой email существует, код для сброса отправлен.'
		},
		kz: {
			meta_title: 'OlymRoad | Кіру',
			meta_description: 'Олимпиада жолын жалғастыру үшін кіріңіз немесе тіркеліңіз.',
			eyebrow: 'Аккаунтқа қолжетімділік',
			title: 'OlymRoad жүйесіне кіру',
			subtitle:
				'Email, Google немесе passkey арқылы кір. Жаңа қолданушылар осы формада тіркеле алады.',
			redirect_notice: 'Сіз қорғалған беттен қайта бағытталдыңыз.',
			login_tab: 'Кіру',
			register_tab: 'Тіркелу',
			verify_email_title: 'Email растау',
			verify_email_hint: 'Email-ға жіберілген 6 таңбалы кодты енгізіңіз.',
			otp_code_label: 'Растау коды',
			otp_code_placeholder: '6 таңбалы код',
			name: 'Аты',
			name_placeholder: 'Атыңыз',
			role_label: 'Рөл',
			email: 'Email',
			password: 'Құпиясөз',
			school_optional: 'Мектеп (міндетті емес)',
			school_placeholder: 'Мектеп',
			grade_optional: 'Сынып (міндетті емес)',
			locale_label: 'Тіл',
			working: 'Өңделуде...',
			create_account: 'Аккаунт ашу',
			sign_in: 'Кіру',
			or_continue_with: 'немесе арқылы жалғастыру',
			continue_google: 'Google арқылы кіру',
			sign_in_passkey: 'Passkey арқылы кіру',
			passkey_working: 'Passkey тексерілуде...',
			forgot_password_link: 'Құпиясөзді ұмыттыңыз ба?',
			forgot_password_title: 'Құпиясөзді қалпына келтіру',
			forgot_password_request_button: 'Қалпына келтіру кодын жіберу',
			forgot_password_reset_button: 'Құпиясөзді қалпына келтіру',
			new_password_label: 'Жаңа құпиясөз',
			verify_email_button: 'Email растау',
			resend_otp_button: 'Кодты қайта жіберу',
			error_email_password_required: 'Email мен құпиясөз міндетті.',
			error_name_required: 'Тіркелу үшін аты міндетті.',
			error_grade_integer: 'Сынып бүтін сан болуы керек.',
			error_otp_required: 'Растау кодын енгізіңіз.',
			error_oauth_google_not_configured: 'Google арқылы кіру бапталмаған.',
			error_oauth_popup_blocked:
				'OAuth қалқымалы терезесі бұғатталды. Pop-up рұқсатын беріп, қайта көріңіз.',
			error_oauth_popup_closed: 'OAuth терезесі аяқталмай тұрып жабылды.',
			error_oauth_popup_timeout: 'OAuth кіру уақыты аяқталды. Қайта көріңіз.',
			error_oauth_failed: 'OAuth арқылы кіру сәтсіз аяқталды.',
			error_passkey_not_supported: 'Бұл браузер passkey қолдамайды.',
			error_passkey_options_invalid: 'Сервер passkey параметрлерін қате қайтарды.',
			error_passkey_failed: 'Passkey арқылы кіру сәтсіз аяқталды.',
			info_registration_success: 'Тіркелу сәтті аяқталды. Жүйеге кірдіңіз.',
			info_login_success: 'Кіру сәтті аяқталды.',
			info_otp_sent: 'Растау коды жіберілді.',
			info_password_reset_success:
				'Құпиясөз сәтті жаңартылды. Жаңа құпиясөзбен кіріңіз.',
			info_forgot_password_sent:
				'Егер мұндай email бар болса, қалпына келтіру коды жіберілді.'
		}
	};

	let authMode: 'login' | 'register' = 'login';
	let authName = '';
	let authEmail = '';
	let authPassword = '';
	let authRole: 'student' | 'teacher' = 'student';
	let authSchool = '';
	let authGrade: number | null = null;
	let authLocale: 'en' | 'ru' | 'kz' = 'ru';
	let authInfoMessage: string | null = null;
	let authErrorMessage: string | null = null;
	let passkeyLoading = false;
	let verificationEmail: string | null = null;
	let verificationOtp = '';
	let forgotPasswordMode = false;
	let forgotPasswordEmail = '';
	let forgotPasswordOtp = '';
	let forgotPasswordNewPassword = '';
	let forgotPasswordCodeSent = false;
	let redirected = false;

	const GOOGLE_CLIENT_ID = env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';

	const copy = (): UiCopy => COPY[resolveLocale()];

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const extractPasskeyOptions = (payload: unknown): Record<string, unknown> | null => {
		if (isRecord(payload) && isRecord(payload.options)) {
			return payload.options;
		}
		if (isRecord(payload)) {
			return payload;
		}
		return null;
	};

	const parseGrade = (value: number | string | null): number | null => {
		if (value === null || value === undefined) {
			return null;
		}
		if (typeof value === 'number') {
			return Number.isInteger(value) ? value : null;
		}
		const normalized = value.trim();
		if (normalized.length === 0) {
			return null;
		}
		const parsed = Number(normalized);
		if (!Number.isInteger(parsed)) {
			return null;
		}
		return parsed;
	};

	const resetAuthForm = () => {
		authName = '';
		authEmail = '';
		authPassword = '';
		authRole = 'student';
		authSchool = '';
		authGrade = null;
		authLocale = 'ru';
		verificationOtp = '';
	};

	const defaultRouteAfterAuth = (): string => '/profile';

	const resolveRedirectTarget = (): string => {
		const redirectTo = page.url.searchParams.get('redirect_to');
		if (!redirectTo || !redirectTo.startsWith('/')) {
			return defaultRouteAfterAuth();
		}
		if (redirectTo.startsWith('/login')) {
			return defaultRouteAfterAuth();
		}
		return redirectTo;
	};

	const redirectAfterAuth = async () => {
		const target = resolveRedirectTarget();
		await goto(resolve(localizeHref(target) as '/'), { replaceState: true });
	};

	onMount(() => {
		void session.bootstrap();
	});

	$: if ($session.initialized && $session.user && !redirected) {
		redirected = true;
		void redirectAfterAuth();
	}

	const onSubmitAuth = async (event: SubmitEvent) => {
		event.preventDefault();
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();

		if (!authEmail || !authPassword) {
			authErrorMessage = copy().error_email_password_required;
			return;
		}

		if (authMode === 'register') {
			if (!authName.trim()) {
				authErrorMessage = copy().error_name_required;
				return;
			}

			const grade = parseGrade(authGrade);
			if (authGrade !== null && grade === null) {
				authErrorMessage = copy().error_grade_integer;
				return;
			}

			try {
				const result = await session.register({
					name: authName.trim(),
					email: authEmail.trim().toLowerCase(),
					password: authPassword,
					role: authRole,
					school: authSchool.trim().length > 0 ? authSchool.trim() : null,
					grade,
					locale: authLocale
				});
				if (result.status === 'authenticated') {
					authInfoMessage = copy().info_registration_success;
					resetAuthForm();
					await redirectAfterAuth();
					return;
				}

				verificationEmail = result.email;
				verificationOtp = '';
				authInfoMessage = copy().info_otp_sent;
			} catch (error) {
				authErrorMessage = getErrorMessage(error);
				session.clearError();
			}
			return;
		}

		try {
			await session.login({
				email: authEmail.trim().toLowerCase(),
				password: authPassword
			});
			authInfoMessage = copy().info_login_success;
			resetAuthForm();
			await redirectAfterAuth();
		} catch (error) {
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		}
	};

	const oauthSuccessMessage = (): string =>
		authMode === 'register' ? copy().info_registration_success : copy().info_login_success;

	const buildOAuthProfileInput = (): {
		role?: 'student' | 'teacher';
		school?: string | null;
		grade?: number | null;
		locale?: 'en' | 'ru' | 'kz';
		name?: string | null;
	} | null => {
		const locale = authMode === 'register' ? authLocale : resolveLocale();
		if (authMode !== 'register') {
			return { locale };
		}

		const grade = parseGrade(authGrade);
		if (authGrade !== null && grade === null) {
			authErrorMessage = copy().error_grade_integer;
			return null;
		}

		return {
			role: authRole,
			school: authSchool.trim().length > 0 ? authSchool.trim() : null,
			grade,
			locale,
			name: authName.trim().length > 0 ? authName.trim() : null
		};
	};

	const oauthErrorMessage = (error: unknown): string => {
		if (error instanceof OAuthPopupError) {
			if (error.code === 'missing_config') {
				return copy().error_oauth_google_not_configured;
			}
			if (error.code === 'popup_blocked') {
				return copy().error_oauth_popup_blocked;
			}
			if (error.code === 'popup_closed') {
				return copy().error_oauth_popup_closed;
			}
			if (error.code === 'popup_timeout') {
				return copy().error_oauth_popup_timeout;
			}
			if (error.code === 'provider_error') {
				return error.providerErrorDescription || copy().error_oauth_failed;
			}
			return copy().error_oauth_failed;
		}
		return getErrorMessage(error);
	};

	const onGoogleOAuth = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();

		const oauthProfile = buildOAuthProfileInput();
		if (!oauthProfile) {
			return;
		}

		try {
			const idToken = await startGoogleOAuth(GOOGLE_CLIENT_ID);
			await session.oauthGoogle({
				idToken,
				role: oauthProfile.role,
				school: oauthProfile.school,
				grade: oauthProfile.grade,
				locale: oauthProfile.locale,
				name: oauthProfile.name
			});
			authInfoMessage = oauthSuccessMessage();
			resetAuthForm();
			await redirectAfterAuth();
		} catch (error) {
			authErrorMessage = oauthErrorMessage(error);
			session.clearError();
		}
	};

	const onVerifyEmailOtp = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();
		const email = verificationEmail?.trim().toLowerCase() ?? '';
		const otp = verificationOtp.trim();
		if (!email || !otp) {
			authErrorMessage = copy().error_otp_required;
			return;
		}

		try {
			await session.verifyEmailOtp({ email, otp });
			verificationEmail = null;
			verificationOtp = '';
			authInfoMessage = copy().info_registration_success;
			await redirectAfterAuth();
		} catch (error) {
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		}
	};

	const onResendVerificationOtp = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();
		const email = verificationEmail?.trim().toLowerCase() ?? authEmail.trim().toLowerCase();
		if (!email) {
			authErrorMessage = copy().error_email_password_required;
			return;
		}

		try {
			await session.resendEmailOtp({ email });
			authInfoMessage = copy().info_otp_sent;
		} catch (error) {
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		}
	};

	const onForgotPasswordRequest = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();
		const email = forgotPasswordEmail.trim().toLowerCase();
		if (!email) {
			authErrorMessage = copy().error_email_password_required;
			return;
		}

		try {
			await session.forgotPassword({ email });
			forgotPasswordCodeSent = true;
			authInfoMessage = copy().info_forgot_password_sent;
		} catch (error) {
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		}
	};

	const onForgotPasswordReset = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();
		const email = forgotPasswordEmail.trim().toLowerCase();
		const otp = forgotPasswordOtp.trim();
		const newPassword = forgotPasswordNewPassword;
		if (!email || !otp || !newPassword) {
			authErrorMessage = copy().error_email_password_required;
			return;
		}

		try {
			await session.resetPassword({ email, otp, newPassword });
			forgotPasswordMode = false;
			forgotPasswordCodeSent = false;
			forgotPasswordOtp = '';
			forgotPasswordNewPassword = '';
			authInfoMessage = copy().info_password_reset_success;
		} catch (error) {
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		}
	};

	const onPasskeyLogin = async () => {
		authInfoMessage = null;
		authErrorMessage = null;
		session.clearError();
		const normalizedEmail = authEmail.trim().toLowerCase();

		if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
			authErrorMessage = copy().error_passkey_not_supported;
			return;
		}

		passkeyLoading = true;
		try {
			const optionsResponse = await api.getPasskeyAuthenticationOptions(
				normalizedEmail.length > 0 ? { email: normalizedEmail } : undefined
			);
			const optionsJSON = extractPasskeyOptions(optionsResponse);
			if (!optionsJSON) {
				authErrorMessage = copy().error_passkey_options_invalid;
				return;
			}

			const { startAuthentication } = await import('@simplewebauthn/browser');
			const credential = await startAuthentication({
				optionsJSON: optionsJSON as unknown as Parameters<
					typeof startAuthentication
				>[0]['optionsJSON']
			});

			await session.loginWithPasskey(
				normalizedEmail.length > 0
					? {
							response: credential as unknown as Record<string, unknown>,
							email: normalizedEmail
						}
					: { response: credential as unknown as Record<string, unknown> }
			);
			authInfoMessage = copy().info_login_success;
			resetAuthForm();
			await redirectAfterAuth();
		} catch (error) {
			if (error instanceof Error && error.name === 'NotAllowedError') {
				authErrorMessage = copy().error_passkey_failed;
				session.clearError();
				return;
			}
			authErrorMessage = getErrorMessage(error);
			session.clearError();
		} finally {
			passkeyLoading = false;
		}
	};
</script>

<svelte:head>
	<title>{copy().meta_title}</title>
	<meta name="description" content={copy().meta_description} />
</svelte:head>

<section class="auth-page">
	<div class="auth-ambient auth-ambient-a"></div>
	<div class="auth-ambient auth-ambient-b"></div>

	<article class="page-panel auth-card reveal">
		<header class="auth-head">
			<p class="page-eyebrow">{copy().eyebrow}</p>
			<h1>{copy().title}</h1>
			<p>{copy().subtitle}</p>
			{#if page.url.searchParams.get('redirect_to')}
				<p class="auth-redirect-note">{copy().redirect_notice}</p>
			{/if}
		</header>

		<form class="auth-form" on:submit={onSubmitAuth}>
			<div class="auth-mode-switch">
				<button
					type="button"
					class="auth-mode-link"
					on:click={() => {
						authMode = 'login';
						authInfoMessage = null;
						authErrorMessage = null;
						session.clearError();
						forgotPasswordMode = false;
						verificationEmail = null;
						verificationOtp = '';
					}}
					data-active={authMode === 'login'}>{copy().login_tab}</button
				>
				<span class="auth-mode-separator" aria-hidden="true">|</span>
				<button
					type="button"
					class="auth-mode-link"
					on:click={() => {
						authMode = 'register';
						authInfoMessage = null;
						authErrorMessage = null;
						session.clearError();
						forgotPasswordMode = false;
						forgotPasswordCodeSent = false;
						forgotPasswordOtp = '';
						forgotPasswordNewPassword = '';
					}}
					data-active={authMode === 'register'}>{copy().register_tab}</button
				>
			</div>

			<div class="grid-2 auth-grid">
				{#if authMode === 'register'}
					<label>
						<span>{copy().name}</span>
						<input bind:value={authName} placeholder={copy().name_placeholder} />
					</label>
					<label>
						<span>{copy().role_label}</span>
						<select bind:value={authRole}>
							<option value="student">{roleLabel('student')}</option>
							<option value="teacher">{roleLabel('teacher')}</option>
						</select>
					</label>
				{/if}

				<label>
					<span>{copy().email}</span>
					<input bind:value={authEmail} type="email" autocomplete="username webauthn" />
				</label>
				<label>
					<span>{copy().password}</span>
					<input
						bind:value={authPassword}
						type="password"
						autocomplete={authMode === 'register' ? 'new-password' : 'current-password'}
					/>
				</label>

				{#if authMode === 'register'}
					<label>
						<span>{copy().school_optional}</span>
						<input bind:value={authSchool} placeholder={copy().school_placeholder} />
					</label>
					<label>
						<span>{copy().grade_optional}</span>
						<input bind:value={authGrade} type="number" min="1" max="12" />
					</label>
					<label class="auth-span-full">
						<span>{copy().locale_label}</span>
						<select bind:value={authLocale}>
							<option value="ru">RU</option>
							<option value="en">EN</option>
							<option value="kz">KZ</option>
						</select>
					</label>
				{/if}
			</div>

			<div class="hero-actions">
				<button class="auth-action-link auth-action-submit" type="submit" disabled={$session.loading}>
					{#if $session.loading}
						{copy().working}
					{:else if authMode === 'register'}
						{copy().create_account}
					{:else}
						{copy().sign_in}
					{/if}
				</button>
			</div>

			{#if authErrorMessage || $session.error}
				<p class="error-inline">{authErrorMessage ?? $session.error}</p>
			{/if}
			{#if authInfoMessage}
				<p class="info-banner">{authInfoMessage}</p>
			{/if}

			{#if verificationEmail}
				<div class="grid-2 auth-grid otp-grid">
					<label>
						<span>{copy().verify_email_title}</span>
						<p class="otp-hint">{copy().verify_email_hint} {verificationEmail}</p>
						<input bind:value={verificationOtp} placeholder={copy().otp_code_placeholder} maxlength="6" />
					</label>
					<div class="hero-actions otp-actions">
						<button
							class="auth-action-link auth-action-submit"
							type="button"
							on:click={onVerifyEmailOtp}
							disabled={$session.loading}
						>
							{copy().verify_email_button}
						</button>
						<button
							class="auth-action-link"
							type="button"
							on:click={onResendVerificationOtp}
							disabled={$session.loading}
						>
							{copy().resend_otp_button}
						</button>
					</div>
				</div>
			{/if}

			{#if authMode === 'login'}
				<div class="hero-actions">
					<button
						class="auth-action-link auth-action-subtle"
						type="button"
						on:click={() => {
							forgotPasswordMode = !forgotPasswordMode;
							authInfoMessage = null;
							authErrorMessage = null;
							session.clearError();
						}}
						disabled={$session.loading || passkeyLoading}
					>
						{copy().forgot_password_link}
					</button>
				</div>
			{/if}

			{#if authMode === 'login' && forgotPasswordMode}
				<div class="grid-2 auth-grid otp-grid">
					<label>
						<span>{copy().forgot_password_title}</span>
						<input bind:value={forgotPasswordEmail} type="email" autocomplete="email" />
					</label>

					{#if forgotPasswordCodeSent}
						<label>
							<span>{copy().otp_code_label}</span>
							<input bind:value={forgotPasswordOtp} placeholder={copy().otp_code_placeholder} maxlength="6" />
						</label>
						<label>
							<span>{copy().new_password_label}</span>
							<input
								bind:value={forgotPasswordNewPassword}
								type="password"
								autocomplete="new-password"
							/>
						</label>
					{/if}

					<div class="hero-actions otp-actions">
						{#if forgotPasswordCodeSent}
							<button
								class="auth-action-link auth-action-submit"
								type="button"
								on:click={onForgotPasswordReset}
								disabled={$session.loading || passkeyLoading}
							>
								{copy().forgot_password_reset_button}
							</button>
						{:else}
							<button
								class="auth-action-link auth-action-submit"
								type="button"
								on:click={onForgotPasswordRequest}
								disabled={$session.loading || passkeyLoading}
							>
								{copy().forgot_password_request_button}
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<div class="oauth-divider">{copy().or_continue_with}</div>
			<div class="hero-actions oauth-actions">
				<button
					class="auth-action-link"
					type="button"
					on:click={onGoogleOAuth}
					disabled={$session.loading || passkeyLoading}
				>
					{copy().continue_google}
				</button>
				{#if authMode === 'login'}
					<button
						class="auth-action-link"
						type="button"
						on:click={onPasskeyLogin}
						disabled={$session.loading || passkeyLoading}
					>
						{#if passkeyLoading}
							{copy().passkey_working}
						{:else}
							{copy().sign_in_passkey}
						{/if}
					</button>
				{/if}
			</div>
		</form>

	</article>
</section>

<style>
	.auth-page {
		position: relative;
		min-height: calc(100vh - 10rem);
		display: grid;
		place-items: center;
		padding: clamp(0.6rem, 2.6vw, 2rem);
		overflow: hidden;
		background:
			radial-gradient(circle at 18% 18%, rgba(79, 99, 221, 0.13), transparent 45%),
			radial-gradient(circle at 82% 82%, rgba(37, 50, 68, 0.12), transparent 44%);
	}

	.auth-ambient {
		position: absolute;
		border-radius: 999px;
		filter: blur(36px);
		pointer-events: none;
		animation: auth-float 6s ease-in-out infinite;
	}

	.auth-ambient-a {
		width: 220px;
		height: 220px;
		top: 7%;
		left: 9%;
		background: rgba(79, 99, 221, 0.16);
	}

	.auth-ambient-b {
		width: 200px;
		height: 200px;
		right: 8%;
		bottom: 8%;
		background: rgba(37, 50, 68, 0.11);
		animation-delay: 1s;
	}

	.auth-card {
		position: relative;
		z-index: 1;
		width: min(860px, 100%);
		display: grid;
		gap: 1rem;
		border-color: rgba(79, 99, 221, 0.24);
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(8px);
		box-shadow: 0 24px 52px rgba(21, 38, 74, 0.16);
	}

	.auth-head {
		display: grid;
		gap: 0.48rem;
	}

	.auth-head h1 {
		margin: 0;
		font-size: clamp(1.5rem, 3vw, 2.1rem);
		letter-spacing: -0.01em;
	}

	.auth-head p {
		margin: 0;
		color: var(--ol-ink-soft);
	}

	.auth-form {
		display: grid;
		gap: 0.95rem;
	}

	.auth-mode-switch {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		margin: 0.1rem auto 0.2rem;
		padding: 0.25rem;
		border-radius: 999px;
		background: rgba(79, 99, 221, 0.09);
		border: 1px solid rgba(79, 99, 221, 0.2);
		width: fit-content;
	}

	.auth-mode-link {
		border: 1px solid transparent;
		background: transparent;
		padding: 0.44rem 0.94rem;
		border-radius: 999px;
		color: var(--ol-ink);
		cursor: pointer;
		font: inherit;
		font-weight: 700;
		white-space: nowrap;
		transition:
			color 0.2s ease,
			background-color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.auth-mode-link:hover,
	.auth-mode-link:focus-visible {
		color: var(--ol-ink);
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(79, 99, 221, 0.22);
	}

	.auth-mode-link[data-active='true'] {
		color: var(--ol-ink);
		background: #fff;
		border-color: rgba(79, 99, 221, 0.3);
		box-shadow: 0 4px 14px rgba(79, 99, 221, 0.18);
		pointer-events: none;
	}

	.auth-mode-separator {
		display: none;
	}

	.auth-grid {
		display: grid;
		gap: 0.82rem 0.9rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.auth-grid label {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	.auth-grid label > span {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--ol-ink-soft);
	}

	.auth-grid input,
	.auth-grid select {
		width: 100%;
		min-width: 0;
		min-height: 2.8rem;
		padding: 0.64rem 0.78rem;
		border-radius: 0.78rem;
		border: 1px solid rgba(37, 50, 68, 0.2);
		background: rgba(255, 255, 255, 0.96);
		color: var(--ol-ink);
		font: inherit;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}

	.auth-grid input::placeholder {
		color: rgba(37, 50, 68, 0.44);
	}

	.auth-grid input:focus,
	.auth-grid select:focus {
		outline: none;
		border-color: rgba(79, 99, 221, 0.75);
		box-shadow: 0 0 0 3px rgba(79, 99, 221, 0.18);
		background: #fff;
	}

	.auth-span-full {
		grid-column: 1 / -1;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.68rem;
		justify-content: center;
		align-items: center;
	}

	.hero-actions > * {
		flex: 1 1 220px;
	}

	.oauth-actions > * {
		flex-basis: 240px;
	}

	.auth-action-link {
		border: 1px solid rgba(37, 50, 68, 0.24);
		background: rgba(255, 255, 255, 0.92);
		padding: 0.68rem 0.95rem;
		border-radius: 0.78rem;
		color: var(--ol-ink);
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		text-decoration: none;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			transform 0.15s ease,
			box-shadow 0.2s ease,
			color 0.2s ease,
			opacity 0.2s ease;
	}

	.auth-action-link:hover,
	.auth-action-link:focus-visible {
		color: var(--ol-ink);
		border-color: rgba(79, 99, 221, 0.48);
		background: #fff;
		box-shadow: 0 8px 20px rgba(52, 74, 145, 0.12);
		transform: translateY(-1px);
	}

	.auth-action-link[disabled] {
		opacity: 0.52;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.auth-action-link[disabled]:hover,
	.auth-action-link[disabled]:focus-visible {
		border-color: rgba(37, 50, 68, 0.2);
		background: rgba(255, 255, 255, 0.92);
	}

	.auth-action-subtle {
		flex: 0 0 auto;
		min-height: auto;
		padding: 0.08rem 0.12rem;
		border: 0;
		background: transparent;
		color: var(--ol-ink-soft);
		box-shadow: none;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.auth-action-subtle:hover,
	.auth-action-subtle:focus-visible {
		color: var(--ol-primary);
		border: 0;
		background: transparent;
		transform: none;
		box-shadow: none;
	}

	.auth-action-submit {
		border-color: transparent;
		background: linear-gradient(136deg, #3955d5 0%, #4f63dd 52%, #3148b7 100%);
		color: #fff;
		font-weight: 700;
		box-shadow: 0 12px 26px rgba(55, 79, 182, 0.3);
	}

	.auth-action-submit:hover,
	.auth-action-submit:focus-visible {
		color: #fff;
		border-color: transparent;
		background: linear-gradient(136deg, #334ec7 0%, #4559d3 52%, #2d43ac 100%);
		box-shadow: 0 14px 28px rgba(55, 79, 182, 0.35);
	}

	.auth-redirect-note {
		font-size: 0.84rem;
		color: var(--ol-primary);
		font-weight: 700;
	}

	.oauth-divider {
		display: flex;
		align-items: center;
		gap: 0.62rem;
		font-size: 0.8rem;
		color: var(--ol-ink-soft);
		text-transform: lowercase;
	}

	.oauth-divider::before,
	.oauth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(37, 50, 68, 0.16);
	}

	.otp-grid {
		border: 1px solid rgba(79, 99, 221, 0.16);
		border-radius: 0.9rem;
		padding: 0.75rem;
		background: rgba(79, 99, 221, 0.04);
	}

	.otp-hint {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.85rem;
		color: var(--ol-ink-soft);
	}

	.otp-actions {
		justify-content: flex-start;
		align-items: stretch;
		gap: 0.75rem;
	}

	@keyframes auth-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-12px);
		}
	}

	@media (max-width: 900px) {
		.auth-card {
			width: min(700px, 100%);
		}
	}

	@media (max-width: 720px) {
		.auth-page {
			min-height: auto;
			padding: 0.45rem 0.5rem 1rem;
		}

		.auth-ambient {
			display: none;
		}

		.auth-card {
			width: 100%;
			gap: 0.8rem;
			box-shadow: 0 14px 28px rgba(21, 38, 74, 0.14);
		}

		.auth-head h1 {
			font-size: clamp(1.35rem, 7vw, 1.8rem);
		}

		.auth-mode-switch {
			width: 100%;
		}

		.auth-mode-link {
			flex: 1;
			text-align: center;
		}

		.auth-grid {
			grid-template-columns: 1fr;
			gap: 0.72rem;
		}

		.auth-span-full {
			grid-column: auto;
		}

		.hero-actions {
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
		}

		.hero-actions > * {
			flex: 1 1 auto;
			width: 100%;
		}

		.auth-action-subtle {
			width: auto;
			align-self: flex-start;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.auth-ambient {
			animation: none;
		}

		.auth-action-link {
			transition: none;
		}
	}
</style>
