import {createClient} from 'jsr:@supabase/supabase-js@2'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from 'npm:@aws-sdk/client-s3@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')
const R2_PUBLIC_URL = (
  Deno.env.get('R2_PUBLIC_URL') || 'https://cdn.fkp.my.id'
).replace(/\/$/, '')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type'
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json', ...CORS_HEADERS}
  })
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const auth = req.headers.get('authorization')
  if (!auth) {
    return jsonResponse(
      {
        code: 401,
        error: '401 Unauthorized: Missing Authorization header.',
        message: 'Missing Authorization header.'
      },
      401
    )
  }

  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const {
    data: {user},
    error: userError
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return jsonResponse(
      {
        code: 401,
        error: '401 Unauthorized: Invalid or expired token.',
        message: 'Invalid or expired token.'
      },
      401
    )
  }

  const role = (user.app_metadata as {role?: string} | null)?.role
  if (role !== 'admin') {
    return jsonResponse(
      {
        code: 403,
        error: '403 Forbidden: Admin privileges required.',
        message: 'Admin privileges required.'
      },
      403
    )
  }

  return null
}

function getR2Client(): S3Client | null {
  if (
    !R2_ACCOUNT_ID
    || !R2_ACCESS_KEY_ID
    || !R2_SECRET_ACCESS_KEY
    || !R2_BUCKET_NAME
  )
    return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  })
}

async function handleCvUpload(req: Request): Promise<Response> {
  const supabaseDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let {data: author} = await supabaseDb
    .from('db_profiles')
    .select('id, name, username')
    .limit(1)
    .maybeSingle()

  if (!author?.id) {
    const {data: createdAuthor, error: createError} = await supabaseDb
      .from('db_profiles')
      .insert({name: '', username: ''})
      .select('id, name, username')
      .maybeSingle()

    if (createError || !createdAuthor?.id) {
      return jsonResponse(
        {
          code: 500,
          error:
            '500 Internal Server Error: Could not resolve or create author profile.',
          message: 'Could not resolve or create author profile.'
        },
        500
      )
    }
    author = createdAuthor
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonResponse(
      {
        code: 400,
        error:
          '400 Bad Request: Expected multipart/form-data with a file field.',
        message: 'Expected multipart/form-data with a file field.'
      },
      400
    )
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return jsonResponse(
      {
        code: 400,
        error: '400 Bad Request: file field is required.',
        message: 'file field is required.'
      },
      400
    )
  }
  if (file.type !== 'application/pdf') {
    return jsonResponse(
      {
        code: 400,
        error: '400 Bad Request: file must be a PDF.',
        message: 'file must be a PDF.'
      },
      400
    )
  }
  const MAX_BYTES = 10 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return jsonResponse(
      {
        code: 400,
        error: '400 Bad Request: file exceeds 10MB limit.',
        message: 'file exceeds 10MB limit.'
      },
      400
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  const magic = new TextDecoder().decode(bytes.slice(0, 5))
  if (magic !== '%PDF-') {
    return jsonResponse(
      {
        code: 400,
        error: '400 Bad Request: file is not a valid PDF.',
        message: 'file is not a valid PDF.'
      },
      400
    )
  }

  const digestBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const fullHash = Array.from(new Uint8Array(digestBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const shortHash = fullHash.slice(0, 7)

  const authorName = (author.name || author.username || 'cv').trim()
  const slugBase = authorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const slug = slugBase || 'cv'

  const now = new Date()
  const yearSuffix = String(now.getFullYear()).slice(-2)
  const monthSuffix = String(now.getMonth() + 1).padStart(2, '0')
  const version = `v${yearSuffix}${monthSuffix}`

  const filename = `${slug}-${shortHash}-${version}.pdf`
  const sha256Filename = `${filename}.sha256`
  const sha256Content = `${fullHash}  ${filename}\n`
  const sha256Bytes = new TextEncoder().encode(sha256Content)

  const r2 = getR2Client()

  const {data: previousDocs} = await supabaseDb
    .from('db_documents')
    .select('id, filename')
    .eq('is_active', true)

  if (previousDocs && previousDocs.length > 0) {
    for (const oldDoc of previousDocs) {
      if (oldDoc.filename) {
        const oldPdfKey = oldDoc.filename
        const oldShaKey = `${oldDoc.filename}.sha256`
        if (r2 && R2_BUCKET_NAME) {
          try {
            await r2.send(
              new DeleteObjectCommand({Bucket: R2_BUCKET_NAME, Key: oldPdfKey})
            )
            await r2.send(
              new DeleteObjectCommand({Bucket: R2_BUCKET_NAME, Key: oldShaKey})
            )
          } catch (delErr) {
            console.error('R2 deletion warning for old CV file:', delErr)
          }
        }
        try {
          await supabaseDb.storage
            .from('cv_documents')
            .remove([oldPdfKey, oldShaKey])
        } catch (delStorageErr) {
          console.error(
            'Supabase storage deletion warning for old CV file:',
            delStorageErr
          )
        }
      }
    }
  }

  let fileUrl = ''
  let storageProvider: 'R2' | 'Supabase Storage' = 'R2'

  if (r2 && R2_BUCKET_NAME) {
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: filename,
          Body: bytes,
          ContentType: 'application/pdf'
        })
      )
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: sha256Filename,
          Body: sha256Bytes,
          ContentType: 'text/plain; charset=utf-8'
        })
      )
      fileUrl = `${R2_PUBLIC_URL}/${filename}`
    } catch (r2Err) {
      console.error(
        'R2 upload failed, trying Supabase Storage fallback:',
        r2Err
      )
    }
  }

  if (!fileUrl) {
    storageProvider = 'Supabase Storage'
    const {error: storageError} = await supabaseDb.storage
      .from('cv_documents')
      .upload(filename, bytes, {contentType: 'application/pdf', upsert: true})

    if (storageError) {
      return jsonResponse(
        {
          code: 500,
          error: `500 Internal Server Error: Failed to upload storage file (${storageError.message}).`,
          message: `Failed to upload storage file: ${storageError.message}`
        },
        500
      )
    }

    await supabaseDb.storage
      .from('cv_documents')
      .upload(sha256Filename, sha256Bytes, {
        contentType: 'text/plain; charset=utf-8',
        upsert: true
      })

    const {data: publicUrlData} = supabaseDb.storage
      .from('cv_documents')
      .getPublicUrl(filename)

    fileUrl = publicUrlData.publicUrl
  }

  const {error: deactivateError} = await supabaseDb
    .from('db_documents')
    .update({is_active: false})
    .eq('is_active', true)

  if (deactivateError) {
    return jsonResponse(
      {
        code: 500,
        error:
          '500 Internal Server Error: Uploaded file but failed to deactivate previous CV record.',
        message: 'Uploaded file but failed to deactivate previous CV record.'
      },
      500
    )
  }

  const {error: insertError} = await supabaseDb
    .from('db_documents')
    .insert({
      author_id: author.id,
      filename,
      file_url: fileUrl,
      hash: fullHash,
      is_active: true
    })

  if (insertError) {
    return jsonResponse(
      {
        code: 500,
        error:
          '500 Internal Server Error: Uploaded file but failed to save database record.',
        message: 'Uploaded file but failed to save database record.'
      },
      500
    )
  }

  return jsonResponse(
    {success: true, filename, fileUrl, hash: fullHash, storageProvider},
    201
  )
}

