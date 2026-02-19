import { env } from '$env/dynamic/public';
import { localizeApiError, localizeGenericError } from './i18n';

export type UserRole = 'student' | 'teacher' | 'admin';
export type Locale = 'en' | 'ru' | 'kz';
export type RegistrationStatus = 'planned' | 'registered' | 'participated' | 'result_added';
export type PrepType = 'theory' | 'problems' | 'mock_exam';
export type ResultStatus = 'participant' | 'prize_winner' | 'winner';
export type OlympiadFormat = 'online' | 'offline' | 'mixed';
export type EntityStatus = 'draft' | 'published' | 'archived';
export type GoalPeriod = 'week' | 'month';
export type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type DictionaryTable = 'subjects' | 'levels' | 'regions';
export type CalendarSyncMode = 'import' | 'export' | 'both';

export interface PublicUser {
	id: number;
	name: string;
	email: string;
	role: UserRole;
	school: string | null;
	grade: number | null;
	locale: Locale;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		description?: string;
		details?: Record<string, unknown>;
	};
}

export class ApiClientError extends Error {
	status: number;
	code: string;
	description: string;
	details: Record<string, unknown> | null;

	constructor(
		status: number,
		code: string,
		message: string,
		description: string,
		details: Record<string, unknown> | null = null
	) {
		super(message);
		this.name = 'ApiClientError';
		this.status = status;
		this.code = code;
		this.description = description;
		this.details = details;
	}
}

export interface DictionaryEntry {
	id: number;
	code: string;
	name_ru: string;
	name_kz: string;
	is_active: boolean;
	sort_order: number;
}

export interface DictionariesResponse {
	subjects: DictionaryEntry[];
	levels: DictionaryEntry[];
	regions: DictionaryEntry[];
	topic_frameworks?: Array<{
		id: string;
		subject_code: string;
		name_ru: string;
		name_kz: string | null;
		description: string | null;
	}>;
	topics?: Array<{
		id: string;
		framework_id: string;
		parent_id: string | null;
		name_ru: string;
		name_kz: string | null;
		tags: string[];
		sort_order: number;
	}>;
}

export interface StageChecklist {
	documents_required: string[];
	consent_required: boolean;
	fee_amount: number | null;
	platform_name: string | null;
	platform_url: string | null;
}

export interface RoadmapItem {
	stage_id: number;
	stage_name: string;
	date_start: string;
	date_end: string | null;
	date_precision?: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN' | null;
	source_ref?: string | null;
	stage_template_id?: string | null;
	stage_instance_id?: string | null;
	registration_deadline: string;
	location: string | null;
	online_link: string | null;
	stage_status: EntityStatus;
	checklist_json: StageChecklist;
	olympiad_id: number;
	olympiad_title: string;
	series_id?: string | null;
	event_type?: string | null;
	stage_type?: string | null;
	format: OlympiadFormat;
	season: string;
	olympiad_status: EntityStatus;
	organizer: string | null;
	rules_url: string | null;
	subject_id: number;
	subject_code: string;
	subject_name_ru: string;
	subject_name_kz: string;
	level_id: number;
	level_code: string;
	level_name_ru: string;
	level_name_kz: string;
	region_id: number | null;
	region_code: string | null;
	region_name_ru: string | null;
	region_name_kz: string | null;
	registration_status: RegistrationStatus | null;
}

export interface RoadmapResponse {
	filters: {
		subject: number | null;
		level: number | null;
		format: OlympiadFormat | null;
		event_type?: string | null;
		stage_type?: string | null;
		series_id?: string | null;
		month: number | null;
		year: number | null;
		deadline_soon: boolean;
		registration_status: RegistrationStatus | null;
	};
	items: RoadmapItem[];
}

export interface StageDetails extends Omit<RoadmapItem, 'checklist_json'> {
	checklist_json: StageChecklist;
	checklist: StageChecklist;
}

export type V2StudentStageStatus =
	| 'PLANNED'
	| 'REGISTERED'
	| 'PARTICIPATED'
	| 'RESULT_ENTERED'
	| 'MISSED'
	| 'CANCELLED';

export type V2PrepLogType = 'problems' | 'theory' | 'mock' | 'contest' | 'project' | 'other';

export interface V2RoadmapItem {
	id: string;
	series_id: string;
	series_name_ru: string;
	series_name_kz: string | null;
	series_abbr: string | null;
	event_type: string;
	series_level: string;
	stage_template_id: string;
	stage_template_name_ru: string;
	stage_template_name_kz: string | null;
	stage_type: string;
	label: string | null;
	date_precision: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN';
	starts_on: string | null;
	ends_on: string | null;
	registration_deadline: string | null;
	location_text: string | null;
	format: 'online' | 'offline' | 'hybrid';
	source_ref: string | null;
	student_plan_status: V2StudentStageStatus | null;
	external_registration_url: string | null;
	checklist_state: Record<string, unknown> | null;
	student_notes: string | null;
	planned_at: string | null;
	registered_at: string | null;
	result_status: ResultStatus | null;
	score: number | string | null;
	place_text: string | null;
	result_comment: string | null;
	subject_codes: string[];
}

export interface V2RoadmapResponse {
	filters: Record<string, unknown>;
	items: V2RoadmapItem[];
}

export interface V2StageDocument {
	id: string;
	doc_type: string;
	title_ru: string;
	title_kz: string | null;
	lang: string;
	url: string;
	note: string | null;
	series_id: string | null;
	stage_instance_id: string | null;
	created_at: string;
}

export interface V2PrepTopicFramework {
	id: string;
	subject_code: string;
	name_ru: string;
	name_kz: string | null;
	description: string | null;
}

export interface V2PrepTopic {
	id: string;
	framework_id: string;
	parent_id: string | null;
	name_ru: string;
	name_kz: string | null;
	tags: string[];
	sort_order: number;
}

