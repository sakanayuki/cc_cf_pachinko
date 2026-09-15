/**
 * Cloudflare Pages Functions ミドルウェア — サイト全体のパスワード認証
 *
 * functions/_middleware.ts は静的ファイルを含む全リクエストの手前で実行される。
 * 認証済みなら next() で本来のアセットを返し、未認証ならログイン画面を返す。
 *
 * 必要な環境変数（Pages の Settings → Variables and Secrets に登録）:
 *   SITE_PASSWORD  … 合い言葉
 *   COOKIE_SECRET  … Cookie 署名用のランダム文字列（32文字以上を推奨）
 * どちらか欠けている場合はサイトを開かず設定エラー画面を返す（fail closed）。
 */

interface Env {
  SITE_PASSWORD?: string
  COOKIE_SECRET?: string
}

interface EventContext {
  request: Request
  env: Env
  next: () => Promise<Response>
}

const COOKIE_NAME = 'sb_auth'
const SESSION_SECONDS = 60 * 60 * 24 * 7 // 7日
const LOGIN_PATH = '/__auth/login'
const LOGOUT_PATH = '/__auth/logout'

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** HMAC-SHA256。出力は常に 43 文字の base64url なので長さから中身は漏れない。 */
async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return toBase64Url(new Uint8Array(signature))
}

/** 先頭一致で早期 return せず、比較時間を入力内容に依存させない。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function issueToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  return `${expiresAt}.${await sign(secret, String(expiresAt))}`
}

async function isTokenValid(secret: string, token: string | null): Promise<boolean> {
  if (!token) return false
  const separator = token.lastIndexOf('.')
  if (separator < 1) return false
  const expiresAt = Number(token.slice(0, separator))
  if (!Number.isFinite(expiresAt)) return false
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false
  return timingSafeEqual(token.slice(separator + 1), await sign(secret, String(expiresAt)))
}

/**
 * 生パスワード同士ではなく HMAC 同士を比べる。
 * 長さが常に等しくなるので、文字数という手がかりも与えない。
 */
async function isPasswordCorrect(env: Required<Env>, given: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    sign(env.COOKIE_SECRET, `pw:${given}`),
    sign(env.COOKIE_SECRET, `pw:${env.SITE_PASSWORD}`),
  ])
  return timingSafeEqual(a, b)
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

/** オープンリダイレクトを防ぐため、自サイト内の絶対パスだけを通す。 */
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

function redirect(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } })
}

