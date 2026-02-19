<script lang="ts">
	import { onMount } from 'svelte';
	import {
		api,
		getErrorMessage,
		type ClaimedTeacherStudent,
		type DictionaryEntry,
		type RoadmapItem,
		type TeacherGroup,
		type TeacherPlan
	} from '$lib/api';
	import {
		dictionaryLabel,
		formatDate,
		prepTypeLabel,
		registrationStatusLabel,
		resolveLocale
	} from '$lib/i18n';
	import { currentToken, session } from '$lib/session';

	type UiCopy = {
		meta_title: string;
		meta_description: string;
		hero_eyebrow: string;
		hero_title: string;
		hero_subtitle: string;
		sign_in_required: string;
		group_setup_eyebrow: string;
		group_setup_title: string;
		group_name: string;
		group_name_placeholder: string;
		claim_student_by_id: string;
		claim_student: string;
		subject: string;
		select_subject: string;
		create_group: string;
		personal_students_eyebrow: string;
		personal_students_title: string;
		nearest_stage: string;
		nearest_status: string;
		personal_students_empty: string;
		no_stage: string;
		group_summary_eyebrow: string;
		group_summary_title: string;
		select_group: string;
		add_student_by_id: string;
		add_student: string;
		loading_group: string;
		upcoming_deadlines: string;
		no_deadlines: string;
		student: string;
		school: string;
		grade: string;
		registered_plus: string;
		result_added: string;
		prep_min_30d: string;
		empty_group_summary: string;
		student_actions_eyebrow: string;
		student_actions_title: string;
		select_student: string;
		comment_text: string;
		comment_placeholder: string;
		stage_id_optional: string;
		stage_none: string;
		add_comment: string;
		send_notification: string;
		notification_type: string;
		notification_type_reminder: string;
		notification_type_comment: string;
		notification_title: string;
		notification_title_placeholder: string;
		notification_body: string;
		notification_body_placeholder: string;
		period_start: string;
		period_end: string;
		item_type: string;
		item_target_count: string;
		objective_optional: string;
		objective_placeholder: string;
		item_topic: string;
		item_topic_placeholder: string;
		item_notes_optional: string;
		item_notes_placeholder: string;
		create_plan: string;
		load_plans: string;
		plan_label: string;
		plan_no_objective: string;
		status: string;
		to: string;
		target: string;
		error_sign_in_first: string;
		error_group_required: string;
		error_group_input: string;
		error_student_id_invalid: string;
		error_student_required: string;
		error_comment_required: string;
		error_stage_id_invalid: string;
		error_notification_title_required: string;
		error_notification_body_required: string;
		error_subject_required: string;
		error_period_required: string;
		error_item_topic_required: string;
		error_item_target_invalid: string;
		info_group_created: string;
		info_student_claimed: string;
		info_student_added: string;
		info_student_already_in_group: string;
		info_comment_created: string;
		info_notification_sent: string;
		info_plan_created: string;
	};

	const COPY: Record<'en' | 'ru' | 'kz', UiCopy> = {
		en: {
			meta_title: 'Teacher Workspace | OlymRoad',
			meta_description: 'Manage groups, comments, deadlines, and assigned prep plans.',
			hero_eyebrow: 'Teacher workspace',
			hero_title: 'Run group preparation with deadline and progress visibility',
			hero_subtitle:
				'Teacher dashboard shows only owned groups: registrations, deadlines, activity, comments, and plan assignment.',
			sign_in_required: 'Sign in with a teacher account to use this workspace.',
			group_setup_eyebrow: 'Group setup',
			group_setup_title: 'Create groups and assign students',
			group_name: 'Group name',
			group_name_placeholder: 'Physics 9A',
			claim_student_by_id: 'Claim student by ID',
			claim_student: 'Claim student',
			subject: 'Subject',
			select_subject: 'Select subject',
			create_group: 'Create group',
			personal_students_eyebrow: 'Personal students',
			personal_students_title: 'Students claimed under this teacher',
			nearest_stage: 'Nearest stage',
			nearest_status: 'Nearest status',
			personal_students_empty: 'No claimed students yet.',
			no_stage: 'No upcoming stage',
			group_summary_eyebrow: 'Group summary',
			group_summary_title: 'Ownership-scoped teacher view',
			select_group: 'Select group',
			add_student_by_id: 'Add student by ID',
			add_student: 'Add student',
			loading_group: 'Loading group summary...',
			upcoming_deadlines: 'Upcoming deadlines',
			no_deadlines: 'No upcoming deadlines.',
			student: 'Student',
			school: 'School',
			grade: 'Grade',
			registered_plus: 'Registered+',
			result_added: 'Result added',
			prep_min_30d: 'Prep min (30d)',
			empty_group_summary: 'Create or select a group to view summary.',
			student_actions_eyebrow: 'Student actions',
			student_actions_title: 'Comments and assigned prep plans',
			select_student: 'Select student',
			comment_text: 'Comment text',
			comment_placeholder: 'Feedback for student',
			stage_id_optional: 'Stage ID (optional)',
			stage_none: 'None',
			add_comment: 'Add comment',
			send_notification: 'Send notification',
			notification_type: 'Notification type',
			notification_type_reminder: 'Reminder',
			notification_type_comment: 'Comment',
			notification_title: 'Notification title',
			notification_title_placeholder: 'Important update',
			notification_body: 'Notification text',
			notification_body_placeholder: 'Message for student',
			period_start: 'Period start',
			period_end: 'Period end',
			item_type: 'Item type',
			item_target_count: 'Item target count',
			objective_optional: 'Objective (optional)',
			objective_placeholder: 'Plan objective',
			item_topic: 'Item topic',
			item_topic_placeholder: 'Topic to practice',
			item_notes_optional: 'Item notes (optional)',
			item_notes_placeholder: 'Details',
			create_plan: 'Create plan',
			load_plans: 'Load plans',
			plan_label: 'Plan',
			plan_no_objective: 'No objective text',
			status: 'status',
			to: 'to',
			target: 'target',
			error_sign_in_first: 'Sign in first.',
			error_group_required: 'Select a group first.',
			error_group_input: 'Group name and subject are required.',
			error_student_id_invalid: 'Student id must be a positive integer.',
			error_student_required: 'Select a student first.',
			error_comment_required: 'Comment text is required.',
			error_stage_id_invalid: 'stage_id must be a positive integer.',
			error_notification_title_required: 'Notification title is required.',
			error_notification_body_required: 'Notification text is required.',
			error_subject_required: 'Valid subject is required.',
			error_period_required: 'Plan period is required.',
			error_item_topic_required: 'Plan item topic is required.',
			error_item_target_invalid: 'Plan item target_count must be a positive integer.',
			info_group_created: 'Group created.',
			info_student_claimed: 'Student claimed under your ownership.',
			info_student_added: 'Student added to group.',
			info_student_already_in_group: 'Student is already in this group.',
			info_comment_created: 'Comment created.',
			info_notification_sent: 'Notification sent.',
			info_plan_created: 'Plan created.'
		},
		ru: {
			meta_title: 'Кабинет учителя | OlymRoad',
			meta_description: 'Управление группами, комментариями, дедлайнами и назначенными планами.',
			hero_eyebrow: 'Кабинет учителя',
			hero_title: 'Управляйте групповой подготовкой и контролируйте прогресс',
			hero_subtitle:
				'Панель учителя показывает только собственные группы: регистрации, дедлайны, активность, комментарии и назначенные планы.',
			sign_in_required: 'Войдите под ролью учителя, чтобы открыть рабочее пространство.',
			group_setup_eyebrow: 'Настройка групп',
			group_setup_title: 'Создание групп и добавление учеников',
			group_name: 'Название группы',
			group_name_placeholder: 'Физика 9А',
			claim_student_by_id: 'Закрепить ученика по ID',
			claim_student: 'Закрепить ученика',
			subject: 'Предмет',
			select_subject: 'Выберите предмет',
			create_group: 'Создать группу',
			personal_students_eyebrow: 'Личные ученики',
			personal_students_title: 'Ученики, закрепленные за этим учителем',
			nearest_stage: 'Ближайший этап',
			nearest_status: 'Ближайший статус',
			personal_students_empty: 'Пока нет закрепленных учеников.',
			no_stage: 'Нет ближайшего этапа',
			group_summary_eyebrow: 'Сводка группы',
			group_summary_title: 'Вид учителя в пределах своей зоны ответственности',
			select_group: 'Выберите группу',
			add_student_by_id: 'Добавить ученика по ID',
			add_student: 'Добавить ученика',
			loading_group: 'Загрузка сводки группы...',
			upcoming_deadlines: 'Ближайшие дедлайны',
			no_deadlines: 'Ближайших дедлайнов нет.',
			student: 'Ученик',
			school: 'Школа',
			grade: 'Класс',
			registered_plus: 'Зарегистрирован+',
			result_added: 'Результат добавлен',
			prep_min_30d: 'Мин подготовки (30д)',
			empty_group_summary: 'Создайте или выберите группу для просмотра сводки.',
			student_actions_eyebrow: 'Действия по ученику',
			student_actions_title: 'Комментарии и назначенные планы подготовки',
			select_student: 'Выберите ученика',
			comment_text: 'Текст комментария',
			comment_placeholder: 'Комментарий для ученика',
			stage_id_optional: 'ID этапа (необязательно)',
			stage_none: 'Нет',
			add_comment: 'Добавить комментарий',
			send_notification: 'Отправить уведомление',
			notification_type: 'Тип уведомления',
			notification_type_reminder: 'Напоминание',
			notification_type_comment: 'Комментарий',
			notification_title: 'Заголовок уведомления',
			notification_title_placeholder: 'Важное обновление',
			notification_body: 'Текст уведомления',
			notification_body_placeholder: 'Сообщение для ученика',
			period_start: 'Начало периода',
			period_end: 'Конец периода',
			item_type: 'Тип пункта',
			item_target_count: 'Целевое количество',
			objective_optional: 'Цель (необязательно)',
			objective_placeholder: 'Цель плана',
			item_topic: 'Тема пункта',
			item_topic_placeholder: 'Тема для практики',
			item_notes_optional: 'Заметки (необязательно)',
			item_notes_placeholder: 'Подробности',
			create_plan: 'Создать план',
			load_plans: 'Загрузить планы',
			plan_label: 'План',
			plan_no_objective: 'Цель не указана',
			status: 'статус',
			to: 'до',
			target: 'цель',
			error_sign_in_first: 'Сначала выполните вход.',
			error_group_required: 'Сначала выберите группу.',
			error_group_input: 'Нужны название группы и предмет.',
			error_student_id_invalid: 'ID ученика должен быть положительным целым числом.',
			error_student_required: 'Сначала выберите ученика.',
			error_comment_required: 'Текст комментария обязателен.',
			error_stage_id_invalid: 'stage_id должен быть положительным целым числом.',
			error_notification_title_required: 'Заголовок уведомления обязателен.',
			error_notification_body_required: 'Текст уведомления обязателен.',
			error_subject_required: 'Требуется корректный предмет.',
			error_period_required: 'Укажите период плана.',
			error_item_topic_required: 'Тема пункта плана обязательна.',
			error_item_target_invalid: 'target_count должен быть положительным целым числом.',
			info_group_created: 'Группа создана.',
			info_student_claimed: 'Ученик закреплен за вами.',
			info_student_added: 'Ученик добавлен в группу.',
			info_student_already_in_group: 'Ученик уже состоит в этой группе.',
			info_comment_created: 'Комментарий создан.',
			info_notification_sent: 'Уведомление отправлено.',
			info_plan_created: 'План создан.'
		},
		kz: {
			meta_title: 'Мұғалім панелі | OlymRoad',
			meta_description: 'Топтар, пікірлер, дедлайндар және тағайындалған жоспарларды басқару.',
			hero_eyebrow: 'Мұғалім панелі',
			hero_title: 'Топтық дайындықты дедлайн мен прогреспен бірге басқарыңыз',
			hero_subtitle:
				'Мұғалім панелі тек өз топтарын көрсетеді: тіркелулер, дедлайндар, белсенділік, пікірлер және жоспар тағайындау.',
			sign_in_required: 'Бұл кеңістікті пайдалану үшін мұғалім аккаунтымен кіріңіз.',
			group_setup_eyebrow: 'Топ баптауы',
			group_setup_title: 'Топ құру және оқушыларды қосу',
			group_name: 'Топ атауы',
			group_name_placeholder: 'Физика 9А',
			claim_student_by_id: 'Оқушыны ID арқылы бекіту',
			claim_student: 'Оқушыны бекіту',
			subject: 'Пән',
			select_subject: 'Пәнді таңдаңыз',
			create_group: 'Топ құру',
			personal_students_eyebrow: 'Жеке оқушылар',
			personal_students_title: 'Осы мұғалімге бекітілген оқушылар',
			nearest_stage: 'Ең жақын кезең',
			nearest_status: 'Ең жақын мәртебе',
			personal_students_empty: 'Әзірге бекітілген оқушылар жоқ.',
			no_stage: 'Жақын кезең жоқ',
			group_summary_eyebrow: 'Топ жиынтығы',
			group_summary_title: 'Жауапкершілік аймағымен шектелген мұғалім көрінісі',
			select_group: 'Топты таңдаңыз',
			add_student_by_id: 'ID арқылы оқушы қосу',
			add_student: 'Оқушы қосу',
			loading_group: 'Топ жиынтығы жүктелуде...',
			upcoming_deadlines: 'Алдағы дедлайндар',
			no_deadlines: 'Алдағы дедлайндар жоқ.',
			student: 'Оқушы',
			school: 'Мектеп',
			grade: 'Сынып',
			registered_plus: 'Тіркелген+',
			result_added: 'Нәтиже қосылған',
			prep_min_30d: 'Дайындық мин (30к)',
			empty_group_summary: 'Жиынтықты көру үшін топ құрыңыз немесе таңдаңыз.',
			student_actions_eyebrow: 'Оқушы әрекеттері',
			student_actions_title: 'Пікірлер және тағайындалған дайындық жоспарлары',
			select_student: 'Оқушыны таңдаңыз',
			comment_text: 'Пікір мәтіні',
			comment_placeholder: 'Оқушыға кері байланыс',
			stage_id_optional: 'Кезең ID (міндетті емес)',
			stage_none: 'Жоқ',
			add_comment: 'Пікір қосу',
			send_notification: 'Хабарлама жіберу',
			notification_type: 'Хабарлама түрі',
			notification_type_reminder: 'Еске салу',
			notification_type_comment: 'Пікір',
			notification_title: 'Хабарлама тақырыбы',
			notification_title_placeholder: 'Маңызды жаңарту',
			notification_body: 'Хабарлама мәтіні',
			notification_body_placeholder: 'Оқушыға хабарлама',
			period_start: 'Период басы',
			period_end: 'Период соңы',
			item_type: 'Элемент түрі',
			item_target_count: 'Нысаналы саны',
			objective_optional: 'Мақсат (міндетті емес)',
			objective_placeholder: 'Жоспар мақсаты',
			item_topic: 'Элемент тақырыбы',
			item_topic_placeholder: 'Жаттығу тақырыбы',
			item_notes_optional: 'Ескертпе (міндетті емес)',
			item_notes_placeholder: 'Толығырақ',
			create_plan: 'Жоспар құру',
			load_plans: 'Жоспарларды жүктеу',
			plan_label: 'Жоспар',
			plan_no_objective: 'Мақсат мәтіні жоқ',
			status: 'күй',
			to: 'дейін',
			target: 'нысана',
			error_sign_in_first: 'Алдымен жүйеге кіріңіз.',
			error_group_required: 'Алдымен топ таңдаңыз.',
			error_group_input: 'Топ атауы мен пәні міндетті.',
			error_student_id_invalid: 'Оқушы ID оң бүтін сан болуы керек.',
			error_student_required: 'Алдымен оқушы таңдаңыз.',
			error_comment_required: 'Пікір мәтіні міндетті.',
			error_stage_id_invalid: 'stage_id оң бүтін сан болуы керек.',
			error_notification_title_required: 'Хабарлама тақырыбы міндетті.',
			error_notification_body_required: 'Хабарлама мәтіні міндетті.',
			error_subject_required: 'Дұрыс пән міндетті.',
			error_period_required: 'Жоспар кезеңін көрсетіңіз.',
			error_item_topic_required: 'Жоспар элементінің тақырыбы міндетті.',
			error_item_target_invalid: 'target_count оң бүтін сан болуы керек.',
			info_group_created: 'Топ құрылды.',
			info_student_claimed: 'Оқушы сізге бекітілді.',
			info_student_added: 'Оқушы топқа қосылды.',
			info_student_already_in_group: 'Оқушы бұл топта бар.',
			info_comment_created: 'Пікір сақталды.',
			info_notification_sent: 'Хабарлама жіберілді.',
			info_plan_created: 'Жоспар құрылды.'
		}
	};

	let loading = false;
	let working = false;
	let errorMessage: string | null = null;
	let infoMessage: string | null = null;

	let subjectOptions: DictionaryEntry[] = [];
	let groups: TeacherGroup[] = [];
	let claimedStudents: ClaimedTeacherStudent[] = [];
	let selectedGroupId = '';
	let groupSummary: {
		group: Record<string, unknown>;
		students: Array<Record<string, unknown>>;
		upcoming_deadlines: Array<Record<string, unknown>>;
	} | null = null;
	let stages: RoadmapItem[] = [];

	let selectedStudentId = '';
	let studentPlans: TeacherPlan[] = [];

	let createGroupName = '';
	let createGroupSubjectId = '';
	let addStudentId = '';
	let claimStudentId = '';
	let commentText = '';
	let commentStageId = '';
	let notificationType: 'reminder' | 'new_comment' = 'reminder';
	let notificationTitle = '';
	let notificationBody = '';

	let planSubjectId = '';
	let planPeriodStart = new Date().toISOString().slice(0, 10);
	let planPeriodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);
	let planObjective = '';
	let planItemType: 'theory' | 'problems' | 'mock_exam' = 'problems';
	let planItemTopic = '';
	let planItemTargetCount = '10';
	let planItemNotes = '';

	let activeToken: string | null = null;

	const copy = (): UiCopy => COPY[resolveLocale()];

	const asNumber = (value: unknown): number | null => {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === 'string' && value.trim().length > 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	};

	const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

	const subjectFromSummary = (summaryGroup: Record<string, unknown>): string => {
		const locale = resolveLocale();
		if (locale === 'ru') {
			return asString(summaryGroup.subject_name_ru) || asString(summaryGroup.subject_code);
		}
		if (locale === 'kz') {
			return asString(summaryGroup.subject_name_kz) || asString(summaryGroup.subject_code);
		}
		return asString(summaryGroup.subject_code);
	};

	const selectableStudents = () => {
		const byId = new Map<
			string,
			{
				student_id: string;
				student_name: string;
			}
		>();

		if (groupSummary) {
			for (const student of groupSummary.students) {
				const studentId = String(student.student_id ?? '');
				if (!studentId) {
					continue;
				}
				byId.set(studentId, {
					student_id: studentId,
					student_name: asString(student.student_name)
				});
			}
		}

		for (const student of claimedStudents) {
			const studentId = String(student.student_id);
			if (!byId.has(studentId)) {
				byId.set(studentId, {
					student_id: studentId,
					student_name: student.student_name
				});
			}
		}

		return Array.from(byId.values());
	};

	const syncSelectedStudent = () => {
		const students = selectableStudents();
		if (students.length === 0) {
			selectedStudentId = '';
			return;
		}

		const hasCurrent = students.some((student) => student.student_id === selectedStudentId);
		if (!hasCurrent) {
			selectedStudentId = students[0].student_id;
		}
	};

	const nearestStatusLabel = (status: unknown): string => {
		const normalized = asString(status);
		return normalized ? registrationStatusLabel(normalized) : copy().no_stage;
	};

	const loadTeacherData = async (token: string) => {
		loading = true;
		errorMessage = null;

		try {
			const [dictionaries, teacherGroups, roadmap, claimed] = await Promise.all([
				api.getDictionaries(),
				api.getTeacherGroups(token),
				api.getRoadmap(token),
				api.getClaimedTeacherStudents(token)
			]);
			subjectOptions = dictionaries.subjects;
			groups = teacherGroups.items;
			stages = roadmap.items;
			claimedStudents = claimed.items;

			if (!createGroupSubjectId && subjectOptions.length > 0) {
				createGroupSubjectId = String(subjectOptions[0].id);
			}
			if (!planSubjectId && subjectOptions.length > 0) {
				planSubjectId = String(subjectOptions[0].id);
			}

			if (!selectedGroupId && groups.length > 0) {
				selectedGroupId = String(groups[0].id);
			}

			if (selectedGroupId) {
				await loadGroupSummary(token, Number(selectedGroupId));
			} else {
				groupSummary = null;
				syncSelectedStudent();
				studentPlans = [];
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
			groups = [];
			groupSummary = null;
			stages = [];
			claimedStudents = [];
		} finally {
			loading = false;
		}
	};

	const loadGroupSummary = async (token: string, groupId: number) => {
		const summary = await api.getTeacherGroupSummary(token, groupId);
		groupSummary = summary;
		syncSelectedStudent();
		studentPlans = [];
	};

	const onCreateGroup = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		const subjectId = Number(createGroupSubjectId);
		if (!createGroupName.trim() || !Number.isInteger(subjectId) || subjectId <= 0) {
			errorMessage = copy().error_group_input;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.createTeacherGroup(token, {
				name: createGroupName.trim(),
				subject_id: subjectId
			});
			infoMessage = copy().info_group_created;
			createGroupName = '';
			await loadTeacherData(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onSelectGroup = async (event: Event) => {
		const target = event.currentTarget as HTMLSelectElement;
		selectedGroupId = target.value;
		const token = currentToken();
		const groupId = Number(selectedGroupId);
		if (!token || !Number.isInteger(groupId) || groupId <= 0) {
			groupSummary = null;
			syncSelectedStudent();
			studentPlans = [];
			return;
		}

		loading = true;
		errorMessage = null;
		try {
			await loadGroupSummary(token, groupId);
		} catch (error) {
			errorMessage = getErrorMessage(error);
			groupSummary = null;
			syncSelectedStudent();
		} finally {
			loading = false;
		}
	};

	const onAddStudent = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		const groupId = Number(selectedGroupId);
		const studentId = Number(addStudentId);

		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(groupId) || groupId <= 0) {
			errorMessage = copy().error_group_required;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_id_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			const response = await api.addStudentToGroup(token, groupId, studentId);
			infoMessage = response.added
				? copy().info_student_added
				: copy().info_student_already_in_group;
			addStudentId = '';
			await loadTeacherData(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onClaimStudent = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		const studentId = Number(claimStudentId);

		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_id_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.claimTeacherStudent(token, studentId);
			infoMessage = copy().info_student_claimed;
			claimStudentId = '';
			await loadTeacherData(token);
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onAddComment = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		const studentId = Number(selectedStudentId);
		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_required;
			return;
		}
		if (!commentText.trim()) {
			errorMessage = copy().error_comment_required;
			return;
		}

		const stageId = commentStageId.trim().length > 0 ? Number(commentStageId) : null;
		if (commentStageId.trim().length > 0 && (!Number.isInteger(stageId) || (stageId ?? 0) <= 0)) {
			errorMessage = copy().error_stage_id_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.addTeacherComment(token, studentId, {
				text: commentText.trim(),
				stage_id: stageId
			});
			infoMessage = copy().info_comment_created;
			commentText = '';
			commentStageId = '';
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onSendNotification = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		const studentId = Number(selectedStudentId);
		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_required;
			return;
		}
		if (!notificationTitle.trim()) {
			errorMessage = copy().error_notification_title_required;
			return;
		}
		if (!notificationBody.trim()) {
			errorMessage = copy().error_notification_body_required;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.sendTeacherNotification(token, studentId, {
				type: notificationType,
				title: notificationTitle.trim(),
				body: notificationBody.trim()
			});
			infoMessage = copy().info_notification_sent;
			notificationTitle = '';
			notificationBody = '';
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onCreatePlan = async (event: SubmitEvent) => {
		event.preventDefault();
		const token = currentToken();
		const studentId = Number(selectedStudentId);
		const subjectId = Number(planSubjectId);
		const targetCount = Number(planItemTargetCount);

		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_required;
			return;
		}
		if (!Number.isInteger(subjectId) || subjectId <= 0) {
			errorMessage = copy().error_subject_required;
			return;
		}
		if (!planPeriodStart || !planPeriodEnd) {
			errorMessage = copy().error_period_required;
			return;
		}
		if (!planItemTopic.trim()) {
			errorMessage = copy().error_item_topic_required;
			return;
		}
		if (!Number.isInteger(targetCount) || targetCount <= 0) {
			errorMessage = copy().error_item_target_invalid;
			return;
		}

		working = true;
		errorMessage = null;
		infoMessage = null;
		try {
			await api.createTeacherPlan(token, studentId, {
				subject_id: subjectId,
				period_start: planPeriodStart,
				period_end: planPeriodEnd,
				objective_text: planObjective.trim().length > 0 ? planObjective.trim() : null,
				status: 'draft',
				items: [
					{
						item_type: planItemType,
						topic: planItemTopic.trim(),
						target_count: targetCount,
						notes: planItemNotes.trim().length > 0 ? planItemNotes.trim() : null
					}
				]
			});
			infoMessage = copy().info_plan_created;
			planObjective = '';
			planItemTopic = '';
			planItemTargetCount = '10';
			planItemNotes = '';
			await onLoadPlans();
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			working = false;
		}
	};

	const onLoadPlans = async () => {
		const token = currentToken();
		const studentId = Number(selectedStudentId);
		if (!token) {
			errorMessage = copy().error_sign_in_first;
			return;
		}
		if (!Number.isInteger(studentId) || studentId <= 0) {
			errorMessage = copy().error_student_required;
			return;
		}

		working = true;
		errorMessage = null;
		try {
			const response = await api.getTeacherPlans(token, studentId);
			studentPlans = response.items;
		} catch (error) {
			errorMessage = getErrorMessage(error);
			studentPlans = [];
		} finally {
			working = false;
		}
	};

	onMount(() => {
		const syncFromSession = () => {
			const token = currentToken();
			if (!token) {
				activeToken = null;
				groups = [];
				claimedStudents = [];
				groupSummary = null;
				stages = [];
				selectedStudentId = '';
				studentPlans = [];
				loading = false;
				return;
			}
			if (token === activeToken) {
				return;
			}
			activeToken = token;
			void loadTeacherData(token);
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

<div class="teacher-shell">
	<section class="page-panel page-hero hero-panel">
		<p class="page-eyebrow">{copy().hero_eyebrow}</p>
		<h1 class="page-title">{copy().hero_title}</h1>
		<p class="page-subtitle">{copy().hero_subtitle}</p>
	</section>

	{#if !currentToken()}
		<section class="page-panel">
			<p class="page-subtitle">{copy().sign_in_required}</p>
		</section>
	{:else}
		<section class="page-panel">
			<header class="section-heading">
				<p>{copy().group_setup_eyebrow}</p>
				<h2>{copy().group_setup_title}</h2>
			</header>
			<form class="grid-2 form-grid teacher-form" onsubmit={onCreateGroup}>
				<label>
					<span>{copy().group_name}</span>
					<input bind:value={createGroupName} placeholder={copy().group_name_placeholder} />
				</label>
				<label>
					<span>{copy().subject}</span>
					<select bind:value={createGroupSubjectId}>
						<option value="">{copy().select_subject}</option>
						{#each subjectOptions as subject (subject.id)}
							<option value={String(subject.id)}>{dictionaryLabel(subject)}</option>
						{/each}
					</select>
				</label>
				<div class="hero-actions wide">
					<button class="btn-primary" type="submit" disabled={working || loading}
						>{copy().create_group}</button
					>
				</div>
			</form>
			<form class="inline-form claim-form" onsubmit={onClaimStudent}>
				<label>
					<span>{copy().claim_student_by_id}</span>
					<input bind:value={claimStudentId} type="number" min="1" placeholder="123" />
				</label>
				<button class="btn-secondary" type="submit" disabled={working || loading}>
					{copy().claim_student}
				</button>
			</form>
		</section>

		<section class="page-panel">
			<header class="section-heading">
				<p>{copy().personal_students_eyebrow}</p>
				<h2>{copy().personal_students_title}</h2>
			</header>
			{#if claimedStudents.length === 0}
				<p class="page-subtitle">{copy().personal_students_empty}</p>
			{:else}
				<div class="table-shell">
					<table class="simple-table teacher-table">
						<thead>
							<tr>
								<th>{copy().student}</th>
								<th>{copy().school}</th>
								<th>{copy().grade}</th>
								<th>{copy().nearest_stage}</th>
								<th>{copy().nearest_status}</th>
							</tr>
						</thead>
						<tbody>
							{#each claimedStudents as student (student.student_id)}
								<tr>
									<td data-label={copy().student}>
										{student.student_name} (#{student.student_id})
									</td>
									<td data-label={copy().school}>{student.school || '-'}</td>
									<td data-label={copy().grade}>{student.grade ?? '-'}</td>
									<td data-label={copy().nearest_stage}>
										{student.nearest_stage_name || copy().no_stage}
										{#if student.nearest_stage_deadline}
											<br />
											<small>{formatDate(student.nearest_stage_deadline)}</small>
										{/if}
									</td>
									<td data-label={copy().nearest_status}>
										{nearestStatusLabel(student.nearest_stage_status)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<section class="page-panel">
			<header class="section-heading">
				<p>{copy().group_summary_eyebrow}</p>
				<h2>{copy().group_summary_title}</h2>
			</header>
			<div class="grid-2 form-grid summary-controls">
				<label>
					<span>{copy().select_group}</span>
					<select bind:value={selectedGroupId} onchange={onSelectGroup}>
						<option value="">{copy().select_group}</option>
						{#each groups as group (group.id)}
							<option value={String(group.id)}>{group.name} ({group.student_count})</option>
						{/each}
					</select>
				</label>
				<form class="inline-form" onsubmit={onAddStudent}>
					<label>
						<span>{copy().add_student_by_id}</span>
						<input bind:value={addStudentId} type="number" min="1" placeholder="123" />
					</label>
					<button class="btn-secondary" type="submit" disabled={working || !selectedGroupId}>
						{copy().add_student}
					</button>
				</form>
			</div>

			{#if loading}
				<p class="page-subtitle">{copy().loading_group}</p>
			{:else if groupSummary}
				<div class="grid-2 summary-cards">
					<article class="surface-card">
						<h3>{asString(groupSummary.group.name)}</h3>
						<p>
							{copy().subject}: {subjectFromSummary(groupSummary.group)} · {copy().student}:
							{asNumber(groupSummary.group.student_count) ?? 0}
						</p>
					</article>
					<article class="surface-card">
						<h3>{copy().upcoming_deadlines}</h3>
						{#if groupSummary.upcoming_deadlines.length === 0}
							<p>{copy().no_deadlines}</p>
						{:else}
							<ul>
								{#each groupSummary.upcoming_deadlines as deadline, index (`${deadline.stage_id ?? index}`)}
									<li>
										{asString(deadline.student_name)} · {asString(deadline.stage_name)} ·
										{formatDate(asString(deadline.registration_deadline))}
									</li>
								{/each}
							</ul>
						{/if}
					</article>
				</div>

				<div class="table-shell">
					<table class="simple-table teacher-table">
						<thead>
							<tr>
								<th>{copy().student}</th>
								<th>{copy().school}</th>
								<th>{copy().grade}</th>
								<th>{copy().registered_plus}</th>
								<th>{copy().result_added}</th>
								<th>{copy().prep_min_30d}</th>
							</tr>
						</thead>
						<tbody>
							{#each groupSummary.students as student, index (`${student.student_id ?? index}`)}
								<tr>
									<td data-label={copy().student}>
										{asString(student.student_name)} (#{student.student_id})
									</td>
									<td data-label={copy().school}>{asString(student.school) || '-'}</td>
									<td data-label={copy().grade}>{asNumber(student.grade) ?? '-'}</td>
									<td data-label={copy().registered_plus}>
										{asNumber(student.registered_or_more) ?? 0}
									</td>
									<td data-label={copy().result_added}>
										{asNumber(student.result_added_count) ?? 0}
									</td>
									<td data-label={copy().prep_min_30d}>
										{asNumber(student.prep_minutes_30d) ?? 0}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="page-subtitle">{copy().empty_group_summary}</p>
			{/if}
		</section>

		<section class="page-panel">
			<header class="section-heading">
				<p>{copy().student_actions_eyebrow}</p>
				<h2>{copy().student_actions_title}</h2>
			</header>

			<div class="grid-2 form-grid summary-controls">
				<label>
					<span>{copy().student}</span>
					<select bind:value={selectedStudentId}>
						<option value="">{copy().select_student}</option>
						{#each selectableStudents() as student (student.student_id)}
							<option value={student.student_id}>
								{student.student_name} (#{student.student_id})
							</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="actions-grid">
				<form class="grid-2 form-grid action-form" onsubmit={onAddComment}>
					<label class="wide">
						<span>{copy().comment_text}</span>
						<textarea bind:value={commentText} rows="3" placeholder={copy().comment_placeholder}
						></textarea>
					</label>
					<label>
						<span>{copy().stage_id_optional}</span>
						<select bind:value={commentStageId}>
							<option value="">{copy().stage_none}</option>
							{#each stages as stage (stage.stage_id)}
								<option value={String(stage.stage_id)}
									>{stage.olympiad_title} / {stage.stage_name}</option
								>
							{/each}
						</select>
					</label>
					<div class="hero-actions wide">
						<button class="btn-secondary" type="submit" disabled={working || !selectedStudentId}>
							{copy().add_comment}
						</button>
					</div>
				</form>

				<form class="grid-2 form-grid action-form" onsubmit={onSendNotification}>
					<label>
						<span>{copy().notification_type}</span>
						<select bind:value={notificationType}>
							<option value="reminder">{copy().notification_type_reminder}</option>
							<option value="new_comment">{copy().notification_type_comment}</option>
						</select>
					</label>
					<label class="wide">
						<span>{copy().notification_title}</span>
						<input
							bind:value={notificationTitle}
							placeholder={copy().notification_title_placeholder}
						/>
					</label>
					<label class="wide">
						<span>{copy().notification_body}</span>
						<textarea
							bind:value={notificationBody}
							rows="3"
							placeholder={copy().notification_body_placeholder}
						></textarea>
					</label>
					<div class="hero-actions wide">
						<button class="btn-secondary" type="submit" disabled={working || !selectedStudentId}>
							{copy().send_notification}
						</button>
					</div>
				</form>

				<form class="grid-2 form-grid action-form" onsubmit={onCreatePlan}>
					<label>
						<span>{copy().subject}</span>
						<select bind:value={planSubjectId}>
							<option value="">{copy().select_subject}</option>
							{#each subjectOptions as subject (subject.id)}
								<option value={String(subject.id)}>{dictionaryLabel(subject)}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>{copy().period_start}</span>
						<input bind:value={planPeriodStart} type="date" />
					</label>
					<label>
						<span>{copy().period_end}</span>
						<input bind:value={planPeriodEnd} type="date" />
					</label>
					<label>
						<span>{copy().item_type}</span>
						<select bind:value={planItemType}>
							<option value="theory">{prepTypeLabel('theory')}</option>
							<option value="problems">{prepTypeLabel('problems')}</option>
							<option value="mock_exam">{prepTypeLabel('mock_exam')}</option>
						</select>
					</label>
					<label>
						<span>{copy().item_target_count}</span>
						<input bind:value={planItemTargetCount} type="number" min="1" />
					</label>
					<label class="wide">
						<span>{copy().objective_optional}</span>
						<input bind:value={planObjective} placeholder={copy().objective_placeholder} />
					</label>
					<label class="wide">
						<span>{copy().item_topic}</span>
						<input bind:value={planItemTopic} placeholder={copy().item_topic_placeholder} />
					</label>
					<label class="wide">
						<span>{copy().item_notes_optional}</span>
						<input bind:value={planItemNotes} placeholder={copy().item_notes_placeholder} />
					</label>
					<div class="hero-actions wide">
						<button class="btn-primary" type="submit" disabled={working || !selectedStudentId}>
							{copy().create_plan}
						</button>
						<button
							class="btn-secondary"
							type="button"
							onclick={onLoadPlans}
							disabled={working || !selectedStudentId}
						>
							{copy().load_plans}
						</button>
					</div>
				</form>
			</div>

			{#if studentPlans.length > 0}
				<div class="grid-2 plans-grid">
					{#each studentPlans as plan (plan.id)}
						<article class="surface-card">
							<h3>{copy().plan_label} #{plan.id}</h3>
							<p>
								{plan.period_start}
								{copy().to}
								{plan.period_end} · {copy().status}: {plan.status}
							</p>
							<p>{plan.objective_text || copy().plan_no_objective}</p>
							<ul>
								{#each plan.items as item (item.id)}
									<li>
										{prepTypeLabel(item.item_type)}: {item.topic} ({copy().target}
										{item.target_count})
									</li>
								{/each}
							</ul>
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
</div>

<style>
	.teacher-shell {
		display: grid;
		gap: 1rem;
	}

	.hero-panel {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--ol-border);
		background:
			radial-gradient(120% 120% at 100% 0%, rgba(24, 99, 209, 0.1), transparent 58%),
			linear-gradient(160deg, #ffffff 0%, #f8fbff 100%);
	}

	.hero-panel .page-title {
		max-width: 32ch;
	}

	.hero-panel .page-subtitle {
		max-width: 68ch;
	}

	.section-heading {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 0.8rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 0.9rem;
	}

	.form-grid label {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	.form-grid span {
		font-size: 0.79rem;
		font-weight: 700;
		color: var(--ol-primary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.form-grid input,
	.form-grid select,
	.form-grid textarea {
		border: 1px solid var(--ol-border);
		border-radius: 0.64rem;
		padding: 0.56rem 0.62rem;
		font: inherit;
		color: var(--ol-ink);
		background: #ffffff;
		min-width: 0;
	}

	.form-grid textarea {
		resize: vertical;
		min-height: 6rem;
	}

	.form-grid .wide {
		grid-column: span 2;
	}

	.summary-controls {
		align-items: end;
	}

	.inline-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: end;
	}

	.inline-form button {
		height: 2.45rem;
		padding-inline: 0.9rem;
	}

	.claim-form {
		margin-top: 0.9rem;
	}

	.summary-cards,
	.plans-grid {
		gap: 0.85rem;
		margin-top: 0.85rem;
	}

	.surface-card {
		border: 1px solid var(--ol-border);
		border-radius: 0.85rem;
		padding: 0.9rem 1rem;
		background: linear-gradient(160deg, #ffffff 0%, #fbfdff 100%);
		box-shadow: 0 8px 22px rgba(2, 20, 42, 0.04);
	}

	.surface-card h3 {
		margin-bottom: 0.3rem;
	}

	.surface-card ul {
		margin: 0.6rem 0 0;
		padding-left: 1rem;
		display: grid;
		gap: 0.35rem;
		color: var(--ol-ink-soft);
	}

	.table-shell {
		margin-top: 0.85rem;
		border: 1px solid var(--ol-border);
		border-radius: 0.85rem;
		overflow-x: auto;
		background: #ffffff;
	}

	.teacher-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 700px;
	}

	.teacher-table th,
	.teacher-table td {
		padding: 0.62rem 0.68rem;
		text-align: left;
		border-bottom: 1px solid var(--ol-border);
		vertical-align: top;
	}

	.teacher-table th {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ol-ink-soft);
		background: #f9fbff;
	}

	.teacher-table tbody tr:last-child td {
		border-bottom: none;
	}

	.teacher-table tbody tr:hover {
		background: #fbfdff;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.9rem;
		margin-top: 0.9rem;
	}

	.action-form {
		border: 1px solid var(--ol-border);
		border-radius: 0.85rem;
		padding: 0.9rem 1rem;
		background: #ffffff;
	}

	.action-form .hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	@media (min-width: 980px) {
		.actions-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
	}

	@media (max-width: 980px) {
		.form-grid {
			grid-template-columns: 1fr;
		}

		.form-grid .wide {
			grid-column: span 1;
		}

		.inline-form {
			grid-template-columns: 1fr;
		}

		.inline-form button {
			width: 100%;
		}
	}

	@media (max-width: 760px) {
		.teacher-shell {
			gap: 0.8rem;
		}

		.hero-panel .page-title {
			max-width: 100%;
		}

		.table-shell {
			border: none;
			border-radius: 0;
			background: transparent;
			overflow: visible;
		}

		.teacher-table {
			min-width: 0;
			display: block;
		}

		.teacher-table thead {
			display: none;
		}

		.teacher-table tbody {
			display: grid;
			gap: 0.65rem;
		}

		.teacher-table tr {
			display: grid;
			gap: 0.35rem;
			padding: 0.72rem;
			border: 1px solid var(--ol-border);
			border-radius: 0.75rem;
			background: #ffffff;
		}

		.teacher-table td {
			border-bottom: none;
			padding: 0;
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.8rem;
			font-size: 0.9rem;
		}

		.teacher-table td::before {
			content: attr(data-label);
			flex: 0 0 45%;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--ol-primary);
		}

		.action-form .hero-actions {
			display: grid;
			grid-template-columns: 1fr;
		}

		.action-form .hero-actions button {
			width: 100%;
		}
	}
</style>