export interface V2StageDetails extends V2RoadmapItem {
	default_registration_method: string;
	checklist_template_id: string | null;
	checklist_template_name_ru: string | null;
	checklist_items: Array<Record<string, unknown>> | null;
	is_seed: boolean;
	created_at: string;
	updated_at: string;
	documents: V2StageDocument[];
	topic_frameworks: V2PrepTopicFramework[];
	topics: V2PrepTopic[];
}

export interface V2StagePlanRecord {
	id: string;
	student_user_id: number;
	stage_instance_id: string;
	status: V2StudentStageStatus;
	planned_at: string;
	registered_at: string | null;
	external_registration_url: string | null;
	checklist_state: Record<string, unknown>;
	notes: string | null;
}

export interface V2StageResultRecord {
	id: string;
	student_user_id: number;
	stage_instance_id: string;
	result_status: ResultStatus;
	score: number | string | null;
	place_text: string | null;
	comment: string | null;
	created_at: string;
}

export interface V2PrepLogEntry {
	id: string;
	happened_on: string;
	minutes: number;
	log_type: V2PrepLogType;
	note: string | null;
	resource_url: string | null;
	stage_instance_id: string | null;
	created_at: string;
	series_id: string | null;
	stage_label: string | null;
	stage_starts_on: string | null;
	topics: Array<{
		id: string;
		framework_id: string;
		name_ru: string;
		name_kz: string | null;
	}>;
}

export interface V2PrepAnalyticsResponse {
	days: number;
	since: string;
	summary: {
		sessions: number;
		minutes: number;
		avg_minutes: number | string;
	};
	by_type: Array<{
		log_type: V2PrepLogType;
		sessions: number;
		minutes: number;
	}>;
	by_day: Array<{
		happened_on: string;
		sessions: number;
		minutes: number;
	}>;
	stage_progress: Array<{
		status: V2StudentStageStatus;
		count: number;
	}>;
	recent_results: Array<{
		stage_instance_id: string;
		result_status: ResultStatus;
		score: number | string | null;
		place_text: string | null;
		comment: string | null;
		created_at: string;
	}>;
}

export interface V2AdminSeries {
	id: string;
	name_ru: string;
	name_kz: string | null;
	abbr: string | null;
	event_type: string;
	level: string;
	grade_min: number | null;
	grade_max: number | null;
	grade_note: string | null;
	pipeline_template_id: string | null;
	created_at: string;
	updated_at: string;
	subject_codes: string[];
}

export interface V2AdminStageTemplate {
	id: string;
	name_ru: string;
	name_kz: string | null;
	stage_type: string;
	default_registration_method: string;
	checklist_template_id: string | null;
	created_at: string;
}

export interface V2AdminStageInstanceRecord {
	id: string;
	series_id: string;
	stage_template_id: string;
	label: string | null;
	date_precision: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN';
	starts_on: string | null;
	ends_on: string | null;
	registration_deadline: string | null;
	location_text: string | null;
	format: 'online' | 'offline' | 'hybrid';
	source_ref: string | null;
	is_seed: boolean;
	created_at: string;
	updated_at: string;
}

export interface RegistrationRecord {
	id: number;
	student_id: number;
	stage_id: number;
	status: RegistrationStatus;
	created_at: string;
	updated_at: string;
}

export interface PrepActivity {
	id: number;
	student_id: number;
	stage_id: number | null;
	date: string;
	duration_minutes: number;
	type: PrepType;
	topic: string;
	materials_url: string | null;
	material_object_id: string | null;
	created_at: string;
}

export interface PrepGoal {
	id: number;
	student_id: number;
	period: GoalPeriod;
	period_start: string;
	target_minutes: number;
	target_problems: number;
	target_mock_exams: number;
	created_at: string;
	updated_at: string;
}

export interface ResultRecord {
	id: number;
	student_id: number;
	stage_id: number;
	score: number;
	place: number | null;
	status: ResultStatus;
	comment: string | null;
	created_at: string;
}

export interface NotificationItem {
	id: number;
	user_id: number;
	type: 'deadline_soon' | 'new_comment' | 'result_added' | 'reminder';
	title: string;
	body: string;
	is_read: boolean;
	created_at: string;
}

export interface TeacherGroup {
	id: number;
	name: string;
	subject_id: number;
	created_at: string;
	subject_code: string;
	subject_name_ru: string;
	subject_name_kz: string;
	student_count: number;
}

export interface ClaimedTeacherStudent {
	student_id: number;
	student_name: string;
	school: string | null;
	grade: number | null;
	created_at: string;
	nearest_stage_id: number | null;
	nearest_stage_name: string | null;
	nearest_stage_deadline: string | null;
	nearest_stage_status: RegistrationStatus | null;
}

export interface TeacherPlan {
	id: number;
	teacher_id: number;
	student_id: number;
	subject_id: number;
	period_start: string;
	period_end: string;
	objective_text: string;
	status: PlanStatus;
	created_at: string;
	updated_at: string;
	items: Array<{
		id: number;
		item_type: PrepType;
		topic: string;
		target_count: number;
		notes: string | null;
	}>;
}

export interface AdminOlympiadSummary {
	id: number;
	title: string;
	subject_id: number;
	level_id: number;
	region_id: number | null;
	format: OlympiadFormat;
	organizer: string | null;
	rules_url: string | null;
	season: string;
	status: EntityStatus;
	confirmed_by: number | null;
	confirmed_at: string | null;
	created_at: string;
	updated_at: string;
	subject_code: string;
	subject_name_ru: string;
	subject_name_kz: string;
	level_code: string;
	level_name_ru: string;
	level_name_kz: string;
	region_code: string | null;
	region_name_ru: string | null;
	region_name_kz: string | null;
	stages_count: number;
}

