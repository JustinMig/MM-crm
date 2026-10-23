import 'server-only'

const DEFAULT_SERVER = 'https://platform.ringcentral.com'

export type RingCentralCallRecord = {
  id: string
  sessionId?: string
  telephonySessionId?: string
  startTime: string
  duration?: number
  type?: string
  direction: 'Inbound' | 'Outbound'
  result?: string
  from?: { phoneNumber?: string; name?: string }
  to?: { phoneNumber?: string; name?: string }
  recording?: { id?: string; type?: string; contentUri?: string }
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

export function isRingCentralConfigured() {
  return Boolean(
    process.env.RINGCENTRAL_CLIENT_ID?.trim() &&
    process.env.RINGCENTRAL_CLIENT_SECRET?.trim() &&
    process.env.RINGCENTRAL_JWT?.trim()
  )
}

export function ringCentralServer() {
  return (process.env.RINGCENTRAL_SERVER_URL || DEFAULT_SERVER).replace(/\/$/, '')
}

export function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length > 10 ? digits.slice(-10) : digits
}

export async function getRingCentralAccessToken() {
  const clientId = required('RINGCENTRAL_CLIENT_ID')
  const clientSecret = required('RINGCENTRAL_CLIENT_SECRET')
  const jwt = required('RINGCENTRAL_JWT')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${ringCentralServer()}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }),
    cache: 'no-store'
  })

  const payload = await response.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string; message?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || payload.error || `RingCentral authentication failed (${response.status}).`)
  }

  return payload.access_token
}

async function ringCentralJson<T>(pathOrUrl: string, accessToken: string): Promise<T> {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${ringCentralServer()}${pathOrUrl}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = (payload as { message?: string; error_description?: string }).message ||
      (payload as { error_description?: string }).error_description ||
      `RingCentral request failed (${response.status}).`
    throw new Error(message)
  }
  return payload as T
}

// Page through the actual office extension call log rather than silently
// dropping everything after the first 100 calls. RingCentral account history
// and permissions determine how many past calls are available.
export async function listRecentRingCentralCalls(accessToken: string, days = 7, maxPages = 10) {
  const from = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString()
  const records: RingCentralCallRecord[] = []
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      view: 'Simple', dateFrom: from, perPage: '100', page: String(page)
    })
    const payload = await ringCentralJson<{ records?: RingCentralCallRecord[], paging?: { totalPages?: number } }>(
      `/restapi/v1.0/account/~/extension/~/call-log?${params.toString()}`, accessToken
    )
    const next = (payload.records || []).filter(record => record.type === 'Voice' && record.id && record.startTime)
    records.push(...next)
    if (!payload.records?.length || payload.records.length < 100 ||
      (payload.paging?.totalPages && page >= payload.paging.totalPages)) break
  }
  return [...new Map(records.map(record => [record.id,record])).values()]
}

export type RingCentralVoicemailRecord = {
  id: string | number
  type?: string
  creationTime?: string
  readStatus?: string
  from?: {phoneNumber?:string}
  attachments?: {id?:string|number; type?:string; vmDuration?:number; uri?:string}[]
}

export async function listRecentRingCentralVoicemails(accessToken: string, days = 90, maxPages = 10) {
  const from = new Date(Date.now() - Math.max(1, days) * 86400000).toISOString()
  const records: RingCentralVoicemailRecord[] = []
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      messageType:'VoiceMail', dateFrom:from, perPage:'100', page:String(page)
    })
    const payload = await ringCentralJson<{records?:RingCentralVoicemailRecord[],paging?:{totalPages?:number}}>(
      `/restapi/v1.0/account/~/extension/~/message-store?${params.toString()}`,accessToken
    )
    records.push(...(payload.records||[]).filter(record=>record.type==='VoiceMail'&&record.id&&record.creationTime))
    if (!payload.records?.length || payload.records.length < 100 ||
      (payload.paging?.totalPages && page >= payload.paging.totalPages)) break
  }
  return [...new Map(records.map(record=>[String(record.id),record])).values()]
}

export async function fetchRingCentralRecording(recordingId: string, accessToken: string) {
  const metadata = await ringCentralJson<{ contentUri?: string }>(
    `/restapi/v1.0/account/~/recording/${encodeURIComponent(recordingId)}`,
    accessToken
  )
  if (!metadata.contentUri) throw new Error('RingCentral recording content is not available.')

  const response = await fetch(metadata.contentUri, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`Unable to retrieve RingCentral recording (${response.status}).`)
  return response
}