function page(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#141B2E" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --night-1: #141B2E;
    --night-2: #0B0F1D;
    --gold: #F2C84B;
    --gold-deep: #C9981F;
    --cream: #FFF6E0;
    --red: #D9433B;
    --font-display: 'RocknRoll One', 'Hiragino Maru Gothic ProN', 'Hiragino Kaku Gothic ProN', sans-serif;
  }
  html, body { min-height: 100%; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px));
    background:
      radial-gradient(circle 3px at 12% 18%, rgba(255, 214, 120, 0.9) 0 40%, transparent 60%),
      radial-gradient(circle 2px at 78% 12%, rgba(255, 214, 120, 0.8) 0 40%, transparent 60%),
      radial-gradient(circle 2px at 30% 82%, rgba(255, 214, 120, 0.7) 0 40%, transparent 60%),
      radial-gradient(circle 3px at 88% 70%, rgba(255, 214, 120, 0.6) 0 40%, transparent 60%),
      linear-gradient(180deg, var(--night-1) 0%, var(--night-2) 100%);
    font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', sans-serif;
    color: var(--cream);
  }
  .card {
    width: 100%;
    max-width: 380px;
    padding: 32px 24px;
    border: 2px solid rgba(242, 200, 75, 0.35);
    border-radius: 18px;
    background: rgba(11, 15, 29, 0.72);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    text-align: center;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: var(--gold);
    text-shadow: 0 2px 0 var(--gold-deep), 0 6px 18px rgba(242, 200, 75, 0.35);
  }
  .lead { margin-top: 12px; font-size: 14px; line-height: 1.7; color: rgba(255, 246, 224, 0.75); }
  form { margin-top: 24px; display: flex; flex-direction: column; gap: 14px; }
  input {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid rgba(242, 200, 75, 0.3);
    border-radius: 12px;
    background: rgba(20, 27, 46, 0.9);
    color: var(--cream);
    font-size: 16px; /* iOS の自動ズームを防ぐため 16px 未満にしない */
    text-align: center;
    font-family: inherit;
  }
  input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(242, 200, 75, 0.18); }
  button {
    padding: 15px 16px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(180deg, var(--gold) 0%, var(--gold-deep) 100%);
    color: #3F2708;
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: 0.08em;
    cursor: pointer;
    box-shadow: 0 4px 0 #8A6A12;
  }
  button:active { transform: translateY(2px); box-shadow: 0 2px 0 #8A6A12; }
  .error {
    margin-top: 18px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(217, 67, 59, 0.16);
    border: 1px solid rgba(217, 67, 59, 0.5);
    color: #FFC9C4;
    font-size: 13px;
  }
  .note { margin-top: 20px; font-size: 12px; line-height: 1.7; color: rgba(255, 246, 224, 0.5); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
</style>
</head>
<body>
<main class="card">
${inner}
</main>
</body>
</html>`
}

function loginPage(nextPath: string, error: string | null): string {
  return page(
    'スマートボール — 合い言葉',
    `<h1>スマートボール</h1>
<p class="lead">遊ぶには合い言葉が必要です。</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
<form method="POST" action="${LOGIN_PATH}">
  <input type="hidden" name="next" value="${escapeHtml(nextPath)}" />
  <input
    type="password"
    name="password"
    placeholder="合い言葉"
    autocomplete="current-password"
    autofocus
    required
  />
  <button type="submit">あそぶ</button>
</form>
<p class="note">一度入力すると7日間は聞かれません。</p>`,
  )
}

function configErrorPage(): string {
  return page(
    '設定エラー',
    `<h1>設定エラー</h1>
<p class="lead">環境変数が設定されていないため、サイトを表示できません。</p>
<p class="note">
  Cloudflare Pages の Settings → Variables and Secrets に<br />
  <code>SITE_PASSWORD</code> と <code>COOKIE_SECRET</code> を<br />
  登録して、再デプロイしてください。
</p>`,
  )
}

export const onRequest = async (context: EventContext): Promise<Response> => {
  const { request, env } = context
  const url = new URL(request.url)

  // 設定漏れで全公開になるのを避け、開かない側に倒す
  if (!env.SITE_PASSWORD || !env.COOKIE_SECRET) {
    return htmlResponse(configErrorPage(), 500)
  }
  const config = env as Required<Env>

  if (url.pathname === LOGOUT_PATH) {
    const response = redirect('/')
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    )
    return response
  }

  if (url.pathname === LOGIN_PATH) {
    if (request.method !== 'POST') return redirect('/')

    const form = await request.formData()
    const nextPath = safeNextPath(String(form.get('next') ?? '/'))

    if (!(await isPasswordCorrect(config, String(form.get('password') ?? '')))) {
      // 総当たりの試行速度を落とす（CPU時間ではなく待ち時間なので課金対象外）
      await new Promise((resolve) => setTimeout(resolve, 500))
      return htmlResponse(loginPage(nextPath, '合い言葉が違います'), 401)
    }

    const response = redirect(nextPath)
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${await issueToken(config.COOKIE_SECRET)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
    )
    return response
  }

  if (await isTokenValid(config.COOKIE_SECRET, readCookie(request, COOKIE_NAME))) {
    return context.next()
  }

  return htmlResponse(loginPage(safeNextPath(url.pathname + url.search), null), 401)
}
