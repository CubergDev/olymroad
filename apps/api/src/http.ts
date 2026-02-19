import { mapDbError } from "./db";

const ERROR_DESCRIPTIONS: Record<string, string> = {
  validation_error: "The request payload or query parameters did not pass validation.",
  unauthorized: "Authentication is missing, invalid, or expired.",
  forbidden: "Authenticated user does not have access to this resource.",
  not_found: "The requested resource does not exist.",
  gone: "The requested resource existed previously but is no longer available.",
  duplicate_resource: "A record already exists with a unique value from this request.",
  invalid_reference: "A referenced record does not exist or is not accessible.",
  required_field_missing: "A required field was null or missing for a database write.",
  constraint_violation: "A database check constraint rejected the provided values.",
  invalid_value: "A value had invalid type or format for database conversion.",
  value_too_long: "A string exceeded the maximum length allowed by the database schema.",
  database_retryable_error: "Database contention occurred; retrying the request may succeed.",
  schema_not_migrated: "Database schema is outdated and requires running migrations.",
  oauth_not_configured: "OAuth provider is not configured on this server.",
  invalid_oauth_token: "OAuth token is invalid, expired, or not issued for this application.",
  invalid_oauth_scope: "OAuth token is missing required scopes for this operation.",
  oauth_account_conflict: "OAuth account is already linked to another user.",
  oauth_link_failed: "Failed to link OAuth account to the current user.",
  oauth_unlink_failed: "Failed to unlink OAuth account from the current user.",
  lockout_prevention: "Operation denied to prevent account lockout.",
  oauth_login_failed: "OAuth authentication flow failed due to an internal server issue.",
  security_status_failed: "Failed to read account security settings.",
  password_not_set: "This account does not currently have a password configured.",
  password_change_failed: "Failed to change password for the current account.",
  email_not_verified: "Email is not verified for this account.",
  invalid_otp: "OTP code is invalid.",
  otp_expired: "OTP code has expired.",
  otp_attempts_exceeded: "Maximum OTP attempts exceeded.",
  email_service_not_configured: "Email service is not configured on this server.",
  email_send_failed: "Failed to send email message.",
  password_reset_failed: "Failed to reset account password.",
  email_verification_failed: "Failed to verify account email address.",
  email_resend_failed: "Failed to resend email verification OTP.",
  forgot_password_failed: "Failed to start password reset flow.",
  passkey_challenge_not_found:
    "Passkey challenge is missing, expired, or does not match this request.",
  invalid_passkey_response: "Passkey response is invalid or failed verification.",
  passkey_not_found: "Passkey credential was not found.",
  passkey_registration_options_failed: "Failed to create passkey registration options.",
  passkey_registration_failed: "Failed to register passkey for the current user.",
  passkey_delete_failed: "Failed to delete passkey for the current user.",
  passkey_authentication_options_failed: "Failed to create passkey authentication options.",
  passkey_authentication_failed: "Failed to authenticate using passkey.",
  calendar_integration_not_found: "Calendar provider integration is not connected for this user.",
  insufficient_oauth_scope:
    "Connected OAuth token does not allow the requested calendar operation.",
  calendar_export_failed: "Failed to export calendar events.",
  calendar_status_failed: "Failed to read calendar integration status.",
  calendar_connect_failed: "Failed to connect calendar provider.",
  calendar_disconnect_failed: "Failed to disconnect calendar provider.",
  calendar_sync_failed: "Calendar synchronization failed.",
  calendar_import_events_failed: "Failed to read imported calendar events.",
  internal_error: "An unexpected server error occurred while processing the request.",
};

const getErrorDescription = (code: string, fallbackMessage: string): string =>
  ERROR_DESCRIPTIONS[code] ?? fallbackMessage;

export const fail = (
  set: { status?: number },
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  description?: string
) => {
  set.status = status;
  return {
    error: {
      code,
      message,
      description: description ?? getErrorDescription(code, message),
      ...(details ? { details } : {}),
    },
  };
};

export const failForDbError = (
  set: { status?: number },
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) => {
  const mapped = mapDbError(error);
  if (mapped) {
    return fail(set, mapped.status, mapped.code, mapped.message, mapped.details);
  }
  return fail(set, 500, fallbackCode, fallbackMessage);
};
