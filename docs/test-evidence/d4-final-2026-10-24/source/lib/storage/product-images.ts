import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageImageKey } from "@/lib/product-image";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || /^(your[-_]|<)/i.test(value)) {
    throw new Error(`Missing product storage configuration: ${name}`);
  }
  return value;
}

let storage: { client: S3Client; bucket: string; origins: string[] } | undefined;

function getStorage() {
  if (storage) return storage;
  const endpoint = new URL(required("S3_ENDPOINT"));
  const bucket = required("S3_BUCKET_NAME");
  const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
  const client = new S3Client({
    endpoint: endpoint.href,
    region: required("S3_BUCKET_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });

  storage = { client, bucket, origins: [supabaseUrl.origin, endpoint.origin] };
  return storage;
}

export async function getProductStorageUrl(imageKey: string): Promise<string | null> {
  const { client, bucket, origins } = getStorage();
  const key = getStorageImageKey(imageKey, bucket, origins);
  if (!key) return null;

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 300,
  });
}

export async function readProductStorageImage(imageKey: string): Promise<Buffer | null> {
  const { client, bucket, origins } = getStorage();
  const key = getStorageImageKey(imageKey, bucket, origins);
  if (!key) return null;

  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(10_000),
  });
  if (!response.Body) return null;
  const reader = response.Body.transformToWebStream().getReader();
  const limit = 20 * 1024 * 1024;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if ((response.ContentLength ?? 0) > limit) throw new Error("Product image exceeds transform limit.");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Product image exceeds transform limit.");
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    await reader.cancel();
  }
}
