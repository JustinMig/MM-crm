import { NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptValue } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const PAGE = 1000
const TABLES = [
  'medicare_info','client_care_info','client_specialists','client_medications',
  'client_life_insurance','client_health_plan_info','client_hospital_indemnity',
  'client_banking_info','documents','client_sms_messages','crm_call_attempts',
  'crm_call_list_items','crm_outreach_campaign_members','crm_outreach_interactions',
  'medicare_commission_events','ringcentral_calls','soa_signature_requests',
  'workspace_calendar_events','workspace_leads','audit_log','audit_log_archive'
]
async function all(db: any, table: string, filter: (q: any) => any) {
  const result: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select('*')).range(from, from + PAGE - 1)
    if (error) throw new Error(table + ': ' + error.message)
    result.push(...(data || []))
    if ((data || []).length < PAGE) return result
  }
}
function readable(row: Record<string, any>, errors: string[], table: string) {
  const item = { ...row }
  for (const [key, value] of Object.entries(row)) {
    if (!key.endsWith('_ciphertext')) continue
    const output = key.slice(0, -11)
    if (value) {
      try { item[output] = decryptValue(String(value)) }
      catch { errors.push(table + '/' + String(row.client_id || row.id) + '/' + key + ': decryption failed') }
    } else item[output] = null
    delete item[key]
  }
  // Site login credentials, authentication secrets and payment card credentials are excluded.
  for (const key of Object.keys(item)) {
    if (/password|secret_answer|security_code_destination|token_hash|debit_card_number|card_number/i.test(key)) delete item[key]
  }
  return item
}
export async function POST() {
  const { profile } = await getCrmSession()
  if (!profile?.active || profile.role !== 'admin' || !profile.agency_id || profile.full_name?.trim().toLowerCase() !== 'justin mayer')
    return NextResponse.json({ error: 'Justin administrator authorization required.' }, { status: 403 })
  try {
    const db = createAdminClient()
    const { data: agent, error: agentError } = await db.from('profiles').select('id,agency_id,full_name')
      .eq('agency_id', profile.agency_id).ilike('full_name', 'Isaiah Hernandez').single()
    if (agentError || !agent) throw new Error('Isaiah agent not found in your agency.')
    const clients = await all(db, 'clients', q => q.eq('agency_id', profile.agency_id).eq('assigned_agent_id', agent.id).order('id'))
    const ids = clients.map(c => String(c.id))
    const tables: Record<string, any[]> = { clients: [] }
    const errors: string[] = []
    tables.clients = clients.map(c => readable(c, errors, 'clients'))
    for (const table of TABLES) {
      const rows: any[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100)
        rows.push(...await all(db, table, q => q.in('client_id', chunk).order('client_id')))
      }
      tables[table] = rows.map(row => readable(row, errors, table))
    }
    const docs = tables.documents || []
    const files = docs.map(d => ({
      document_id: d.id, client_id: d.client_id, storage_path: d.storage_path,
      file_name: d.file_name, mime_type: d.mime_type,
      archive_path: 'Documents/' + d.client_id + '/' + d.id + '-' +
        String(d.file_name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90)
    }))
    const manifest = {
      format: 'mm-crm-to-crm-v1', exported_at: new Date().toISOString(),
      source: 'M&M CRM', agent_name: agent.full_name, agent_id: agent.id,
      client_count: clients.length,
      table_counts: Object.fromEntries(Object.entries(tables).map(([k,v]) => [k,v.length])),
      document_count: files.length,
      errors, verification: errors.length ? 'INCOMPLETE' : 'PENDING_DOCUMENT_DOWNLOAD',
      excluded: ['Login passwords and authentication/recovery secrets', 'Payment card numbers'],
      import_note: 'Recreate references by original client id. CSV is for inspection; JSON is authoritative.'
    }
    return NextResponse.json({ manifest, tables, files }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch(e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Export failed.' }, {status:500})
  }
}
