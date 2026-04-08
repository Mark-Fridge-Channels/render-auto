import cors from 'cors'
import { config as loadEnv } from 'dotenv'
import express from 'express'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { z } from 'zod'
import { db, type TemplateRow } from './db'
import { renderBatchWithChromium } from './render'

loadEnv()

const app = express()
const AUTH_USER = 'admin'
const AUTH_PASS = 'Render@2026'
const AUTH_COOKIE = 'render_auto_sid'
const CHALLENGE_TTL_MS = 2 * 60 * 1000
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

type LoginChallenge = { username: string; expiresAt: number }
type LoginSession = { username: string; expiresAt: number }
const loginChallenges = new Map<string, LoginChallenge>()
const loginSessions = new Map<string, LoginSession>()

// Request logging middleware — logs every request with status and duration.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint()
  const now = new Date().toISOString()
  const method = req.method
  const url = req.originalUrl || req.url
  const ip = req.ip

  console.log(`[${now}] -> ${method} ${url} (${ip})`)

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const size = res.getHeader('content-length')
    const sizeText = typeof size === 'string' || typeof size === 'number' ? ` ${size}b` : ''
    console.log(
      `[${new Date().toISOString()}] <- ${method} ${url} ${res.statusCode} ${elapsedMs.toFixed(1)}ms${sizeText}`,
    )
  })

  next()
})
const port = Number(process.env.API_PORT || 3001)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')
const backgroundDir = path.resolve(uploadsDir, 'backgrounds')
fs.mkdirSync(backgroundDir, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(uploadsDir))
app.use((req, res, next) => {
  cleanupAuthState()
  const openApi =
    req.path === '/api/health' ||
    req.path === '/api/auth/challenge' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/session' ||
    req.path === '/api/auth/logout' ||
    req.path === '/api/render-asset'
  if (!req.path.startsWith('/api') || openApi) return next()
  const user = getSessionUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  return next()
})

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, backgroundDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
      cb(null, `${Date.now()}-${randomUUID()}${ext}`)
    },
  }),
})

type TemplatePayload = {
  config: unknown
  productQuad: unknown
  productBrushShadow?: unknown
}

type TemplateDto = {
  id: string
  name: string
  order: number
  enabled: boolean
  payload: TemplatePayload
  createdAt: string
  updatedAt: string
}

const payloadSchema = z.object({
  config: z.unknown(),
  productQuad: z.unknown(),
  productBrushShadow: z.unknown().optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  payload: payloadSchema,
})

const patchTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
  payload: payloadSchema.optional(),
})

const batchSchema = z.object({
  productImageUrl: z.string().url(),
  templateId: z.string().optional(),
})

const singleSchema = z.object({
  productImageUrl: z.string().url(),
  templateId: z.string(),
})

const challengeSchema = z.object({
  username: z.string().min(1),
})

const loginSchema = z.object({
  username: z.string().min(1),
  nonce: z.string().min(1),
  proof: z.string().regex(/^[a-fA-F0-9]{64}$/),
})

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function parseCookies(req: express.Request): Record<string, string> {
  const raw = req.headers.cookie
  if (!raw) return {}
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const k = part.slice(0, i).trim()
    const v = decodeURIComponent(part.slice(i + 1).trim())
    out[k] = v
  }
  return out
}

function getSessionUser(req: express.Request): string | null {
  const sid = parseCookies(req)[AUTH_COOKIE]
  if (!sid) return null
  const session = loginSessions.get(sid)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    loginSessions.delete(sid)
    return null
  }
  return session.username
}

function cleanupAuthState() {
  const now = Date.now()
  for (const [k, v] of loginChallenges.entries()) {
    if (v.expiresAt < now) loginChallenges.delete(k)
  }
  for (const [k, v] of loginSessions.entries()) {
    if (v.expiresAt < now) loginSessions.delete(k)
  }
}