export interface GoogleCalendarIntegration {
	provider: 'google';
	provider_account_id: string;
	provider_email: string | null;
	calendar_id: string;
	scope: string[];
	token_expires_at: string | null;
	last_sync_at: string | null;
	last_sync_direction: CalendarSyncMode | null;
	last_sync_status: 'ok' | 'failed' | null;
	last_sync_error: string | null;
	created_at: string;
	updated_at: string;
}

export interface GoogleCalendarStatusResponse {
	connected: boolean;
	integration: GoogleCalendarIntegration | null;
	imported_events_count: number;
}

export interface ImportedGoogleCalendarEvent {
	provider_event_id: string;
	calendar_id: string;
	summary: string | null;
	description: string | null;
	location: string | null;
	starts_at: string;
	ends_at: string | null;
	all_day: boolean;
	html_link: string | null;
	is_cancelled: boolean;
	updated_at: string;
}

export interface GoogleCalendarImportedEventsResponse {
	connected: boolean;
	total: number;
	items: ImportedGoogleCalendarEvent[];
}

export interface GoogleCalendarSyncResponse {
	mode: CalendarSyncMode;
	date_range: {
		from: string;
		to: string;
	};
	integration: GoogleCalendarIntegration;
	export: {
		mode: 'export';
		stages_total: number;
		created: number;
		updated: number;
		skipped: number;
	} | null;
	import: {
		mode: 'import';
		imported_total: number;
		preview: ImportedGoogleCalendarEvent[];
	} | null;
}

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	query?: QueryParams;
	token?: string | null;
	signal?: AbortSignal;
	headers?: Record<string, string>;
}

const normalizeApiBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, '');

export const API_BASE_URL = normalizeApiBaseUrl(env.PUBLIC_API_URL ?? '');
const DEV_API_FALLBACK_URL = 'http://localhost:3000';

const resolveApiBaseUrl = (): string => {
	if (API_BASE_URL) {
		return API_BASE_URL;
	}
	if (typeof window !== 'undefined') {
		const host = window.location.hostname;
		if (host === 'localhost' || host === '127.0.0.1') {
			return DEV_API_FALLBACK_URL;
		}
	}
	return '';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const ensureConfiguredApiUrl = (): string => {
	const resolvedApiBaseUrl = resolveApiBaseUrl();
	if (!resolvedApiBaseUrl) {
		throw new ApiClientError(
			500,
			'api_url_missing',
			'PUBLIC_API_URL is not configured.',
			'Set PUBLIC_API_URL in the root .env file and rebuild the web app.'
		);
	}
	return resolvedApiBaseUrl;
};

const buildUrl = (path: string, query: QueryParams | undefined): string => {
	const base = ensureConfiguredApiUrl();
	const url = new URL(path.startsWith('/') ? path : `/${path}`, `${base}/`);

	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null || value === '') {
				continue;
			}
			url.searchParams.set(key, String(value));
		}
	}

	return url.toString();
};

const parseBody = async (response: Response): Promise<unknown> => {
	const text = await response.text();
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
};

const toApiError = (status: number, payload: unknown): ApiClientError => {
	if (isRecord(payload) && isRecord(payload.error)) {
		const code = typeof payload.error.code === 'string' ? payload.error.code : 'request_failed';
		const message =
			typeof payload.error.message === 'string'
				? payload.error.message
				: `Request failed with status ${status}.`;
		const description =
			typeof payload.error.description === 'string' ? payload.error.description : message;
		const details = isRecord(payload.error.details) ? payload.error.details : null;
		return new ApiClientError(status, code, message, description, details);
	}

	if (typeof payload === 'string' && payload.trim().length > 0) {
		return new ApiClientError(status, 'request_failed', payload, payload, null);
	}

	return new ApiClientError(
		status,
		'request_failed',
		`Request failed with status ${status}.`,
		'The API returned a non-success response.',
		null
	);
};

export const getErrorMessage = (error: unknown): string => {
	if (error instanceof ApiClientError) {
		return `${localizeApiError(error.code, error.message)} (${error.code})`;
	}
	if (error instanceof Error) {
		return localizeGenericError(error.message);
	}
	return localizeGenericError('Unknown error.');
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
	const { method = 'GET', body, query, token = null, signal, headers = {} } = options;
	const url = buildUrl(path, query);

	const requestHeaders = new Headers(headers);
	requestHeaders.set('Accept', 'application/json');

	let payload: BodyInit | undefined;
	if (body !== undefined) {
		if (body instanceof FormData) {
			payload = body;
		} else {
			requestHeaders.set('Content-Type', 'application/json');
			payload = JSON.stringify(body);
		}
	}

	if (token) {
		requestHeaders.set('Authorization', `Bearer ${token}`);
	}

	const response = await fetch(url, {
		method,
		body: payload,
		headers: requestHeaders,
		signal
	});

	const parsed = await parseBody(response);
	if (!response.ok) {
		throw toApiError(response.status, parsed);
	}

	return parsed as T;
};

const requestBlob = async (path: string, options: RequestOptions = {}): Promise<Blob> => {
	const { method = 'GET', body, query, token = null, signal, headers = {} } = options;
	const url = buildUrl(path, query);

	const requestHeaders = new Headers(headers);
	requestHeaders.set('Accept', 'application/octet-stream, text/calendar, application/json');

	let payload: BodyInit | undefined;
	if (body !== undefined) {
		if (body instanceof FormData) {
			payload = body;
		} else {
			requestHeaders.set('Content-Type', 'application/json');
			payload = JSON.stringify(body);
		}
	}

	if (token) {
		requestHeaders.set('Authorization', `Bearer ${token}`);
	}

	const response = await fetch(url, {
		method,
		body: payload,
		headers: requestHeaders,
		signal
	});

	if (!response.ok) {
		const parsed = await parseBody(response);
		throw toApiError(response.status, parsed);
	}

	return response.blob();
};

