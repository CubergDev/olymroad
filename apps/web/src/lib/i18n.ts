import type {
	DictionaryEntry,
	EntityStatus,
	OlympiadFormat,
	PrepType,
	RegistrationStatus,
	ResultStatus,
	UserRole
} from './api';
import { getLocale } from '$lib/paraglide/runtime';

export type UiLocale = 'en' | 'ru' | 'kz';

const DATE_LOCALES: Record<UiLocale, string> = {
	en: 'en-US',
	ru: 'ru-RU',
	kz: 'kk-KZ'
};

const ROLE_LABELS: Record<UserRole, Record<UiLocale, string>> = {
	student: { en: 'Student', ru: 'Ученик', kz: 'Оқушы' },
	teacher: { en: 'Teacher', ru: 'Учитель', kz: 'Мұғалім' },
	admin: { en: 'Admin', ru: 'Администратор', kz: 'Әкімші' }
};

const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, Record<UiLocale, string>> = {
	planned: { en: 'Planned', ru: 'Запланировано', kz: 'Жоспарда' },
	registered: { en: 'Registered', ru: 'Зарегистрирован', kz: 'Тіркелген' },
	participated: { en: 'Participated', ru: 'Участвовал', kz: 'Қатысқан' },
	result_added: { en: 'Result added', ru: 'Результат добавлен', kz: 'Нәтиже енгізілді' }
};

const RESULT_STATUS_LABELS: Record<ResultStatus, Record<UiLocale, string>> = {
	participant: { en: 'Participant', ru: 'Участник', kz: 'Қатысушы' },
	prize_winner: { en: 'Prize winner', ru: 'Призер', kz: 'Жүлдегер' },
	winner: { en: 'Winner', ru: 'Победитель', kz: 'Жеңімпаз' }
};

const PREP_TYPE_LABELS: Record<PrepType, Record<UiLocale, string>> = {
	theory: { en: 'Theory', ru: 'Теория', kz: 'Теория' },
	problems: { en: 'Problems', ru: 'Задачи', kz: 'Есептер' },
	mock_exam: { en: 'Mock exam', ru: 'Пробный экзамен', kz: 'Сынақ емтиханы' }
};

const OLYMPIAD_FORMAT_LABELS: Record<OlympiadFormat, Record<UiLocale, string>> = {
	online: { en: 'Online', ru: 'Онлайн', kz: 'Онлайн' },
	offline: { en: 'Offline', ru: 'Офлайн', kz: 'Офлайн' },
	mixed: { en: 'Mixed', ru: 'Смешанный', kz: 'Аралас' }
};

const EVENT_TYPE_LABELS: Record<string, Record<UiLocale, string>> = {
	olympiad: { en: 'Olympiad', ru: 'Олимпиада', kz: 'Олимпиада' },
	research_projects: {
		en: 'Research project',
		ru: 'Научный проект',
		kz: 'Ғылыми жоба'
	},
	contest_game: { en: 'Contest game', ru: 'Конкурс-игра', kz: 'Байқау-ойын' },
	hackathon: { en: 'Hackathon', ru: 'Хакатон', kz: 'Хакатон' },
	camp: { en: 'Camp', ru: 'Сборы', kz: 'Жиын' },
	other: { en: 'Other', ru: 'Другое', kz: 'Басқа' }
};

const STAGE_TYPE_LABELS: Record<string, Record<UiLocale, string>> = {
	selection: { en: 'Selection', ru: 'Отбор', kz: 'Іріктеу' },
	regional: { en: 'Regional', ru: 'Региональный', kz: 'Аймақтық' },
	final: { en: 'Final', ru: 'Финал', kz: 'Финал' },
	submission: { en: 'Submission', ru: 'Подача', kz: 'Тапсыру' },
	defense: { en: 'Defense', ru: 'Защита', kz: 'Қорғау' },
	training: { en: 'Training', ru: 'Тренировка', kz: 'Жаттығу' }
};