async function handleCvDelete(req: Request): Promise<Response> {
  const supabaseDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let targetFilename: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.filename === 'string' && body.filename.trim()) {
      targetFilename = body.filename.trim()
    }
  } catch {}

  let filename: string
  if (targetFilename) {
    const {data: doc, error: lookupError} = await supabaseDb
      .from('db_documents')
      .select('filename')
      .eq('filename', targetFilename)
      .limit(1)
      .maybeSingle()

    if (lookupError || !doc?.filename) {
      return jsonResponse(
        {
          code: 404,
          error: '404 Not Found: CV document not found.',
          message: 'CV document not found.'
        },
        404
      )
    }
    filename = doc.filename
  } else {
    const {data: activeDoc, error: lookupError} = await supabaseDb
      .from('db_documents')
      .select('filename')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (lookupError || !activeDoc?.filename) {
      return jsonResponse(
        {
          code: 404,
          error: '404 Not Found: No active CV document to delete.',
          message: 'No active CV document to delete.'
        },
        404
      )
    }
    filename = activeDoc.filename
  }

  const sha256Filename = `${filename}.sha256`

  const r2 = getR2Client()
  if (r2 && R2_BUCKET_NAME) {
    try {
      await r2.send(
        new DeleteObjectCommand({Bucket: R2_BUCKET_NAME, Key: filename})
      )
      await r2.send(
        new DeleteObjectCommand({Bucket: R2_BUCKET_NAME, Key: sha256Filename})
      )
    } catch (err) {
      console.error('R2 deletion warning:', err)
    }
  }

  try {
    await supabaseDb.storage
      .from('cv_documents')
      .remove([filename, sha256Filename])
  } catch (err) {
    console.error('Supabase storage removal warning:', err)
  }

  const {error: deleteError} = await supabaseDb
    .from('db_documents')
    .delete()
    .eq('filename', filename)

  if (deleteError) {
    return jsonResponse(
      {
        code: 500,
        error:
          '500 Internal Server Error: Deleted file from R2 but failed to remove database record.',
        message: 'Deleted file from R2 but failed to remove database record.'
      },
      500
    )
  }

  return jsonResponse({success: true, filename})
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {status: 204, headers: CORS_HEADERS})
  }
  if (req.method !== 'POST') {
    return jsonResponse(
      {
        code: 405,
        error: '405 Method Not Allowed',
        message: 'Method Not Allowed'
      },
      405
    )
  }

  const authFailure = await requireAdmin(req)
  if (authFailure) {
    return authFailure
  }

  const path = new URL(req.url).pathname

  if (path.endsWith('/cv/upload')) {
    return handleCvUpload(req)
  }
  if (path.endsWith('/cv/delete')) {
    return handleCvDelete(req)
  }

  return jsonResponse(
    {
      code: 404,
      error: '404 Not Found: Unknown admin route.',
      message: 'Unknown admin route.'
    },
    404
  )
})
