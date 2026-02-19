export type RegistrationStatus = 'planned' | 'registered' | 'participated' | 'result_added';

export type OlympiadFormat = 'online' | 'offline' | 'mixed';

export type PrepType = 'theory' | 'problems' | 'mock_exam';

export type ResultStatus = 'participant' | 'prize_winner' | 'winner';

export interface StageChecklist {
	documentsRequired: string[];
	consentRequired: boolean;
	feeAmount: number | null;
	platformName: string | null;
	platformUrl: string | null;
}

export interface RoadmapStage {
	id: string;
	olympiadTitle: string;
	subject: string;
	level: string;
	format: OlympiadFormat;
	season: string;
	stageName: string;
	dateStart: string;
	dateEnd: string | null;
	registrationDeadline: string;
	location: string;
	status: RegistrationStatus;
	checklist: StageChecklist;
}

export interface PrepActivity {
	id: string;
	date: string;
	stageId: string | null;
	type: PrepType;
	topic: string;
	durationMinutes: number;
	materialsUrl: string | null;
}

export interface PrepGoals {
	week: { targetMinutes: number; targetProblems: number; targetMockExams: number };
	month: { targetMinutes: number; targetProblems: number; targetMockExams: number };
}

export interface ResultEntry {
	id: string;
	stageId: string;
	stageName: string;
	score: number;
	place: number | null;
	status: ResultStatus;
	createdAt: string;
	comment: string | null;
}

export interface NotificationItem {
	id: string;
	type: 'deadline_soon' | 'new_comment' | 'result_added' | 'reminder';
	title: string;
	body: string;
	createdAt: string;
	isRead: boolean;
}

export interface TeacherStudentSummary {
	studentId: string;
	studentName: string;
	upcomingStage: string;
	registrationStatus: RegistrationStatus;
	weekMinutes: number;
	mockExams: number;
}

export interface TeacherGroupSummary {
	groupId: string;
	groupName: string;
	subject: string;
	students: number;
	registeredCount: number;
	missedDeadlines: number;
	avgPrepMinutesWeek: number;
}

export interface AdminOlympiadRecord {
	id: string;
	title: string;
	subject: string;
	level: string;
	format: OlympiadFormat;
	season: string;
	status: 'draft' | 'published' | 'archived';
	stages: number;
}

export const registrationFlow: RegistrationStatus[] = [
	'planned',
	'registered',
	'participated',
	'result_added'
];

export const roadmapStages: RoadmapStage[] = [
	{
		id: 'math-city-qual',
		olympiadTitle: 'City Mathematics Olympiad',
		subject: 'Mathematics',
		level: 'city',
		format: 'offline',
		season: '2026-2027',
		stageName: 'Qualification Round',
		dateStart: '2026-10-12',
		dateEnd: null,
		registrationDeadline: '2026-10-05',
		location: 'Almaty, School #131',
		status: 'registered',
		checklist: {
			documentsRequired: ['School certificate', 'Parent consent form', 'Student ID'],
			consentRequired: true,
			feeAmount: null,
			platformName: null,
			platformUrl: null
		}
	},
	{
		id: 'math-region-semi',
		olympiadTitle: 'Regional Mathematics Olympiad',
		subject: 'Mathematics',
		level: 'regional',
		format: 'mixed',
		season: '2026-2027',
		stageName: 'Semi-final',
		dateStart: '2026-11-23',
		dateEnd: '2026-11-24',
		registrationDeadline: '2026-11-13',
		location: 'Regional STEM Hub + proctor online',
		status: 'planned',
		checklist: {
			documentsRequired: ['Application sheet', 'Result of city round'],
			consentRequired: true,
			feeAmount: 5000,
			platformName: 'OlymProctor',
			platformUrl: 'https://olymproctor.example.com'
		}
	},
	{
		id: 'phys-national-final',
		olympiadTitle: 'National Physics Olympiad',
		subject: 'Physics',
		level: 'national',
		format: 'offline',
		season: '2026-2027',
		stageName: 'Final',
		dateStart: '2027-02-18',
		dateEnd: '2027-02-20',
		registrationDeadline: '2027-01-30',
		location: 'Astana, National University',
		status: 'participated',
		checklist: {
			documentsRequired: ['Passport', 'Medical approval', 'Travel order'],
			consentRequired: true,
			feeAmount: null,
			platformName: null,
			platformUrl: null
		}
	},
	{
		id: 'informatics-open',
		olympiadTitle: 'Open Informatics Challenge',
		subject: 'Informatics',
		level: 'inter-school',
		format: 'online',
		season: '2026-2027',
		stageName: 'Main Contest',
		dateStart: '2026-09-14',
		dateEnd: null,
		registrationDeadline: '2026-09-10',
		location: 'Online',
		status: 'result_added',
		checklist: {
			documentsRequired: ['School account verification'],
			consentRequired: false,
			feeAmount: null,
			platformName: 'CodeArena',
			platformUrl: 'https://codearena.example.com'
		}
	}
];

export const prepActivities: PrepActivity[] = [
	{
		id: 'pa-001',
		date: '2026-09-03',
		stageId: 'math-city-qual',
		type: 'problems',
		topic: 'Combinatorics: pigeonhole drills',
		durationMinutes: 120,
		materialsUrl: 'https://drive.example.com/combinatorics-pack'
	},
	{
		id: 'pa-002',
		date: '2026-09-06',
		stageId: 'math-city-qual',
		type: 'theory',
		topic: 'Inequalities and invariant techniques',
		durationMinutes: 80,
		materialsUrl: null
	},
	{
		id: 'pa-003',
		date: '2026-09-09',
		stageId: null,
		type: 'mock_exam',
		topic: 'Full 3-hour mixed mock',
		durationMinutes: 180,
		materialsUrl: 'https://storage.example.com/mock-2026-09.pdf'
	}
];

