export type UserRole = "student" | "teacher" | "admin";
export type OlympiadFormat = "online" | "offline" | "mixed";
export type RegistrationStatus =
  | "planned"
  | "registered"
  | "participated"
  | "result_added";
export type PrepType = "theory" | "problems" | "mock_exam";
export type ResultStatus = "participant" | "prize_winner" | "winner";
export type GoalPeriod = "week" | "month";
export type EntityStatus = "draft" | "published" | "archived";
export type PlanStatus = "draft" | "active" | "completed" | "cancelled";

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  school: string | null;
  grade: number | null;
  locale: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRow = PublicUser & {
  password_hash: string | null;
};

export type StageChecklist = {
  documents_required: string[];
  consent_required: boolean;
  fee_amount: number | null;
  platform_name: string | null;
  platform_url: string | null;
};

export type DictionaryRow = {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
  is_active: boolean;
  sort_order: number;
};