type AuthPayload = {
	name: string;
	email: string;
	password: string;
	role: 'student' | 'teacher';
	school?: string | null;
	grade?: number | null;
	locale?: Locale;
};

type LoginPayload = {
	email: string;
	password: string;
};

export type RegisterResponse =
	| {
			pending_verification: true;
			email: string;
			expires_in_seconds: number;
	  }
	| {
			token: string;
			user: PublicUser;
			pending_verification?: false;
	  };

type VerifyEmailOtpPayload = {
	email: string;
	otp: string;
};

type ResendEmailOtpPayload = {
	email: string;
};

type SecurityEmailChangePayload = {
	email: string;
};

type SecurityEmailChangeVerifyPayload = {
	email: string;
	otp: string;
};

type ForgotPasswordPayload = {
	email: string;
};

type ResetPasswordPayload = {
	email: string;
	otp: string;
	new_password: string;
};

type OAuthPayloadBase = {
	role?: 'student' | 'teacher';
	school?: string | null;
	grade?: number | null;
	locale?: Locale;
	name?: string | null;
};

type GoogleOAuthPayload = OAuthPayloadBase & {
	id_token: string;
};

type OAuthProvider = 'google';

export interface SecurityPasskey {
	id: number;
	credential_id: string;
	transports: string[];
	created_at: string | null;
	last_used_at: string | null;
}

export interface SecurityOAuthProviderState {
	provider: OAuthProvider;
	linked: boolean;
	provider_account_id?: string | null;
	linked_at?: string | null;
}

export interface MeSecurityResponse {
	security?: {
		has_password?: boolean;
		oauth_accounts?: Array<{
			provider: OAuthProvider;
			provider_account_id: string;
			created_at: string;
		}>;
		passkeys?: SecurityPasskey[];
	};
	user?: PublicUser;
	has_password?: boolean;
	passkeys?: SecurityPasskey[];
	oauth_accounts?: Array<{
		provider: OAuthProvider;
		provider_account_id: string;
		created_at: string;
	}>;
	oauth?:
		| Partial<Record<OAuthProvider, SecurityOAuthProviderState | null>>
		| SecurityOAuthProviderState[];
	providers?: Partial<Record<OAuthProvider, SecurityOAuthProviderState | null>>;
}

type ProfilePayload = {
	name?: string;
	school?: string | null;
	grade?: number | null;
	locale?: Locale;
	directions?: string[];
	goals_text?: string | null;
	subjects?: string[];
};

type OnboardingPayload = {
	directions: string[];
	goals_text: string;
	grade: number;
};

export interface OnboardingDbRecommendation {
	id: number;
	title: string;
	season: string;
	format: string;
	organizer: string | null;
	rules_url: string | null;
	subject_code: string;
	subject_name_ru: string;
	subject_name_kz: string;
	subject_label: string;
	level_label: string;
	next_deadline: string | null;
}

export interface OnboardingAiWebPick {
	title: string;
	organizer: string | null;
	why_fit: string;
	fit_score: number;
	expected_deadline: string | null;
	source_name: string | null;
	source_url: string | null;
}

export interface OnboardingAiRecommendations {
	model: string;
	prompt_used: string;
	summary: string;
	goal_alignment: string[];
	web_picks: OnboardingAiWebPick[];
	plan_30_days: string[];
}

export interface OnboardingRecommendationsResponse {
	generated_at: string;
	directions: string[];
	goals_text: string;
	grade: number;
	db_recommendations: OnboardingDbRecommendation[];
	ai_recommendations: OnboardingAiRecommendations | null;
	warnings: string[];
}

type DictionaryCreatePayload = {
	code: string;
	name_ru: string;
	name_kz: string;
	is_active?: boolean;
	sort_order?: number;
};

type DictionaryPatchPayload = Partial<DictionaryCreatePayload>;

type OlympiadCreatePayload = {
	title: string;
	subject_id: number;
	level_id: number;
	region_id?: number | null;
	format: OlympiadFormat;
	organizer?: string | null;
	rules_url?: string | null;
	season: string;
	status?: EntityStatus;
};

type OlympiadPatchPayload = Partial<OlympiadCreatePayload>;

type StageCreatePayload = {
	name: string;
	date_start: string;
	date_end?: string | null;
	registration_deadline: string;
	location?: string | null;
	online_link?: string | null;
	checklist_json?: Partial<StageChecklist>;
	status?: EntityStatus;
};

type StagePatchPayload = Partial<StageCreatePayload>;

type TeacherPlanItemPayload = {
	item_type: PrepType;
	topic: string;
	target_count: number;
	notes?: string | null;
};

type TeacherPlanPayload = {
	subject_id: number;
	period_start: string;
	period_end: string;
	objective_text?: string | null;
	status?: PlanStatus;
	items?: TeacherPlanItemPayload[];
};

type TeacherPlanPatchPayload = Partial<TeacherPlanPayload>;

