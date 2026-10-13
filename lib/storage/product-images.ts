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

export async function getProductStorageUrl(imageKey: string): Promise<string | null> {
  const endpoint = new URL(required("S3_ENDPOINT"));
  const bucket = required("S3_BUCKET_NAME");
  const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
  const key = getStorageImageKey(imageKey, bucket, [supabaseUrl.origin, endpoint.origin]);
  if (!key) return null;

  const client = new S3Client({
    endpoint: endpoint.href,
    region: required("S3_BUCKET_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 300,
  });
}