const ENTITY_STATUS_LABELS: Record<EntityStatus, Record<UiLocale, string>> = {
	draft: { en: 'Draft', ru: 'Черновик', kz: 'Жоба' },
	published: { en: 'Published', ru: 'Опубликовано', kz: 'Жарияланған' },
	archived: { en: 'Archived', ru: 'Архив', kz: 'Мұрағат' }
};

const NOTIFICATION_TYPE_LABELS: Record<
	'deadline_soon' | 'new_comment' | 'result_added' | 'reminder',
	Record<UiLocale, string>
> = {
	deadline_soon: { en: 'Deadline soon', ru: 'Скоро дедлайн', kz: 'Мерзім жақын' },
	new_comment: { en: 'New comment', ru: 'Новый комментарий', kz: 'Жаңа пікір' },
	result_added: { en: 'Result added', ru: 'Результат добавлен', kz: 'Нәтиже енгізілді' },
	reminder: { en: 'Reminder', ru: 'Напоминание', kz: 'Еске салу' }
};

const TREND_LABELS: Record<string, Record<UiLocale, string>> = {
	insufficient_data: {
		en: 'Insufficient data',
		ru: 'Недостаточно данных',
		kz: 'Дерек жеткіліксіз'
	},
	improving: { en: 'Improving', ru: 'Улучшение', kz: 'Жақсару' },
	declining: { en: 'Declining', ru: 'Снижение', kz: 'Төмендеу' },
	stable: { en: 'Stable', ru: 'Стабильно', kz: 'Тұрақты' }
};

const CORRELATION_INTERPRETATION_LABELS: Record<string, Record<UiLocale, string>> = {
	insufficient_data: {
		en: 'Insufficient data',
		ru: 'Недостаточно данных',
		kz: 'Дерек жеткіліксіз'
	},
	positive: { en: 'Positive', ru: 'Положительная', kz: 'Оң' },
	negative: { en: 'Negative', ru: 'Отрицательная', kz: 'Теріс' },
	weak_or_none: {
		en: 'Weak or none',
		ru: 'Слабая или отсутствует',
		kz: 'Әлсіз немесе жоқ'
	},
	strong_positive: {
		en: 'Strong positive',
		ru: 'Сильная положительная',
		kz: 'Күшті оң'
	},
	moderate_positive: {
		en: 'Moderate positive',
		ru: 'Умеренная положительная',
		kz: 'Орташа оң'
	},
	weak_positive: { en: 'Weak positive', ru: 'Слабая положительная', kz: 'Әлсіз оң' },
	no_clear_relation: {
		en: 'No clear relation',
		ru: 'Явной связи нет',
		kz: 'Айқын байланыс жоқ'
	},
	weak_negative: { en: 'Weak negative', ru: 'Слабая отрицательная', kz: 'Әлсіз теріс' },
	moderate_negative: {
		en: 'Moderate negative',
		ru: 'Умеренная отрицательная',
		kz: 'Орташа теріс'
	},
	strong_negative: {
		en: 'Strong negative',
		ru: 'Сильная отрицательная',
		kz: 'Күшті теріс'
	}
};

const ANALYTICS_RECOMMENDATION_MAP: Record<string, Record<UiLocale, string>> = {
	'Add at least one mock exam this week.': {
		en: 'Add at least one mock exam this week.',
		ru: 'Добавьте хотя бы один пробный экзамен на этой неделе.',
		kz: 'Осы аптада кемінде бір сынақ емтиханын қосыңыз.'
	},
	'Weekly study minutes are below 50% of the goal.': {
		en: 'Weekly study minutes are below 50% of the goal.',
		ru: 'Недельный объем подготовки ниже 50% от цели.',
		kz: 'Апталық дайындық уақыты мақсаттың 50%-ынан төмен.'
	},
	'Monthly study progress is below 40% of target minutes.': {
		en: 'Monthly study progress is below 40% of target minutes.',
		ru: 'Месячный прогресс ниже 40% от целевых минут.',
		kz: 'Айлық прогресс мақсат минуттарының 40%-ынан төмен.'
	},
	'Add olympiad results to unlock score trend analytics.': {
		en: 'Add olympiad results to unlock score trend analytics.',
		ru: 'Добавьте результаты олимпиады, чтобы открыть аналитику тренда баллов.',
		kz: 'Ұпай динамикасын көру үшін олимпиада нәтижелерін қосыңыз.'
	},
	'Progress is stable. Keep the current preparation pace.': {
		en: 'Progress is stable. Keep the current preparation pace.',
		ru: 'Прогресс стабилен. Сохраните текущий темп подготовки.',
		kz: 'Ілгерілеу тұрақты. Дайындық қарқынын сақтаңыз.'
	}
};

