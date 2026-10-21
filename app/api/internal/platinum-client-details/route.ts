import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptValue } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const PLATINUM_URL = 'https://sggzshbdfgkyyvxbebul.supabase.co'
const PLATINUM_PUBLISHABLE = 'sb_publishable_wLDvDmI4pmIcADkUlc6-LQ_RWMoQU1Y'
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const ISAIAH_ID = 'b34219da-711a-4f6d-a3c6-087ae96e31c4'
const respond = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' }
})

export async function POST(request: NextRequest) {
  // The existing M&M service role key is never sent to a browser.
  // Both backend authorization and an active Platinum owner session are required.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const received = request.headers.get('x-migration-source-key') || ''
  const expected = Buffer.from(secret)
  const actual = Buffer.from(received)
  if (!secret || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return respond({ error: 'Forbidden' }, 403)
  }
  const bearer = request.headers.get('x-platinum-user-token') || ''
  if (!bearer) return respond({ error: 'Platinum authorization required' }, 401)
  try {
    const platinum = createClient(PLATINUM_URL, PLATINUM_PUBLISHABLE, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: session, error: sessionError } = await platinum.auth.getUser(bearer)
    if (sessionError || !session.user) return respond({ error: 'Platinum sign-in expired' }, 401)
    const { data: profile, error: profileError } = await platinum.from('profiles')
      .select('role,active').eq('id', session.user.id).single()
    if (profileError || !profile?.active || !['owner', 'admin'].includes(profile.role)) {
      return respond({ error: 'Platinum administrator required' }, 403)
    }
    const body = await request.json().catch(() => ({})) as { clientIds?: unknown }
    const ids = body.clientIds
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 10 || ids.some(x => typeof x !== 'string' || !UUID.test(x))) {
      return respond({ error: 'Provide 1 to 10 valid client IDs' }, 400)
    }
    const db = createAdminClient()
    const { data: clients, error: clientError } = await db.from('clients')
      .select('id').eq('assigned_agent_id', ISAIAH_ID).in('id', ids)
    if (clientError) throw clientError
    const authorizedIds = new Set((clients || []).map(c => String(c.id)))
    if (authorizedIds.size !== new Set(ids).size) return respond({ error: 'Source client not assigned to Isaiah' }, 403)

    const [banking, health] = await Promise.all([
      db.from('client_banking_info').select('client_id,bank_name,routing_number_ciphertext,account_number_ciphertext')
        .in('client_id', ids),
      db.from('client_health_plan_info').select('id,client_id,member_id_ciphertext')
        .in('client_id', ids),
    ])
    if (banking.error || health.error) throw new Error('Source read failed')
    return respond({
      source: 'M&M',
      banking: (banking.data || []).map(b => ({
        client_id: b.client_id,
        bank_name: b.bank_name,
        routing_number: b.routing_number_ciphertext ? decryptValue(b.routing_number_ciphertext) : null,
        account_number: b.account_number_ciphertext ? decryptValue(b.account_number_ciphertext) : null,
      })),
      health: (health.data || []).map(h => ({
        id: h.id, client_id: h.client_id,
        member_id: h.member_id_ciphertext ? decryptValue(h.member_id_ciphertext) : null
      }))
    })
  } catch (error) {
    console.error('M&M secure Platinum migration failed', error instanceof Error ? error.name : 'Error')
    return respond({ error: 'Unable to retrieve protected source records' }, 500)
  }
}