export const api = {
	getHealth: () =>
		request<{
			status: 'ok';
			database: 'up';
			storage: 'up';
			bucket: string;
		}>('/health'),

	register: (payload: AuthPayload) =>
		request<RegisterResponse>('/auth/register', {
			method: 'POST',
			body: payload
		}),

	login: (payload: LoginPayload) =>
		request<{ token: string; user: PublicUser }>('/auth/login', { method: 'POST', body: payload }),

	verifyEmailOtp: (payload: VerifyEmailOtpPayload) =>
		request<{ token: string; user: PublicUser }>('/auth/email/verify', {
			method: 'POST',
			body: payload
		}),

	resendEmailOtp: (payload: ResendEmailOtpPayload) =>
		request<{ sent: boolean }>('/auth/email/resend', {
			method: 'POST',
			body: payload
		}),

	forgotPassword: (payload: ForgotPasswordPayload) =>
		request<{ sent: boolean }>('/auth/password/forgot', {
			method: 'POST',
			body: payload
		}),

	resetPassword: (payload: ResetPasswordPayload) =>
		request<{ changed: boolean }>('/auth/password/reset', {
			method: 'POST',
			body: payload
		}),

	oauthGoogle: (payload: GoogleOAuthPayload) =>
		request<{ token: string; user: PublicUser }>('/auth/oauth/google', {
			method: 'POST',
			body: payload
		}),

	getPasskeyAuthenticationOptions: (payload?: { email?: string | null }) =>
		request<Record<string, unknown>>('/auth/passkeys/authenticate/options', {
			method: 'POST',
			body: payload ?? {}
		}),

	verifyPasskeyAuthentication: (payload: {
		response: Record<string, unknown>;
		email?: string | null;
	}) =>
		request<{ token: string; user: PublicUser }>('/auth/passkeys/authenticate/verify', {
			method: 'POST',
			body: payload
		}),

	getMe: (token: string) =>
		request<{ user: PublicUser; profile: Record<string, unknown> | null }>('/me', { token }),

	getMeSecurity: (token: string) => request<MeSecurityResponse>('/me/security', { token }),

	changeMyPassword: (
		token: string,
		payload: {
			old_password: string;
			new_password: string;
		}
	) =>
		request<{ changed: boolean }>('/me/security/password/change', {
			method: 'POST',
			token,
			body: payload
		}),

	requestMyEmailChange: (token: string, payload: SecurityEmailChangePayload) =>
		request<{ sent: boolean; email: string; expires_in_seconds: number }>(
			'/me/security/email/change/request',
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	resendMyEmailChange: (token: string, payload: SecurityEmailChangePayload) =>
		request<{ sent: boolean; email: string; expires_in_seconds: number }>(
			'/me/security/email/change/resend',
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	verifyMyEmailChange: (token: string, payload: SecurityEmailChangeVerifyPayload) =>
		request<{ changed: boolean; user: PublicUser }>('/me/security/email/change/verify', {
			method: 'POST',
			token,
			body: payload
		}),

	getPasskeyRegistrationOptions: (
		token: string,
		payload?: {
			name?: string | null;
		}
	) =>
		request<Record<string, unknown>>('/me/security/passkeys/register/options', {
			method: 'POST',
			token,
			body: payload ?? {}
		}),

	verifyPasskeyRegistration: (
		token: string,
		payload: {
			response: Record<string, unknown>;
		}
	) =>
		request<{ verified: boolean; passkey?: SecurityPasskey }>(
			'/me/security/passkeys/register/verify',
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	deletePasskey: (token: string, passkeyId: string) =>
		request<{ deleted: boolean }>(`/me/security/passkeys/${encodeURIComponent(passkeyId)}`, {
			method: 'DELETE',
			token
		}),

	linkMyOAuthProvider: (
		token: string,
		provider: OAuthProvider,
		payload: {
			id_token?: string;
		}
	) =>
		request<{ linked: boolean; provider: OAuthProvider }>(`/me/security/oauth/${provider}/link`, {
			method: 'POST',
			token,
			body: payload
		}),

	unlinkMyOAuthProvider: (token: string, provider: OAuthProvider) =>
		request<{ unlinked: boolean; provider: OAuthProvider }>(`/me/security/oauth/${provider}`, {
			method: 'DELETE',
			token
		}),

	updateMe: (token: string, payload: ProfilePayload) =>
		request<{ user: PublicUser; profile: Record<string, unknown> | null }>('/me/profile', {
			method: 'PUT',
			token,
			body: payload
		}),

	completeOnboarding: (token: string, payload: OnboardingPayload) =>
		request<{ completed: boolean; profile: Record<string, unknown> | null }>(
			'/me/onboarding/complete',
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	getOnboardingRecommendations: (token: string, payload: OnboardingPayload) =>
		request<OnboardingRecommendationsResponse>('/me/onboarding/recommendations', {
			method: 'POST',
			token,
			body: payload
		}),

	getDictionaries: (includeInactive = false) =>
		request<DictionariesResponse>('/dictionaries', {
			query: includeInactive ? { include_inactive: true } : undefined
		}),

	getRoadmap: (token: string, query?: QueryParams) =>
		request<RoadmapResponse>('/roadmap', {
			token,
			query
		}),

	getRoadmapV2: (
		token: string,
		query?: {
			series_id?: string;
			subject_code?: string;
			event_type?: string;
			stage_type?: string;
			from?: string;
			to?: string;
			deadline_soon?: boolean;
			limit?: number;
		}
	) =>
		request<V2RoadmapResponse>('/v2/roadmap', {
			token,
			query
		}),

	getStageInstanceV2: (token: string, stageInstanceId: string) =>
		request<V2StageDetails>(`/v2/stage-instances/${encodeURIComponent(stageInstanceId)}`, {
			token
		}),

	upsertStagePlanV2: (
		token: string,
		stageInstanceId: string,
		payload: {
			status?: V2StudentStageStatus;
			external_registration_url?: string | null;
			checklist_state?: Record<string, unknown> | null;
			notes?: string | null;
		}
	) =>
		request<{ plan: V2StagePlanRecord }>(
			`/v2/stage-instances/${encodeURIComponent(stageInstanceId)}/plan`,
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	saveStageResultV2: (
		token: string,
		stageInstanceId: string,
		payload: {
			result_status: ResultStatus;
			score?: number | null;
			place_text?: string | null;
			comment?: string | null;
		}
	) =>
		request<{ result: V2StageResultRecord; plan: V2StagePlanRecord }>(
			`/v2/stage-instances/${encodeURIComponent(stageInstanceId)}/results`,
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	getPrepTopicsV2: (
		token: string,
		query?: {
			subject_code?: string;
			series_id?: string;
			framework_id?: string;
			limit?: number;
		}
	) =>
		request<{
			filters: Record<string, unknown>;
			topic_frameworks: V2PrepTopicFramework[];
			topics: V2PrepTopic[];
		}>('/v2/prep/topics', {
			token,
			query
		}),

	getPrepLogsV2: (
		token: string,
		query?: {
			from?: string;
			to?: string;
			limit?: number;
		}
	) =>
		request<{
			filters: Record<string, unknown>;
			items: V2PrepLogEntry[];
		}>('/v2/prep/logs/me', {
			token,
			query
		}),

	addPrepLogV2: (
		token: string,
		payload: {
			happened_on: string;
			minutes: number;
			log_type: V2PrepLogType;
			note?: string | null;
			resource_url?: string | null;
			stage_instance_id?: string | null;
			topic_ids?: string[];
		}
	) =>
		request<{ log: V2PrepLogEntry; topic_ids: string[] }>('/v2/prep/logs', {
			method: 'POST',
			token,
			body: payload
		}),

	getPrepAnalyticsV2: (token: string, query?: { days?: number }) =>
		request<V2PrepAnalyticsResponse>('/v2/prep/analytics/me', {
			token,
			query
		}),

	getAdminSeriesV2: (
		token: string,
		query?: {
			search?: string;
			event_type?: string;
			limit?: number;
		}
	) =>
		request<{
			filters: Record<string, unknown>;
			items: V2AdminSeries[];
		}>('/v2/admin/series', {
			token,
			query
		}),

	getAdminStageTemplatesV2: (token: string) =>
		request<{
			items: V2AdminStageTemplate[];
		}>('/v2/admin/stage-templates', {
			token
		}),

	getAdminStageInstancesV2: (
		token: string,
		query?: {
			series_id?: string;
			stage_type?: string;
			from?: string;
			to?: string;
			limit?: number;
		}
	) =>
		request<{
			filters: Record<string, unknown>;
			items: V2RoadmapItem[];
		}>('/v2/admin/stage-instances', {
			token,
			query
		}),

	createAdminStageInstanceV2: (
		token: string,
		payload: {
			series_id: string;
			stage_template_id: string;
			label?: string | null;
			date_precision?: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN';
			starts_on?: string | null;
			ends_on?: string | null;
			registration_deadline?: string | null;
			location_text?: string | null;
			format?: 'online' | 'offline' | 'hybrid';
			source_ref?: string | null;
			is_seed?: boolean;
		}
	) =>
		request<{ stage_instance: V2AdminStageInstanceRecord }>('/v2/admin/stage-instances', {
			method: 'POST',
			token,
			body: payload
		}),

	patchAdminStageInstanceV2: (
		token: string,
		stageInstanceId: string,
		payload: Partial<{
			series_id: string;
			stage_template_id: string;
			label: string | null;
			date_precision: 'DAY' | 'RANGE' | 'MONTH' | 'UNKNOWN';
			starts_on: string | null;
			ends_on: string | null;
			registration_deadline: string | null;
			location_text: string | null;
			format: 'online' | 'offline' | 'hybrid';
			source_ref: string | null;
			is_seed: boolean;
		}>
	) =>
		request<{ stage_instance: V2AdminStageInstanceRecord }>(
			`/v2/admin/stage-instances/${encodeURIComponent(stageInstanceId)}`,
			{
				method: 'PATCH',
				token,
				body: payload
			}
		),

	getAdminUsersV2: (
		token: string,
		query?: {
			search?: string;
			role?: UserRole;
			is_active?: boolean | null;
			limit?: number;
		}
	) =>
		request<{
			filters: Record<string, unknown>;
			items: PublicUser[];
		}>('/v2/admin/users', {
			token,
			query:
				query && query.is_active !== null && query.is_active !== undefined
					? { ...query, is_active: String(query.is_active) }
					: query
		}),

	patchAdminUserRoleV2: (token: string, userId: number, role: UserRole) =>
		request<{ user: PublicUser }>(`/v2/admin/users/${userId}/role`, {
			method: 'PATCH',
			token,
			body: { role }
		}),

	patchAdminUserActiveV2: (token: string, userId: number, is_active: boolean) =>
		request<{ user: PublicUser }>(`/v2/admin/users/${userId}/active`, {
			method: 'PATCH',
			token,
			body: { is_active }
		}),

	downloadCalendarIcs: (
		token: string,
		query?: {
			from?: string;
			to?: string;
		}
	) =>
		requestBlob('/calendar/ics', {
			token,
			query
		}),

	getGoogleCalendarStatus: (token: string) =>
		request<GoogleCalendarStatusResponse>('/integrations/google-calendar/status', {
			token
		}),

	connectGoogleCalendar: (
		token: string,
		payload: {
			access_token: string;
			refresh_token?: string | null;
			calendar_id?: string;
		}
	) =>
		request<{ connected: boolean; integration: GoogleCalendarIntegration }>(
			'/integrations/google-calendar/connect',
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	disconnectGoogleCalendar: (token: string) =>
		request<{ disconnected: boolean }>('/integrations/google-calendar/disconnect', {
			method: 'DELETE',
			token
		}),

	syncGoogleCalendar: (
		token: string,
		payload?: {
			mode?: CalendarSyncMode;
			from?: string;
			to?: string;
		}
	) =>
		request<GoogleCalendarSyncResponse>('/integrations/google-calendar/sync', {
			method: 'POST',
			token,
			body: payload ?? {}
		}),

	getGoogleCalendarImportedEvents: (
		token: string,
		query?: {
			limit?: number;
			offset?: number;
		}
	) =>
		request<GoogleCalendarImportedEventsResponse>('/integrations/google-calendar/imported-events', {
			token,
			query
		}),

	getStage: (token: string, stageId: number) =>
		request<StageDetails>(`/stages/${stageId}`, {
			token
		}),

	registerToStage: (token: string, stageId: number) =>
		request<{ registration: RegistrationRecord }>(`/stages/${stageId}/register`, {
			method: 'POST',
			token
		}),

	updateStageStatus: (token: string, stageId: number, status: RegistrationStatus) =>
		request<{ registration: RegistrationRecord }>(`/stages/${stageId}/status`, {
			method: 'PATCH',
			token,
			body: { status }
		}),

	getRegistrations: (token: string) =>
		request<{ items: Array<Record<string, unknown>> }>('/registrations/me', {
			token
		}),

	addPrepActivity: (
		token: string,
		payload: {
			stage_id?: number | null;
			date: string;
			duration_minutes: number;
			type: PrepType;
			topic: string;
			topic_ids?: string[];
			materials_url?: string | null;
			material_object_id?: string | null;
		}
	) =>
		request<{ activity: PrepActivity; topic_ids?: string[] }>('/prep-activities', {
			method: 'POST',
			token,
			body: payload
		}),

	getPrepActivities: (
		token: string,
		query?: {
			from?: string;
			to?: string;
		}
	) =>
		request<{ items: PrepActivity[] }>('/prep-activities/me', {
			token,
			query
		}),

	upsertPrepGoal: (
		token: string,
		payload: {
			period: GoalPeriod;
			period_start: string;
			target_minutes: number;
			target_problems: number;
			target_mock_exams: number;
		}
	) =>
		request<{ goal: PrepGoal }>('/prep-goals/me', {
			method: 'PUT',
			token,
			body: payload
		}),

	getPrepGoals: (token: string, period?: GoalPeriod) =>
		request<{ items: PrepGoal[] }>('/prep-goals/me', {
			token,
			query: period ? { period } : undefined
		}),

	saveResult: (
		token: string,
		stageId: number,
		payload: {
			score: number;
			place?: number | null;
			status: ResultStatus;
			comment?: string | null;
		}
	) =>
		request<{ result: ResultRecord; registration: RegistrationRecord }>(
			`/stages/${stageId}/results`,
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	getAnalyticsScores: (token: string, limit = 100) =>
		request<{
			items: Array<Record<string, unknown>>;
			summary: {
				count: number;
				average_score: number | null;
				best_score: number | null;
				latest_score: number | null;
			};
		}>('/analytics/me/scores', {
			token,
			query: { limit }
		}),

	getAnalyticsActivity: (token: string, periodDays = 90) =>
		request<{
			period_days: number;
			daily: Array<Record<string, unknown>>;
			by_type: Array<Record<string, unknown>>;
			summary: Record<string, number>;
		}>('/analytics/me/activity', {
			token,
			query: { period_days: periodDays }
		}),

	getAnalyticsFunnel: (token: string) =>
		request<{
			by_status: Record<RegistrationStatus, number>;
			total: number;
			conversion: {
				planned_to_registered: number | null;
				registered_to_participated: number | null;
				participated_to_result_added: number | null;
			};
		}>('/analytics/me/funnel', { token }),

	getAnalyticsCorrelation: (token: string) =>
		request<{
			sample_size: number;
			correlation_coefficient: number | null;
			interpretation: string;
			pairs: Array<Record<string, unknown>>;
		}>('/analytics/me/correlation', { token }),

	getAnalyticsForecast: (token: string) =>
		request<{
			sample_size: number;
			trend: 'insufficient_data' | 'improving' | 'declining' | 'stable';
			slope: number | null;
			predicted_next_score: number | null;
		}>('/analytics/me/forecast', { token }),

	getAnalyticsSummary: (token: string) =>
		request<{
			metrics: {
				activities_30d: number;
				minutes_30d: number;
				mock_exams_30d: number;
				results_count: number;
				average_score: number | null;
			};
			week_goal: Record<string, unknown> | null;
			month_goal: Record<string, unknown> | null;
			recommendations: string[];
		}>('/analytics/me/summary', { token }),

	getNotifications: (
		token: string,
		query?: {
			unread_only?: boolean;
			limit?: number;
			offset?: number;
		}
	) =>
		request<{
			items: NotificationItem[];
			summary: { total_count: number; unread_count: number };
		}>('/notifications', {
			token,
			query
		}),

	markNotificationRead: (token: string, notificationId: number) =>
		request<{ notification: NotificationItem }>(`/notifications/${notificationId}/read`, {
			method: 'POST',
			token
		}),

	getTeacherGroups: (token: string) =>
		request<{ items: TeacherGroup[] }>('/v2/teacher/groups', { token }),

	getClaimedTeacherStudents: (token: string) =>
		request<{ items: ClaimedTeacherStudent[] }>('/v2/teacher/students/claimed', { token }),

	claimTeacherStudent: (token: string, studentId: number) =>
		request<{ claim: Record<string, unknown>; changed_owner: boolean }>(
			`/v2/teacher/students/${studentId}/claim`,
			{
				method: 'POST',
				token
			}
		),

	sendTeacherNotification: (
		token: string,
		studentId: number,
		payload: {
			type?: NotificationItem['type'];
			title: string;
			body: string;
		}
	) =>
		request<{ notification: NotificationItem }>(
			`/v2/teacher/students/${studentId}/notifications`,
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	createTeacherGroup: (
		token: string,
		payload: {
			name: string;
			subject_id: number;
		}
	) =>
		request<{ group: Record<string, unknown> }>('/v2/teacher/groups', {
			method: 'POST',
			token,
			body: payload
		}),

	addStudentToGroup: (token: string, groupId: number, studentId: number) =>
		request<{ enrollment: Record<string, unknown>; added: boolean }>(
			`/v2/teacher/groups/${groupId}/students`,
			{
				method: 'POST',
				token,
				body: { student_id: studentId }
			}
		),

	getTeacherGroupSummary: (token: string, groupId: number) =>
		request<{
			group: Record<string, unknown>;
			students: Array<Record<string, unknown>>;
			upcoming_deadlines: Array<Record<string, unknown>>;
		}>(`/v2/teacher/groups/${groupId}/summary`, {
			token
		}),

	addTeacherComment: (
		token: string,
		studentId: number,
		payload: { text: string; stage_id?: number | null }
	) =>
		request<{ comment: Record<string, unknown> }>(`/v2/teacher/students/${studentId}/comments`, {
			method: 'POST',
			token,
			body: payload
		}),

	createTeacherPlan: (token: string, studentId: number, payload: TeacherPlanPayload) =>
		request<{ plan: Record<string, unknown>; items: Array<Record<string, unknown>> }>(
			`/v2/teacher/students/${studentId}/plans`,
			{
				method: 'POST',
				token,
				body: payload
			}
		),

	getTeacherPlans: (token: string, studentId: number) =>
		request<{ items: TeacherPlan[] }>(`/v2/teacher/students/${studentId}/plans`, {
			token
		}),

	updateTeacherPlan: (token: string, planId: number, payload: TeacherPlanPatchPayload) =>
		request<{ plan: Record<string, unknown>; items: Array<Record<string, unknown>> }>(
			`/v2/teacher/plans/${planId}`,
			{
				method: 'PATCH',
				token,
				body: payload
			}
		),

	getAdminOlympiads: (token: string) =>
		request<{ items: AdminOlympiadSummary[] }>('/admin/olympiads', {
			token
		}),

	getAdminUsers: (
		token: string,
		query?: { search?: string; role?: UserRole; is_active?: boolean | null; limit?: number }
	) => {
		const params = new URLSearchParams();
		if (query?.search) {
			params.set('search', query.search);
		}
		if (query?.role) {
			params.set('role', query.role);
		}
		if (typeof query?.is_active === 'boolean') {
			params.set('is_active', String(query.is_active));
		}
		if (typeof query?.limit === 'number' && Number.isFinite(query.limit)) {
			params.set('limit', String(Math.floor(query.limit)));
		}
		const suffix = params.toString();
		return request<{ items: PublicUser[] }>(suffix ? `/admin/users?${suffix}` : '/admin/users', {
			token
		});
	},

	createAdminOlympiad: (token: string, payload: OlympiadCreatePayload) =>
		request<{ olympiad: Record<string, unknown> }>('/admin/olympiads', {
			method: 'POST',
			token,
			body: payload
		}),

	patchAdminOlympiad: (token: string, olympiadId: number, payload: OlympiadPatchPayload) =>
		request<{ olympiad: Record<string, unknown> }>(`/admin/olympiads/${olympiadId}`, {
			method: 'PATCH',
			token,
			body: payload
		}),

	confirmAdminOlympiad: (token: string, olympiadId: number) =>
		request<{ olympiad: Record<string, unknown> }>(`/admin/olympiads/${olympiadId}/confirm`, {
			method: 'POST',
			token
		}),

	deleteAdminOlympiad: (token: string, olympiadId: number) =>
		request<{ deleted: boolean; olympiad_id: number }>(`/admin/olympiads/${olympiadId}`, {
			method: 'DELETE',
			token
		}),

	createAdminStage: (token: string, olympiadId: number, payload: StageCreatePayload) =>
		request<{ stage: Record<string, unknown> }>(`/admin/olympiads/${olympiadId}/stages`, {
			method: 'POST',
			token,
			body: payload
		}),

	patchAdminStage: (token: string, stageId: number, payload: StagePatchPayload) =>
		request<{ stage: Record<string, unknown> }>(`/admin/stages/${stageId}`, {
			method: 'PATCH',
			token,
			body: payload
		}),

	confirmAdminStage: (token: string, stageId: number) =>
		request<{ stage: Record<string, unknown> }>(`/admin/stages/${stageId}/confirm`, {
			method: 'POST',
			token
		}),

	deleteAdminStage: (token: string, stageId: number) =>
		request<{ deleted: boolean; stage_id: number }>(`/admin/stages/${stageId}`, {
			method: 'DELETE',
			token
		}),

	patchUserRole: (token: string, userId: number, role: UserRole) =>
		request<{ user: PublicUser }>(`/admin/users/${userId}/role`, {
			method: 'PATCH',
			token,
			body: { role }
		}),

	patchUserActive: (token: string, userId: number, is_active: boolean) =>
		request<{ user: PublicUser }>(`/admin/users/${userId}/active`, {
			method: 'PATCH',
			token,
			body: { is_active }
		}),

	deleteAdminUser: (token: string, userId: number) =>
		request<{ deleted: boolean; user_id: number }>(`/admin/users/${userId}`, {
			method: 'DELETE',
			token
		}),

	createDictionaryEntry: (
		token: string,
		table: DictionaryTable,
		payload: DictionaryCreatePayload
	) =>
		request<Record<string, DictionaryEntry>>(`/admin/dictionaries/${table}`, {
			method: 'POST',
			token,
			body: payload
		}),

	patchDictionaryEntry: (
		token: string,
		table: DictionaryTable,
		id: number,
		payload: DictionaryPatchPayload
	) =>
		request<Record<string, DictionaryEntry>>(`/admin/dictionaries/${table}/${id}`, {
			method: 'PATCH',
			token,
			body: payload
		}),

	deleteDictionaryEntry: (token: string, table: DictionaryTable, id: number) =>
		request<{ deleted: boolean; id: number; table: DictionaryTable }>(
			`/admin/dictionaries/${table}/${id}`,
			{
				method: 'DELETE',
				token
			}
		)
};