const API_ERROR_BY_CODE: Record<string, Record<UiLocale, string>> = {
	api_url_missing: {
		en: 'Service is temporarily unavailable.',
		ru: 'Сервис временно недоступен.',
		kz: 'Қызмет уақытша қолжетімсіз.'
	},
	request_failed: {
		en: 'Request failed.',
		ru: 'Запрос завершился ошибкой.',
		kz: 'Сұрау сәтсіз аяқталды.'
	},
	validation_error: {
		en: 'Please check the entered data.',
		ru: 'Проверьте корректность введенных данных.',
		kz: 'Енгізілген деректерді тексеріңіз.'
	},
	unauthorized: {
		en: 'Sign in is required.',
		ru: 'Требуется вход в систему.',
		kz: 'Жүйеге кіру қажет.'
	},
	forbidden: {
		en: 'You do not have access to this action.',
		ru: 'У вас нет доступа к этому действию.',
		kz: 'Бұл әрекетке рұқсатыңыз жоқ.'
	},
	not_found: {
		en: 'Requested data was not found.',
		ru: 'Запрошенные данные не найдены.',
		kz: 'Сұралған деректер табылмады.'
	},
	internal_error: {
		en: 'Unexpected server error.',
		ru: 'Непредвиденная ошибка сервера.',
		kz: 'Сервердің күтпеген қатесі.'
	},
	email_taken: {
		en: 'This email is already registered.',
		ru: 'Этот email уже зарегистрирован.',
		kz: 'Бұл email бұрын тіркелген.'
	},
	invalid_credentials: {
		en: 'Invalid email or password.',
		ru: 'Неверный email или пароль.',
		kz: 'Email немесе құпиясөз қате.'
	},
	account_disabled: {
		en: 'Account is disabled.',
		ru: 'Аккаунт отключен.',
		kz: 'Тіркелгі өшірілген.'
	},
	email_not_verified: {
		en: 'Email is not verified.',
		ru: 'Email не подтвержден.',
		kz: 'Email расталмаған.'
	},
	invalid_otp: {
		en: 'Invalid verification code.',
		ru: 'Неверный код подтверждения.',
		kz: 'Растау коды қате.'
	},
	otp_expired: {
		en: 'Verification code has expired.',
		ru: 'Срок действия кода подтверждения истек.',
		kz: 'Растау кодының мерзімі аяқталды.'
	},
	otp_attempts_exceeded: {
		en: 'Too many invalid code attempts.',
		ru: 'Слишком много неверных попыток ввода кода.',
		kz: 'Кодты қате енгізу әрекеттері тым көп.'
	},
	email_service_not_configured: {
		en: 'Email service is not configured.',
		ru: 'Сервис отправки email не настроен.',
		kz: 'Email жіберу қызметі бапталмаған.'
	},
	email_send_failed: {
		en: 'Failed to send email.',
		ru: 'Не удалось отправить email.',
		kz: 'Email жіберу сәтсіз аяқталды.'
	},
	password_reset_failed: {
		en: 'Failed to reset password.',
		ru: 'Не удалось сбросить пароль.',
		kz: 'Құпиясөзді қалпына келтіру сәтсіз аяқталды.'
	},
	deadline_passed: {
		en: 'Registration deadline has passed.',
		ru: 'Срок регистрации уже прошел.',
		kz: 'Тіркелу мерзімі өтіп кетті.'
	},
	duplicate_code: {
		en: 'Code already exists.',
		ru: 'Код уже существует.',
		kz: 'Код бұрыннан бар.'
	},
	duplicate_resource: {
		en: 'This record already exists.',
		ru: 'Такая запись уже существует.',
		kz: 'Мұндай жазба бұрыннан бар.'
	},
	invalid_reference: {
		en: 'Referenced data is invalid or unavailable.',
		ru: 'Связанные данные некорректны или недоступны.',
		kz: 'Байланысты дерек қате немесе қолжетімсіз.'
	},
	required_field_missing: {
		en: 'Required field is missing.',
		ru: 'Отсутствует обязательное поле.',
		kz: 'Міндетті өріс жоқ.'
	},
	constraint_violation: {
		en: 'Data violates validation rules.',
		ru: 'Данные нарушают ограничения валидации.',
		kz: 'Деректер валидация шектеулерін бұзады.'
	},
	invalid_value: {
		en: 'Invalid value format.',
		ru: 'Некорректный формат значения.',
		kz: 'Мән пішімі қате.'
	},
	value_too_long: {
		en: 'Value is too long.',
		ru: 'Значение слишком длинное.',
		kz: 'Мән тым ұзын.'
	},
	database_retryable_error: {
		en: 'Temporary database conflict. Please retry.',
		ru: 'Временный конфликт базы данных. Повторите попытку.',
		kz: 'Дерекқорда уақытша қайшылық. Қайта көріңіз.'
	},
	schema_not_migrated: {
		en: 'Database schema is outdated. Run migrations.',
		ru: 'Схема базы данных устарела. Запустите миграции.',
		kz: 'Дерекқор схемасы ескірген. Миграцияларды іске қосыңыз.'
	},
	oauth_not_configured: {
		en: 'OAuth sign-in is not configured.',
		ru: 'OAuth-вход не настроен.',
		kz: 'OAuth арқылы кіру бапталмаған.'
	},
	invalid_oauth_token: {
		en: 'OAuth token is invalid or expired.',
		ru: 'OAuth-токен неверен или просрочен.',
		kz: 'OAuth токені қате немесе мерзімі өткен.'
	},
	oauth_account_conflict: {
		en: 'This OAuth account is linked to another user.',
		ru: 'Этот OAuth-аккаунт связан с другим пользователем.',
		kz: 'Бұл OAuth аккаунты басқа пайдаланушыға байланыстырылған.'
	},
	oauth_login_failed: {
		en: 'OAuth login failed.',
		ru: 'Ошибка OAuth-входа.',
		kz: 'OAuth кіру қатесі.'
	},
	oauth_link_failed: {
		en: 'Failed to link OAuth account.',
		ru: 'Не удалось привязать OAuth-аккаунт.',
		kz: 'OAuth аккаунтын байланыстыру сәтсіз аяқталды.'
	},
	oauth_unlink_failed: {
		en: 'Failed to unlink OAuth account.',
		ru: 'Не удалось отвязать OAuth-аккаунт.',
		kz: 'OAuth аккаунтын ажырату сәтсіз аяқталды.'
	},
	invalid_oauth_scope: {
		en: 'OAuth token is missing required permissions.',
		ru: 'OAuth-токен не содержит нужных разрешений.',
		kz: 'OAuth токенінде қажетті рұқсаттар жоқ.'
	},
	calendar_integration_not_found: {
		en: 'Google Calendar is not connected.',
		ru: 'Google Calendar не подключен.',
		kz: 'Google Calendar қосылмаған.'
	},
	insufficient_oauth_scope: {
		en: 'Connected Google token does not allow this sync operation.',
		ru: 'Подключенный Google-токен не позволяет эту синхронизацию.',
		kz: 'Қосылған Google токені бұл синхрондауды орындауға рұқсат бермейді.'
	},
	calendar_export_failed: {
		en: 'Failed to export calendar.',
		ru: 'Не удалось экспортировать календарь.',
		kz: 'Күнтізбені экспорттау сәтсіз аяқталды.'
	},
	calendar_status_failed: {
		en: 'Failed to load calendar status.',
		ru: 'Не удалось загрузить статус календаря.',
		kz: 'Күнтізбе күйін жүктеу сәтсіз аяқталды.'
	},
	calendar_connect_failed: {
		en: 'Failed to connect Google Calendar.',
		ru: 'Не удалось подключить Google Calendar.',
		kz: 'Google Calendar қосу сәтсіз аяқталды.'
	},
	calendar_disconnect_failed: {
		en: 'Failed to disconnect Google Calendar.',
		ru: 'Не удалось отключить Google Calendar.',
		kz: 'Google Calendar ажырату сәтсіз аяқталды.'
	},
	calendar_sync_failed: {
		en: 'Calendar sync failed.',
		ru: 'Синхронизация календаря завершилась ошибкой.',
		kz: 'Күнтізбе синхрондауы сәтсіз аяқталды.'
	},
	calendar_import_events_failed: {
		en: 'Failed to load imported calendar events.',
		ru: 'Не удалось загрузить импортированные события календаря.',
		kz: 'Импортталған күнтізбе оқиғаларын жүктеу сәтсіз аяқталды.'
	},
	gone: {
		en: 'Requested file is no longer available.',
		ru: 'Запрошенный файл больше недоступен.',
		kz: 'Сұралған файл енді қолжетімсіз.'
	},
	db_unavailable: {
		en: 'Database is unavailable.',
		ru: 'База данных недоступна.',
		kz: 'Дерекқор қолжетімсіз.'
	},
	dictionaries_failed: {
		en: 'Failed to load dictionaries.',
		ru: 'Не удалось загрузить справочники.',
		kz: 'Анықтамалықтарды жүктеу сәтсіз аяқталды.'
	},
	olympiads_fetch_failed: {
		en: 'Failed to fetch olympiads.',
		ru: 'Не удалось загрузить олимпиады.',
		kz: 'Олимпиадаларды жүктеу сәтсіз аяқталды.'
	},
	analytics_scores_failed: {
		en: 'Failed to load score analytics.',
		ru: 'Не удалось загрузить аналитику баллов.',
		kz: 'Ұпай аналитикасын жүктеу сәтсіз аяқталды.'
	},
	analytics_funnel_failed: {
		en: 'Failed to load funnel analytics.',
		ru: 'Не удалось загрузить аналитику воронки.',
		kz: 'Воронка аналитикасын жүктеу сәтсіз аяқталды.'
	},
	analytics_forecast_failed: {
		en: 'Failed to build forecast.',
		ru: 'Не удалось построить прогноз.',
		kz: 'Болжам құру сәтсіз аяқталды.'
	},
	analytics_summary_failed: {
		en: 'Failed to build analytics summary.',
		ru: 'Не удалось сформировать сводку аналитики.',
		kz: 'Аналитика қорытындысын құру сәтсіз аяқталды.'
	},
	notifications_failed: {
		en: 'Failed to load notifications.',
		ru: 'Не удалось загрузить уведомления.',
		kz: 'Хабарламаларды жүктеу сәтсіз аяқталды.'
	},
	notification_mark_failed: {
		en: 'Failed to update notification status.',
		ru: 'Не удалось обновить статус уведомления.',
		kz: 'Хабарлама күйін жаңарту сәтсіз аяқталды.'
	},
	roadmap_failed: {
		en: 'Failed to load plan.',
		ru: 'Не удалось загрузить план.',
		kz: 'Жоспарды жүктеу сәтсіз аяқталды.'
	},
	stage_fetch_failed: {
		en: 'Failed to load stage details.',
		ru: 'Не удалось загрузить данные этапа.',
		kz: 'Кезең деректерін жүктеу сәтсіз аяқталды.'
	},
	stage_not_found: {
		en: 'Stage not found.',
		ru: 'Этап не найден.',
		kz: 'Кезең табылмады.'
	},
	registration_failed: {
		en: 'Failed to register to stage.',
		ru: 'Не удалось зарегистрироваться на этап.',
		kz: 'Кезеңге тіркелу сәтсіз аяқталды.'
	},
	registration_status_failed: {
		en: 'Failed to update registration status.',
		ru: 'Не удалось обновить статус регистрации.',
		kz: 'Тіркелу күйін жаңарту сәтсіз аяқталды.'
	},
	registrations_failed: {
		en: 'Failed to load registrations.',
		ru: 'Не удалось загрузить регистрации.',
		kz: 'Тіркелулерді жүктеу сәтсіз аяқталды.'
	},
	result_failed: {
		en: 'Failed to save result.',
		ru: 'Не удалось сохранить результат.',
		kz: 'Нәтижені сақтау сәтсіз аяқталды.'
	},
	groups_fetch_failed: {
		en: 'Failed to load teacher groups.',
		ru: 'Не удалось загрузить группы учителя.',
		kz: 'Мұғалім топтарын жүктеу сәтсіз аяқталды.'
	},
	group_create_failed: {
		en: 'Failed to create group.',
		ru: 'Не удалось создать группу.',
		kz: 'Топ құру сәтсіз аяқталды.'
	},
	group_student_add_failed: {
		en: 'Failed to add student to group.',
		ru: 'Не удалось добавить ученика в группу.',
		kz: 'Оқушыны топқа қосу сәтсіз аяқталды.'
	},
	claim_student_failed: {
		en: 'Failed to claim student.',
		ru: 'Не удалось закрепить ученика за учителем.',
		kz: 'Оқушыны мұғалімге бекіту сәтсіз аяқталды.'
	},
	claimed_students_fetch_failed: {
		en: 'Failed to load claimed students.',
		ru: 'Не удалось загрузить закрепленных учеников.',
		kz: 'Бекітілген оқушыларды жүктеу сәтсіз аяқталды.'
	},
	group_summary_failed: {
		en: 'Failed to load group summary.',
		ru: 'Не удалось загрузить сводку по группе.',
		kz: 'Топ жиынтығын жүктеу сәтсіз аяқталды.'
	},
	comment_create_failed: {
		en: 'Failed to create comment.',
		ru: 'Не удалось создать комментарий.',
		kz: 'Пікір құру сәтсіз аяқталды.'
	},
	plan_create_failed: {
		en: 'Failed to create plan.',
		ru: 'Не удалось создать план.',
		kz: 'Жоспар құру сәтсіз аяқталды.'
	},
	plans_fetch_failed: {
		en: 'Failed to load plans.',
		ru: 'Не удалось загрузить планы.',
		kz: 'Жоспарларды жүктеу сәтсіз аяқталды.'
	},
	plan_update_failed: {
		en: 'Failed to update plan.',
		ru: 'Не удалось обновить план.',
		kz: 'Жоспарды жаңарту сәтсіз аяқталды.'
	},
	notification_send_failed: {
		en: 'Failed to send notification.',
		ru: 'Не удалось отправить уведомление.',
		kz: 'Хабарлама жіберу сәтсіз аяқталды.'
	},
	storage_invalid_metadata: {
		en: 'File metadata is invalid.',
		ru: 'Метаданные файла некорректны.',
		kz: 'Файл метадеректері қате.'
	},
	file_not_found: {
		en: 'File not found.',
		ru: 'Файл не найден.',
		kz: 'Файл табылмады.'
	},
	file_deleted: {
		en: 'File has been deleted.',
		ru: 'Файл удален.',
		kz: 'Файл жойылған.'
	}
};

