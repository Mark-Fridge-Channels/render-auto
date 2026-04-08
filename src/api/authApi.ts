const API = '/api'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getSession() {
  const res = await fetch(`${API}/auth/session`, {
    credentials: 'include',
  })
  if (!res.ok) return { authenticated: false as const }
  return (await res.json()) as { authenticated: true; username: string }
}

export async function login(username: string, password: string) {
  const challengeRes = await fetch(`${API}/auth/challenge`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  if (!challengeRes.ok) {
    throw new Error('账号或密码错误')
  }
  const challenge = (await challengeRes.json()) as { nonce: string }
  const passwordDigest = await sha256Hex(password)
  const proof = await sha256Hex(`${challenge.nonce}:${passwordDigest}`)
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, nonce: challenge.nonce, proof }),
  })
  if (!loginRes.ok) {
    throw new Error('账号或密码错误')
  }
}

export async function logout() {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}
