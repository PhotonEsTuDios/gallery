import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'

// Credentials kommen aus der Default-Chain:
//  - lokal: AWS_PROFILE=photon (in .env gesetzt)
//  - Lambda: die Exec-Rolle photon-gallery-exec
let _doc: DynamoDBDocumentClient | null = null
let _s3: S3Client | null = null

export function ddb(region: string): DynamoDBDocumentClient {
  if (!_doc) {
    _doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    })
  }
  return _doc
}

export function s3(region: string): S3Client {
  if (!_s3) _s3 = new S3Client({ region })
  return _s3
}

export async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}