const API_ERROR_BY_MESSAGE: Record<string, Record<UiLocale, string>> = {
	'PUBLIC_API_URL is not configured.': {
		en: 'Service is temporarily unavailable.',
		ru: 'Сервис временно недоступен.',
		kz: 'Қызмет уақытша қолжетімсіз.'
	},
	'Failed to fetch': {
		en: 'Network error. Check your connection and try again.',
		ru: 'Ошибка сети. Проверьте соединение и повторите попытку.',
		kz: 'Желі қатесі. Қосылымды тексеріп, қайта көріңіз.'
	},
	'Unknown error.': {
		en: 'Unknown error.',
		ru: 'Неизвестная ошибка.',
		kz: 'Белгісіз қате.'
	}
};

const clampLocale = (value: string): UiLocale => {
	if (value === 'ru' || value === 'kz' || value === 'en') {
		return value;
	}
	return 'en';
};

export const resolveLocale = (): UiLocale => clampLocale(getLocale());

export const formatDate = (
	value: string,
	options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string => new Date(value).toLocaleDateString(DATE_LOCALES[resolveLocale()], options);

export const formatDateTime = (
	value: string,
	options: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}
): string => new Date(value).toLocaleString(DATE_LOCALES[resolveLocale()], options);

export const dictionaryLabel = (
	entry: Pick<DictionaryEntry, 'code' | 'name_ru' | 'name_kz'>
): string => {
	const locale = resolveLocale();
	if (locale === 'ru') {
		return entry.name_ru || entry.code;
	}
	if (locale === 'kz') {
		return entry.name_kz || entry.code;
	}
	const normalizedCode = entry.code.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
	if (!normalizedCode) {
		return entry.code;
	}
	return normalizedCode
		.split(' ')
		.map((word) => (word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
		.join(' ');
};

export const roleLabel = (role: UserRole | string): string => {
	const locale = resolveLocale();
	return ROLE_LABELS[role as UserRole]?.[locale] ?? role;
};

export const registrationStatusLabel = (status: RegistrationStatus | string): string => {
	const locale = resolveLocale();
	return REGISTRATION_STATUS_LABELS[status as RegistrationStatus]?.[locale] ?? status;
};

export const resultStatusLabel = (status: ResultStatus | string): string => {
	const locale = resolveLocale();
	return RESULT_STATUS_LABELS[status as ResultStatus]?.[locale] ?? status;
};

export const prepTypeLabel = (type: PrepType | string): string => {
	const locale = resolveLocale();
	return PREP_TYPE_LABELS[type as PrepType]?.[locale] ?? type;
};

export const olympiadFormatLabel = (format: OlympiadFormat | string): string => {
	const locale = resolveLocale();
	return OLYMPIAD_FORMAT_LABELS[format as OlympiadFormat]?.[locale] ?? format;
};

export const eventTypeLabel = (type: string): string => {
	const locale = resolveLocale();
	return EVENT_TYPE_LABELS[type]?.[locale] ?? type;
};

export const stageTypeLabel = (type: string): string => {
	const locale = resolveLocale();
	return STAGE_TYPE_LABELS[type]?.[locale] ?? type;
};

export const entityStatusLabel = (status: EntityStatus | string): string => {
	const locale = resolveLocale();
	return ENTITY_STATUS_LABELS[status as EntityStatus]?.[locale] ?? status;
};

export const notificationTypeLabel = (
	type: 'deadline_soon' | 'new_comment' | 'result_added' | 'reminder'
): string => NOTIFICATION_TYPE_LABELS[type][resolveLocale()];

export const trendLabel = (trend: string): string => {
	const locale = resolveLocale();
	return TREND_LABELS[trend]?.[locale] ?? trend;
};

export const correlationInterpretationLabel = (value: string): string => {
	const locale = resolveLocale();
	return CORRELATION_INTERPRETATION_LABELS[value]?.[locale] ?? value;
};

export const analyticsRecommendationLabel = (value: string): string => {
	const locale = resolveLocale();
	return ANALYTICS_RECOMMENDATION_MAP[value]?.[locale] ?? value;
};

export const boolLabel = (value: boolean): string => {
	const locale = resolveLocale();
	if (locale === 'ru') {
		return value ? 'Да' : 'Нет';
	}
	if (locale === 'kz') {
		return value ? 'Иә' : 'Жоқ';
	}
	return value ? 'Yes' : 'No';
};

export const localizeApiError = (code: string, fallbackMessage: string): string => {
	const locale = resolveLocale();
	return (
		API_ERROR_BY_CODE[code]?.[locale] ??
		API_ERROR_BY_MESSAGE[fallbackMessage]?.[locale] ??
		API_ERROR_BY_CODE.request_failed[locale]
	);
};

export const localizeGenericError = (message: string): string => {
	const locale = resolveLocale();
	return API_ERROR_BY_MESSAGE[message]?.[locale] ?? API_ERROR_BY_MESSAGE['Unknown error.'][locale];
};
