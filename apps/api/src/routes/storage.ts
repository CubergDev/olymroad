import type { Elysia } from "elysia";
import { requireUser } from "../auth";
import { CONFIG } from "../config";
import { first, sql } from "../db";
import { fail, failForDbError } from "../http";
import {
  buildObjectKey,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  sanitizeFileName,
} from "../storage";
import {
  getInteger,
  getNullableString,
  getString,
  getUuidString,
  isFilePurpose,
  isRecord,
} from "../validation";

const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;

export const registerStorageRoutes = (app: Elysia) => {
  app.post("/storage/upload-intent", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const purposeRaw = getString(body.purpose);
    const fileNameRaw = getString(body.file_name);
    const mimeType = getNullableString(body.mime_type);

    const hasSizeBytes = Object.prototype.hasOwnProperty.call(body, "size_bytes");
    const sizeBytes = hasSizeBytes ? getInteger(body.size_bytes) : null;

    const hasSha256 = Object.prototype.hasOwnProperty.call(body, "sha256");
    const sha256 = getNullableString(body.sha256);

    if (!purposeRaw || !isFilePurpose(purposeRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "purpose must be one of prep_material, export, avatar, attachment."
      );
    }
    if (!fileNameRaw) {
      return fail(set, 400, "validation_error", "file_name is required.");
    }
    if (body.mime_type !== undefined && mimeType === undefined) {
      return fail(set, 400, "validation_error", "mime_type must be a string or null.");
    }
    if (hasSizeBytes && (sizeBytes === null || sizeBytes < 0)) {
      return fail(set, 400, "validation_error", "size_bytes must be a non-negative integer.");
    }
    if (hasSha256 && sha256 === undefined) {
      return fail(set, 400, "validation_error", "sha256 must be a string or null.");
    }
    if (sha256 !== null && !SHA256_REGEX.test(sha256)) {
      return fail(set, 400, "validation_error", "sha256 must be a 64-char hex string.");
    }

    const objectId = crypto.randomUUID();
    const safeFileName = sanitizeFileName(fileNameRaw);
    const objectKey = buildObjectKey(purposeRaw, user.id, objectId, safeFileName);

    try {
      const uploadUrl = await createSignedUploadUrl(
        objectKey,
        mimeType ?? null,
        CONFIG.storage.bucket
      );

      const rows = await sql`
        INSERT INTO file_objects (
          id, provider, bucket, object_key, purpose, owner_user_id, mime_type, size_bytes, sha256
        )
        VALUES (
          ${objectId},
          ${CONFIG.storage.provider},
          ${CONFIG.storage.bucket},
          ${objectKey},
          ${purposeRaw},
          ${user.id},
          ${mimeType ?? null},
          ${hasSizeBytes ? sizeBytes : null},
          ${sha256 ?? null}
        )
        RETURNING *
      `;

      const fileObject = first(rows);
      if (!fileObject) {
        return fail(
          set,
          500,
          "storage_upload_intent_failed",
          "Failed to create upload intent metadata."
        );
      }

      return {
        file_object: fileObject,
        upload: {
          method: "PUT",
          url: uploadUrl,
          required_headers: mimeType ? { "content-type": mimeType } : {},
          expires_in_seconds: CONFIG.storage.presignTtlSeconds,
        },
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "storage_upload_intent_failed",
        "Failed to create upload intent."
      );
    }
  });

  app.get("/storage/objects/:id/download-url", async ({ headers, params, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const objectId = getUuidString(params.id);
    if (!objectId) {
      return fail(set, 400, "validation_error", "Invalid object id.");
    }

    const downloadName =
      query.download_name === undefined ? null : getNullableString(query.download_name);
    if (query.download_name !== undefined && downloadName === undefined) {
      return fail(
        set,
        400,
        "validation_error",
        "download_name must be a string or null."
      );
    }

    try {
      const rows = await sql`
        SELECT id, provider, bucket, object_key, purpose, owner_user_id, mime_type, size_bytes, sha256, created_at, deleted_at
        FROM file_objects
        WHERE id = ${objectId} AND owner_user_id = ${user.id}
        LIMIT 1
      `;
      const fileObject = first<Record<string, unknown>>(rows);
      if (!fileObject) {
        return fail(set, 404, "not_found", "File object not found.");
      }
      if (fileObject.deleted_at) {
        return fail(set, 410, "gone", "File object is deleted.");
      }

      const objectKey = typeof fileObject.object_key === "string" ? fileObject.object_key : null;
      const bucket = typeof fileObject.bucket === "string" ? fileObject.bucket : null;

      if (!objectKey || !bucket) {
        return fail(set, 500, "storage_invalid_metadata", "File object metadata is invalid.");
      }

      const downloadUrl = await createSignedDownloadUrl(objectKey, downloadName, bucket);

      return {
        file_object: fileObject,
        download: {
          method: "GET",
          url: downloadUrl,
          expires_in_seconds: CONFIG.storage.presignTtlSeconds,
        },
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "storage_download_url_failed",
        "Failed to create download URL."
      );
    }
  });

  app.delete("/storage/objects/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const objectId = getUuidString(params.id);
    if (!objectId) {
      return fail(set, 400, "validation_error", "Invalid object id.");
    }

    try {
      const rows = await sql`
        UPDATE file_objects
        SET deleted_at = now()
        WHERE id = ${objectId}
          AND owner_user_id = ${user.id}
          AND deleted_at IS NULL
        RETURNING *
      `;
      const fileObject = first(rows);
      if (!fileObject) {
        return fail(set, 404, "not_found", "File object not found.");
      }

      return {
        deleted: true,
        file_object: fileObject,
      };
    } catch (error) {
      return failForDbError(set, error, "storage_delete_failed", "Failed to delete file object.");
    }
  });
};
