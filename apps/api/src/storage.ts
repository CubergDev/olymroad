import { Client as MinioClient } from "minio";
import { CONFIG } from "./config";
import type { FilePurpose } from "./types";

const endpoint = new URL(CONFIG.storage.endpoint);

const minioClient = new MinioClient({
  endPoint: endpoint.hostname,
  port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === "https:" ? 443 : 80,
  useSSL: endpoint.protocol === "https:",
  accessKey: CONFIG.storage.accessKeyId,
  secretKey: CONFIG.storage.secretAccessKey,
});

const getYearMonthUtc = () => {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return { yyyy, mm };
};

const removeLeadingDots = (value: string): string => value.replace(/^\.+/, "");

export const sanitizeFileName = (value: string): string => {
  const trimmed = value.trim();
  const cleaned = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withoutDots = removeLeadingDots(cleaned);
  return withoutDots.length > 0 ? withoutDots.slice(0, 120) : "file";
};

const fileExtension = (fileName: string): string => {
  const safeName = sanitizeFileName(fileName);
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "";
  if (!extension) {
    return "";
  }
  const normalized = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.length > 0 ? `.${normalized}` : "";
};

export const buildObjectKey = (
  purpose: FilePurpose,
  ownerUserId: number,
  objectId: string,
  fileName: string
): string => {
  const safeName = sanitizeFileName(fileName);
  const { yyyy, mm } = getYearMonthUtc();

  if (purpose === "prep_material") {
    return `prep-materials/${ownerUserId}/${yyyy}/${mm}/${objectId}-${safeName}`;
  }
  if (purpose === "export") {
    return `exports/${ownerUserId}/${yyyy}/${mm}/${objectId}/${safeName}`;
  }
  if (purpose === "avatar") {
    return `avatars/${ownerUserId}/${objectId}${fileExtension(safeName)}`;
  }
  return `attachments/${ownerUserId}/${yyyy}/${mm}/${objectId}-${safeName}`;
};

export const createSignedUploadUrl = async (
  objectKey: string,
  _mimeType: string | null,
  bucket: string = CONFIG.storage.bucket
): Promise<string> => {
  return minioClient.presignedPutObject(
    bucket,
    objectKey,
    CONFIG.storage.presignTtlSeconds
  );
};

const sanitizeDownloadName = (value: string): string =>
  sanitizeFileName(value).replace(/["\\]/g, "");

export const createSignedDownloadUrl = async (
  objectKey: string,
  downloadName?: string | null,
  bucket: string = CONFIG.storage.bucket
): Promise<string> => {
  return minioClient.presignedGetObject(
    bucket,
    objectKey,
    CONFIG.storage.presignTtlSeconds,
    downloadName
      ? { "response-content-disposition": `attachment; filename="${sanitizeDownloadName(downloadName)}"` }
      : undefined
  );
};

export const checkStorageHealth = async (): Promise<{
  ok: boolean;
  bucket: string;
  reason?: string;
}> => {
  try {
    const bucketExists = await minioClient.bucketExists(CONFIG.storage.bucket);
    if (!bucketExists) {
      return {
        ok: false,
        bucket: CONFIG.storage.bucket,
        reason: "Configured bucket does not exist.",
      };
    }

    return {
      ok: true,
      bucket: CONFIG.storage.bucket,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown storage connectivity error.";
    return {
      ok: false,
      bucket: CONFIG.storage.bucket,
      reason,
    };
  }
};
