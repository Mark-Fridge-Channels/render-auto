import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config as loadEnv } from 'dotenv'

loadEnv()

const bucket = process.env.AWS_S3_BUCKET || 'amzn-s3-fc-bucket'
const region = process.env.AWS_REGION || 'sa-east-1'

const s3 = new S3Client({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
})

function todayStamp(): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

export function buildObjectKey(batchId: string, order: number, templateId: string) {
  return `images/render-auto/${todayStamp()}/${batchId}/${order}-${templateId}.png`
}

export function publicUrlForKey(key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function uploadPngToS3(key: string, bytes: Buffer): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: 'image/png',
    }),
  )
  return publicUrlForKey(key)
}
