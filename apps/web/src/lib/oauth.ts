export type OAuthProvider = 'google';

export type OAuthPopupErrorCode =
	| 'missing_config'
	| 'popup_blocked'
	| 'popup_closed'
	| 'popup_timeout'
	| 'provider_error'
	| 'invalid_response';

export class OAuthPopupError extends Error {
	code: OAuthPopupErrorCode;
	provider: OAuthProvider;
	providerError: string | null;
	providerErrorDescription: string | null;

	constructor(
		code: OAuthPopupErrorCode,
		provider: OAuthProvider,
		message: string,
		providerError: string | null = null,
		providerErrorDescription: string | null = null
	) {
		super(message);
		this.name = 'OAuthPopupError';
		this.code = code;
		this.provider = provider;
		this.providerError = providerError;
		this.providerErrorDescription = providerErrorDescription;
	}
}

type PopupTokenOptions = {
	provider: OAuthProvider;
	authorizeUrl: string;
	expectedState: string;
	tokenParam: 'id_token' | 'access_token';
	timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const OAUTH_POPUP_MESSAGE_TYPE = 'olymroad:oauth-popup-result';
const OAUTH_POPUP_STORAGE_KEY = 'olymroad.oauth.popup.result';
const OAUTH_POPUP_CALLBACK_PATH = '/oauth-callback.html';

const createRandomValue = (): string => {
	if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
		const buffer = new Uint8Array(16);
		crypto.getRandomValues(buffer);
		return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('');
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const popupFeatures = (): string => {
	const width = 520;
	const height = 720;
	const left = Math.max(0, window.screenX + Math.floor((window.outerWidth - width) / 2));
	const top = Math.max(0, window.screenY + Math.floor((window.outerHeight - height) / 2));
	return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
};

const parsePopupParamsFromParts = (
	hash: string | null | undefined,
	search: string | null | undefined
): URLSearchParams => {
	if (typeof hash === 'string' && hash.length > 1) {
		return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
	}
	if (typeof search === 'string' && search.length > 1) {
		return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	}
	return new URLSearchParams();
};

const parsePopupParams = (popup: Window): URLSearchParams =>
	parsePopupParamsFromParts(popup.location.hash, popup.location.search);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const openPopupForToken = ({
	provider,
	authorizeUrl,
	expectedState,
	tokenParam,
	timeoutMs = DEFAULT_TIMEOUT_MS
}: PopupTokenOptions): Promise<string> =>
	new Promise((resolve, reject) => {
		const popup = window.open(authorizeUrl, `olymroad-${provider}-oauth`, popupFeatures());
		if (!popup) {
			reject(new OAuthPopupError('popup_blocked', provider, 'OAuth popup was blocked.'));
			return;
		}
		popup.focus();

		let settled = false;
		let intervalId = 0;
		let timeoutId = 0;

		const cleanup = (closePopup = false) => {
			window.clearInterval(intervalId);
			window.clearTimeout(timeoutId);
			window.removeEventListener('message', onMessage);
			window.removeEventListener('storage', onStorage);
			if (closePopup && !popup.closed) {
				popup.close();
			}
		};

		const settleError = (error: OAuthPopupError, closePopup = true) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup(closePopup);
			reject(error);
		};

		const settleToken = (token: string) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup(true);
			resolve(token);
		};

		const tryHandleParams = (params: URLSearchParams): boolean => {
			const providerError = params.get('error');
			const providerErrorDescription = params.get('error_description');
			if (providerError) {
				settleError(
					new OAuthPopupError(
						'provider_error',
						provider,
						`OAuth provider returned an error: ${providerError}.`,
						providerError,
						providerErrorDescription
					),
					true
				);
				return true;
			}

			const returnedState = params.get('state');
			if (!returnedState || returnedState !== expectedState) {
				return false;
			}

			const token = params.get(tokenParam);
			if (!token) {
				settleError(new OAuthPopupError('invalid_response', provider, 'OAuth token is missing.'), true);
				return true;
			}

			settleToken(token);
			return true;
		};

		const onMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin || !isRecord(event.data)) {
				return;
			}
			if (event.data.type !== OAUTH_POPUP_MESSAGE_TYPE) {
				return;
			}

			const hash = typeof event.data.hash === 'string' ? event.data.hash : '';
			const search = typeof event.data.search === 'string' ? event.data.search : '';
			tryHandleParams(parsePopupParamsFromParts(hash, search));
		};

		const onStorage = (event: StorageEvent) => {
			if (event.key !== OAUTH_POPUP_STORAGE_KEY || !event.newValue) {
				return;
			}

			try {
				const payload = JSON.parse(event.newValue) as unknown;
				if (!isRecord(payload) || payload.type !== OAUTH_POPUP_MESSAGE_TYPE) {
					return;
				}

				const hash = typeof payload.hash === 'string' ? payload.hash : '';
				const search = typeof payload.search === 'string' ? payload.search : '';
				tryHandleParams(parsePopupParamsFromParts(hash, search));
			} catch {
				// Ignore invalid storage payloads from other tabs.
			}
		};

		window.addEventListener('message', onMessage);
		window.addEventListener('storage', onStorage);

		intervalId = window.setInterval(() => {
			if (popup.closed) {
				settleError(new OAuthPopupError('popup_closed', provider, 'OAuth popup was closed.'), false);
				return;
			}

			let href: string;
			try {
				href = popup.location.href;
			} catch {
				return;
			}

			if (!href.startsWith(window.location.origin)) {
				return;
			}

			tryHandleParams(parsePopupParams(popup));
		}, POLL_INTERVAL_MS);

		timeoutId = window.setTimeout(() => {
			settleError(new OAuthPopupError('popup_timeout', provider, 'OAuth popup timed out.'), true);
		}, timeoutMs);
	});

const buildRedirectUri = (): string =>
	new URL(OAUTH_POPUP_CALLBACK_PATH, window.location.origin).toString();

export const startGoogleOAuth = async (clientId: string): Promise<string> => {
	const trimmedClientId = clientId.trim();
	if (!trimmedClientId) {
		throw new OAuthPopupError('missing_config', 'google', 'Google OAuth client id is missing.');
	}

	const state = createRandomValue();
	const nonce = createRandomValue();
	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	url.searchParams.set('client_id', trimmedClientId);
	url.searchParams.set('redirect_uri', buildRedirectUri());
	url.searchParams.set('response_type', 'id_token');
	url.searchParams.set('scope', 'openid email profile');
	url.searchParams.set('state', state);
	url.searchParams.set('nonce', nonce);
	url.searchParams.set('prompt', 'select_account');

	return openPopupForToken({
		provider: 'google',
		authorizeUrl: url.toString(),
		expectedState: state,
		tokenParam: 'id_token'
	});
};

const GOOGLE_CALENDAR_SCOPE =
	'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

export const startGoogleCalendarOAuth = async (clientId: string): Promise<string> => {
	const trimmedClientId = clientId.trim();
	if (!trimmedClientId) {
		throw new OAuthPopupError('missing_config', 'google', 'Google OAuth client id is missing.');
	}

	const state = createRandomValue();
	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	url.searchParams.set('client_id', trimmedClientId);
	url.searchParams.set('redirect_uri', buildRedirectUri());
	url.searchParams.set('response_type', 'token');
	url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
	url.searchParams.set('include_granted_scopes', 'true');
	url.searchParams.set('state', state);
	url.searchParams.set('prompt', 'consent select_account');

	return openPopupForToken({
		provider: 'google',
		authorizeUrl: url.toString(),
		expectedState: state,
		tokenParam: 'access_token'
	});
};