export const prepGoals: PrepGoals = {
	week: { targetMinutes: 420, targetProblems: 35, targetMockExams: 1 },
	month: { targetMinutes: 1800, targetProblems: 140, targetMockExams: 4 }
};

export const resultEntries: ResultEntry[] = [
	{
		id: 're-001',
		stageId: 'informatics-open',
		stageName: 'Open Informatics Challenge / Main Contest',
		score: 87,
		place: 6,
		status: 'prize_winner',
		createdAt: '2026-09-16',
		comment: 'Strong algorithms section; needs faster debugging cycle.'
	},
	{
		id: 're-002',
		stageId: 'phys-national-final',
		stageName: 'National Physics Olympiad / Final',
		score: 74,
		place: 18,
		status: 'participant',
		createdAt: '2027-02-23',
		comment: null
	}
];

export const analyticsSummary = {
	currentSeasonAverageScore: 80,
	prepMinutesLast30Days: 1260,
	stagesCompleted: 3,
	correlationPrepToScore: 0.64,
	forecastNextScoreRange: '82 - 89'
};

export const analyticsScoreTrend = [
	{ label: 'Sep', value: 72 },
	{ label: 'Oct', value: 76 },
	{ label: 'Nov', value: 79 },
	{ label: 'Dec', value: 78 },
	{ label: 'Jan', value: 83 },
	{ label: 'Feb', value: 87 }
];

export const analyticsActivityTrend = [
	{ label: 'Week 1', value: 240 },
	{ label: 'Week 2', value: 300 },
	{ label: 'Week 3', value: 340 },
	{ label: 'Week 4', value: 380 }
];

export const analyticsFunnel = [
	{ label: 'Planned', count: 8 },
	{ label: 'Registered', count: 6 },
	{ label: 'Participated', count: 4 },
	{ label: 'Result Added', count: 3 }
];

export const teacherGroupSummaries: TeacherGroupSummary[] = [
	{
		groupId: 'tg-phys-9',
		groupName: 'Physics 9A',
		subject: 'Physics',
		students: 14,
		registeredCount: 11,
		missedDeadlines: 2,
		avgPrepMinutesWeek: 280
	},
	{
		groupId: 'tg-math-10',
		groupName: 'Math 10B',
		subject: 'Mathematics',
		students: 12,
		registeredCount: 10,
		missedDeadlines: 1,
		avgPrepMinutesWeek: 320
	}
];

export const teacherStudentSummaries: TeacherStudentSummary[] = [
	{
		studentId: 'st-001',
		studentName: 'Aruzhan Bek',
		upcomingStage: 'City Mathematics / Qualification',
		registrationStatus: 'registered',
		weekMinutes: 360,
		mockExams: 1
	},
	{
		studentId: 'st-002',
		studentName: 'Dias Nur',
		upcomingStage: 'Regional Mathematics / Semi-final',
		registrationStatus: 'planned',
		weekMinutes: 220,
		mockExams: 0
	},
	{
		studentId: 'st-003',
		studentName: 'Mira Altyn',
		upcomingStage: 'National Physics / Final',
		registrationStatus: 'participated',
		weekMinutes: 410,
		mockExams: 1
	}
];

export const adminOlympiadRecords: AdminOlympiadRecord[] = [
	{
		id: 'ao-001',
		title: 'City Mathematics Olympiad',
		subject: 'Mathematics',
		level: 'city',
		format: 'offline',
		season: '2026-2027',
		status: 'published',
		stages: 3
	},
	{
		id: 'ao-002',
		title: 'Regional Mathematics Olympiad',
		subject: 'Mathematics',
		level: 'regional',
		format: 'mixed',
		season: '2026-2027',
		status: 'draft',
		stages: 2
	},
	{
		id: 'ao-003',
		title: 'Open Informatics Challenge',
		subject: 'Informatics',
		level: 'inter-school',
		format: 'online',
		season: '2026-2027',
		status: 'archived',
		stages: 1
	}
];

export const dictionaryData = {
	subjects: ['Mathematics', 'Physics', 'Informatics', 'Chemistry'],
	levels: ['school', 'city', 'regional', 'national', 'international'],
	regions: ['Almaty', 'Astana', 'Shymkent', 'Atyrau']
};

export const notificationItems: NotificationItem[] = [
	{
		id: 'nf-001',
		type: 'deadline_soon',
		title: 'Registration deadline in 3 days',
		body: 'Regional Mathematics / Semi-final closes on 2026-11-13.',
		createdAt: '2026-11-10T09:10:00Z',
		isRead: false
	},
	{
		id: 'nf-002',
		type: 'new_comment',
		title: 'Teacher feedback received',
		body: 'Coach left notes on your latest mock exam.',
		createdAt: '2026-11-09T14:22:00Z',
		isRead: false
	},
	{
		id: 'nf-003',
		type: 'result_added',
		title: 'Result saved and synced',
		body: 'Your Informatics result was added. Registration status moved to result_added.',
		createdAt: '2026-09-16T12:00:00Z',
		isRead: true
	},
	{
		id: 'nf-004',
		type: 'reminder',
		title: 'Weekly prep goal reminder',
		body: 'You are 120 minutes behind this week target.',
		createdAt: '2026-11-08T06:45:00Z',
		isRead: true
	}
];

export const onboardingDirections = ['Mathematics', 'Physics', 'Informatics'];

export const onboardingGoals = [
	'Reach regional stage this season',
	'Increase mock exam average to 85+',
	'Build consistent 6h/week prep rhythm'
];