function toTemplateDto(row: TemplateRow): TemplateDto {
  return {
    id: row.id,
    name: row.name,
    order: row.order_index,
    enabled: row.enabled === 1,
    payload: JSON.parse(row.payload_json) as TemplatePayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function listRows(): TemplateRow[] {
  return db
    .prepare('SELECT * FROM templates ORDER BY order_index ASC, created_at ASC')
    .all() as TemplateRow[]
}

function normalizeOrder(order: number | undefined): number {
  if (!order || order < 1) {
    const max = db.prepare('SELECT COALESCE(MAX(order_index),0) as maxOrder FROM templates').get() as {
      maxOrder: number
    }
    return max.maxOrder + 1
  }
  return order
}

app.get('/api/templates', (_req, res) => {
  const templates = listRows().map(toTemplateDto)
  res.json({ templates })
})

app.get('/api/templates/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as
    | TemplateRow
    | undefined
  if (!row) return res.status(404).json({ error: 'template not found' })
  res.json({ template: toTemplateDto(row) })
})

app.post('/api/templates', (req, res) => {
  const parsed = createTemplateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

  const now = new Date().toISOString()
  const order = normalizeOrder(undefined)
  const id = randomUUID()
  db.prepare(
    `INSERT INTO templates (id, name, order_index, enabled, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    parsed.data.name,
    order,
    parsed.data.enabled === false ? 0 : 1,
    JSON.stringify(parsed.data.payload),
    now,
    now,
  )

  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow
  res.status(201).json({ template: toTemplateDto(row) })
})

app.patch('/api/templates/:id', (req, res) => {
  const parsed = patchTemplateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow | undefined
  if (!existing) return res.status(404).json({ error: 'template not found' })

  const patch = parsed.data
  const now = new Date().toISOString()

  if (patch.order !== undefined && patch.order !== existing.order_index) {
    const oldOrder = existing.order_index
    const newOrder = Math.max(1, patch.order)
    const tx = db.transaction(() => {
      if (newOrder > oldOrder) {
        db.prepare(
          'UPDATE templates SET order_index = order_index - 1 WHERE order_index > ? AND order_index <= ?',
        ).run(oldOrder, newOrder)
      } else {
        db.prepare(
          'UPDATE templates SET order_index = order_index + 1 WHERE order_index >= ? AND order_index < ?',
        ).run(newOrder, oldOrder)
      }
      db.prepare('UPDATE templates SET order_index = ?, updated_at = ? WHERE id = ?').run(newOrder, now, id)
    })
    tx()
  }

  const nextName = patch.name ?? existing.name
  const nextEnabled = patch.enabled === undefined ? existing.enabled : patch.enabled ? 1 : 0
  const nextPayload = patch.payload ? JSON.stringify(patch.payload) : existing.payload_json

  db.prepare('UPDATE templates SET name = ?, enabled = ?, payload_json = ?, updated_at = ? WHERE id = ?').run(
    nextName,
    nextEnabled,
    nextPayload,
    now,
    id,
  )

  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow
  res.json({ template: toTemplateDto(row) })
})

app.delete('/api/templates/:id', (req, res) => {
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow | undefined
  if (!existing) return res.status(404).json({ error: 'template not found' })

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id)
    db.prepare('UPDATE templates SET order_index = order_index - 1 WHERE order_index > ?').run(
      existing.order_index,
    )
  })
  tx()
  res.json({ ok: true as const })
})

app.post('/api/render/batch', async (req, res) => {
  const parsed = batchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

  try {
    const enabledRows =
      parsed.data.templateId
        ? (db.prepare('SELECT * FROM templates WHERE id = ?').all(parsed.data.templateId) as TemplateRow[])
        : (db
            .prepare('SELECT * FROM templates WHERE enabled = 1 ORDER BY order_index ASC')
            .all() as TemplateRow[])

    if (enabledRows.length === 0) {
      return res.status(404).json({ error: 'template not found or no enabled templates' })
    }

    const batchId = randomUUID()

    const results = await renderBatchWithChromium({
      batchId,
      productImageUrl: parsed.data.productImageUrl,
      templates: enabledRows.map((row) => ({
        id: row.id,
        name: row.name,
        order: row.order_index,
        payload: JSON.parse(row.payload_json),
      })),
    })

    res.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: message })
  }
})

app.post('/api/render/single', async (req, res) => {
  const parsed = singleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

  try {
    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(parsed.data.templateId) as
      | TemplateRow
      | undefined
    if (!row) return res.status(404).json({ error: 'template not found' })

    const batchId = randomUUID()
    const results = await renderBatchWithChromium({
      batchId,
      productImageUrl: parsed.data.productImageUrl,
      templates: [
        {
          id: row.id,
          name: row.name,
          order: row.order_index,
          payload: JSON.parse(row.payload_json),
        },
      ],
    })
    res.json({ result: results[0] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: message })
  }
})

app.post('/api/auth/challenge', (req, res) => {
  const parsed = challengeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  if (parsed.data.username !== AUTH_USER) return res.status(401).json({ error: 'invalid credentials' })
  const nonce = randomUUID().replaceAll('-', '')
  loginChallenges.set(nonce, {
    username: parsed.data.username,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  })
  return res.json({ nonce, algorithm: 'sha256(nonce:sha256(password))' as const })
})

app.post('/api/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })
  const challenge = loginChallenges.get(parsed.data.nonce)
  loginChallenges.delete(parsed.data.nonce)
  if (!challenge || challenge.expiresAt < Date.now() || challenge.username !== parsed.data.username) {
    return res.status(401).json({ error: 'challenge expired' })
  }
  if (parsed.data.username !== AUTH_USER) return res.status(401).json({ error: 'invalid credentials' })
  const expected = sha256Hex(`${parsed.data.nonce}:${sha256Hex(AUTH_PASS)}`)
  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(parsed.data.proof.toLowerCase(), 'utf8')
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  const sid = randomUUID()
  loginSessions.set(sid, { username: parsed.data.username, expiresAt: Date.now() + SESSION_TTL_MS })
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE}=${encodeURIComponent(sid)}; HttpOnly; Path=/; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000,
    )}; SameSite=Lax${secure ? '; Secure' : ''}`,
  )
  return res.json({ ok: true as const })
})

app.get('/api/auth/session', (req, res) => {
  const username = getSessionUser(req)
  if (!username) return res.status(401).json({ authenticated: false })
  return res.json({ authenticated: true as const, username })
})

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req)[AUTH_COOKIE]
  if (sid) loginSessions.delete(sid)
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`,
  )
  return res.json({ ok: true as const })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'render-auto-api' })
})

app.post('/api/assets/background', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing file' })
  const relativePath = `/uploads/backgrounds/${req.file.filename}`
  res.status(201).json({ path: relativePath })
})

app.get('/api/render-asset', async (req, res) => {
  const raw = String(req.query.url || '').trim()
  if (!raw) return res.status(400).json({ error: 'missing url' })
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'unsupported protocol' })
  }

  try {
    const upstream = await fetch(target.toString())
    if (!upstream.ok) {
      return res.status(502).json({ error: `upstream ${upstream.status}` })
    }
    const ab = await upstream.arrayBuffer()
    const ct = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', ct)
    // Rendering input assets can be overwritten at same URL; disable caching to prevent stale images.
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(Buffer.from(ab))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(502).json({ error: message })
  }
})

app.listen(port, () => {
  console.log(`render-auto api listening on ${port}`)
})
