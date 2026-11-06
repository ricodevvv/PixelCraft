import "server-only";
import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";

type Storage = { client: AwsClient; region: string; objectBase: string; publicBase: string };

function trimSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function storage(): Storage | null {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const region = process.env.S3_REGION || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT ? trimSlashes(process.env.S3_ENDPOINT) : null;
  const objectBase = endpoint ? `${endpoint}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`;
  const publicBase = trimSlashes(process.env.S3_PUBLIC_URL || objectBase);
  return { client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region }), region, objectBase, publicBase };
}

/**
 * True when an S3 compatible bucket is configured (AWS, Cloudflare R2, MinIO, Backblaze B2...).
 */
export function isStorageConfigured(): boolean {
  return storage() !== null;
}

/**
 * Uploads a file to the bucket under a random name and returns its public URL.
 */
export async function uploadFile(folder: string, extension: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const config = storage();
  if (!config) throw new Error("Storage isn't configured.");
  const key = `${folder}/${randomUUID()}.${extension}`;
  const res = await config.client.fetch(`${config.objectBase}/${key}`, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    aws: { service: "s3", region: config.region },
  });
  if (!res.ok) {
    const detail = (await res.text()).match(/<Message>([^<]+)<\/Message>/)?.[1];
    throw new Error(`Storage answered ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return `${config.publicBase}/${key}`;
}
