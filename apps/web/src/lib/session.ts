import { get, writable } from 'svelte/store';
import { ApiClientError, api, getErrorMessage, type Locale, type PublicUser } from './api';

const TOKEN_STORAGE_KEY = 'olymroad.auth.token';
const USER_STORAGE_KEY = 'olymroad.auth.user';

export interface SessionState {
	initialized: boolean;
	loading: boolean;
	token: string | null;
	user: PublicUser | null;
	error: string | null;
}

type RegisterInput = {
	name: string;
	email: string;
	password: string;
	role: 'student' | 'teacher';
	school?: string | null;
	grade?: number | null;
	locale?: Locale;
};

type RegisterResult =
	| {
			status: 'authenticated';
			user: PublicUser;
	  }
	| {
			status: 'pending_verification';
			email: string;
			expiresInSeconds: number;
	  };

type LoginInput = {
	email: string;
	password: string;
};

type OAuthInputBase = {
	role?: 'student' | 'teacher';
	school?: string | null;
	grade?: number | null;
	locale?: Locale;
	name?: string | null;
};

type GoogleOAuthInput = OAuthInputBase & {
	idToken: string;
};

type PasskeyLoginInput = {
	response: Record<string, unknown>;
	email?: string | null;
};

const initialState: SessionState = {
	initialized: false,
	loading: false,
	token: null,
	user: null,
	error: null
};

const state = writable<SessionState>(initialState);
let bootstrapPromise: Promise<void> | null = null;

const canUseStorage = (): boolean => typeof window !== 'undefined';

const clearStorage = () => {
	if (!canUseStorage()) {
		return;
	}
	localStorage.removeItem(TOKEN_STORAGE_KEY);
	localStorage.removeItem(USER_STORAGE_KEY);
};

const readStoredSession = (): { token: string | null; user: PublicUser | null } => {
	if (!canUseStorage()) {
		return { token: null, user: null };
	}

	const tokenRaw = localStorage.getItem(TOKEN_STORAGE_KEY);
	const userRaw = localStorage.getItem(USER_STORAGE_KEY);

	let user: PublicUser | null = null;
	if (userRaw) {
		try {
			user = JSON.parse(userRaw) as PublicUser;
		} catch {
			user = null;
		}
	}

	return {
		token: tokenRaw,
		user
	};
};

const writeStoredSession = (token: string, user: PublicUser) => {
	if (!canUseStorage()) {
		return;
	}
	localStorage.setItem(TOKEN_STORAGE_KEY, token);
	localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

const setError = (message: string | null) => {
	state.update((current) => ({ ...current, error: message }));
};

const setLoading = (loading: boolean) => {
	state.update((current) => ({ ...current, loading }));
};

const setAuthenticated = (token: string, user: PublicUser) => {
	writeStoredSession(token, user);
	state.set({
		initialized: true,
		loading: false,
		token,
		user,
		error: null
	});
};

const setLoggedOut = (initialized = true) => {
	clearStorage();
	state.set({
		initialized,
		loading: false,
		token: null,
		user: null,
		error: null
	});
};

const bootstrap = async () => {
	if (bootstrapPromise) {
		await bootstrapPromise;
		return;
	}

	bootstrapPromise = (async () => {
		const current = get(state);
		if (current.initialized) {
			return;
		}

		const stored = readStoredSession();
		if (!stored.token) {
			setLoggedOut(true);
			return;
		}

		state.set({
			initialized: false,
			loading: false,
			token: stored.token,
			user: stored.user,
			error: null
		});

		try {
			const me = await api.getMe(stored.token);
			setAuthenticated(stored.token, me.user);
		} catch (error) {
			if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
				setLoggedOut(true);
				return;
			}
			state.update((currentState) => ({
				...currentState,
				initialized: true,
				loading: false,
				error: null
			}));
		}
	})();

	try {
		await bootstrapPromise;
	} finally {
		bootstrapPromise = null;
	}
};

const refresh = async () => {
	const token = get(state).token;
	if (!token) {
		return;
	}

	setLoading(true);
	try {
		const me = await api.getMe(token);
		setAuthenticated(token, me.user);
	} catch (error) {
		if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
			setLoggedOut(true);
		} else {
			setLoading(false);
		}
		setError(getErrorMessage(error));
	}
};

const login = async (input: LoginInput) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.login(input);
		setAuthenticated(response.token, response.user);
		return response.user;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const register = async (input: RegisterInput) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.register(input);
		if ('pending_verification' in response && response.pending_verification) {
			clearStorage();
			state.update((current) => ({
				...current,
				initialized: true,
				loading: false,
				token: null,
				user: null,
				error: null
			}));
			return {
				status: 'pending_verification',
				email: response.email,
				expiresInSeconds: response.expires_in_seconds
			} satisfies RegisterResult;
		}

		setAuthenticated(response.token, response.user);
		return {
			status: 'authenticated',
			user: response.user
		} satisfies RegisterResult;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const verifyEmailOtp = async (input: { email: string; otp: string }) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.verifyEmailOtp(input);
		setAuthenticated(response.token, response.user);
		return response.user;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const resendEmailOtp = async (input: { email: string }) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.resendEmailOtp(input);
		setLoading(false);
		return response;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const forgotPassword = async (input: { email: string }) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.forgotPassword(input);
		setLoading(false);
		return response;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const resetPassword = async (input: { email: string; otp: string; newPassword: string }) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.resetPassword({
			email: input.email,
			otp: input.otp,
			new_password: input.newPassword
		});
		setLoading(false);
		return response;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const oauthGoogle = async (input: GoogleOAuthInput) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.oauthGoogle({
			id_token: input.idToken,
			role: input.role,
			school: input.school,
			grade: input.grade,
			locale: input.locale,
			name: input.name
		});
		setAuthenticated(response.token, response.user);
		return response.user;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const loginWithPasskey = async (input: PasskeyLoginInput) => {
	setLoading(true);
	setError(null);
	try {
		const response = await api.verifyPasskeyAuthentication({
			response: input.response,
			email: input.email
		});
		setAuthenticated(response.token, response.user);
		return response.user;
	} catch (error) {
		setLoading(false);
		const message = getErrorMessage(error);
		setError(message);
		throw error;
	}
};

const logout = () => {
	setLoggedOut(true);
};

const clearError = () => {
	setError(null);
};

export const currentToken = (): string | null => get(state).token;

export const session = {
	subscribe: state.subscribe,
	bootstrap,
	refresh,
	login,
	register,
	verifyEmailOtp,
	resendEmailOtp,
	forgotPassword,
	resetPassword,
	oauthGoogle,
	loginWithPasskey,
	logout,
	clearError
};
