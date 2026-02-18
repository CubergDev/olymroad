#!/bin/sh
set -eu

if [ -z "${MINIO_ROOT_USER:-}" ]; then
  echo "MINIO_ROOT_USER is required."
  exit 1
fi

if [ -z "${MINIO_ROOT_PASSWORD:-}" ]; then
  echo "MINIO_ROOT_PASSWORD is required."
  exit 1
fi

if [ -z "${MINIO_BUCKET:-}" ]; then
  echo "MINIO_BUCKET is required."
  exit 1
fi

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo "Waiting for MinIO..."
  sleep 2
done

mc mb --ignore-existing "local/$MINIO_BUCKET"
echo "MinIO bucket is ready: $MINIO_BUCKET"
