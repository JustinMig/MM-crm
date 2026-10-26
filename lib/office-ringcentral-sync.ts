import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {getRingCentralAccessToken,listRecentRingCentralCalls,listRecentRingCentralVoicemails,normalizePhone} from '@/lib/ringcentral'

// The RingCentral line is an agency office resource. Keep one stable internal
// owner for the existing unique key so every CRM user sees the same call rows
// without creating duplicates when more than one person presses Sync.
const OFFICE_RINGCENTRAL_OWNER_ID = '9c9b6c8a-add4-475d-bda5-c27169f117a1'

async function runOfficeSync(agencyId: string) {
  try {
    const accessToken = await getRingCentralAccessToken()
    // Includes inbound answered, outbound, missed and all available call results.
    // RingCentral retention determines historical reach; retain saved older rows.
    const records = await listRecentRingCentralCalls(accessToken, 90, 10)
    const admin = createAdminClient()

    const { data: clients, error: clientError } = await admin
      .from('clients')
      .select('id,phone,created_at')
      .eq('agency_id', agencyId)
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })

    if (clientError) throw new Error(`Unable to load client phone numbers: ${clientError.message}`)

    // A phone only identifies a client when it belongs to exactly one client.
    // Every call is retained even if there is no unique matching client.
    const clientIdsByPhone = new Map<string,string[]>()
    for (const client of clients || []) {
      const phone = normalizePhone(client.phone)
      if (!phone) continue
      clientIdsByPhone.set(phone,[...(clientIdsByPhone.get(phone)||[]),client.id])
    }
    const clientByPhone = new Map<string,string>()
    for(const [phone,ids] of clientIdsByPhone)
      if(ids.length===1)clientByPhone.set(phone,ids[0])

    const nowIso = new Date().toISOString()
    const rows = records.map((record) => {
      const externalNumber = record.direction === 'Inbound' ? record.from?.phoneNumber : record.to?.phoneNumber
      const normalizedExternal = normalizePhone(externalNumber)
      return {
        agency_id: agencyId,
        user_id: OFFICE_RINGCENTRAL_OWNER_ID,
        client_id: normalizedExternal ? clientByPhone.get(normalizedExternal) || null : null,
        ringcentral_call_id: record.id,
        ringcentral_session_id: record.sessionId || null,
        telephony_session_id: record.telephonySessionId || null,
        direction: record.direction,
        result: record.result || null,
        started_at: record.startTime,
        duration_seconds: Math.max(0, Number(record.duration || 0)),
        contact_phone: normalizedExternal || null,
        from_phone: record.from?.phoneNumber || null,
        to_phone: record.to?.phoneNumber || null,
        recording_id: record.recording?.id || null,
        updated_at: nowIso
      }
    })

    let saved = 0
    if (rows.length) {
      const { data, error } = await admin
        .from('ringcentral_calls')
        .upsert(rows, { onConflict: 'user_id,ringcentral_call_id' })
        .select('id')
      if (error) throw new Error(`Unable to save RingCentral calls: ${error.message}`)
      saved = data?.length || 0
    }

    const matched = rows.filter((row) => row.client_id).length
    const recordings = rows.filter((row) => row.recording_id).length

    let voicemailSaved = 0
    let voicemailWarning = ''
    try {
      const messages = await listRecentRingCentralVoicemails(accessToken,90,10)
      const voicemails = messages.map(message=>{
        const phone=normalizePhone(message.from?.phoneNumber)
        const audio=message.attachments?.find(item=>item.type==='AudioRecording')
        return {
          agency_id:agencyId,source_message_id:String(message.id),
          client_id:phone?clientByPhone.get(phone)||null:null,
          received_at:message.creationTime,from_phone:message.from?.phoneNumber||null,
          duration_seconds:Math.max(0,Math.round(Number(audio?.vmDuration||0))),
          audio_attachment_id:audio?.id?String(audio.id):null,
          read_status:message.readStatus||null,updated_at:nowIso
        }
      })
      // Keep staff_note/hidden_at untouched by the upsert, so previously
      // deleted voicemail messages cannot reappear on future syncs.
      for(let i=0;i<voicemails.length;i+=150){
        const chunk=voicemails.slice(i,i+150)
        const {error}=await admin.from('ringcentral_office_voicemails')
          .upsert(chunk,{onConflict:'agency_id,source_message_id'})
        if(error)throw new Error(error.message)
        voicemailSaved+=chunk.length
      }
    } catch(error) {
      voicemailWarning=error instanceof Error?error.message:'Unable to sync voicemail inbox.'
    }

    return NextResponse.json({
      configured: true,
      office: true,
      synced: rows.length,
      saved,
      matched,
      unmatched: rows.length - matched,
      recordings,
      voicemails:voicemailSaved,
      voicemail_warning:voicemailWarning
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RingCentral sync failed.'
    const externalFailure = /ringcentral|token|call log|fetch|network|timeout/i.test(message)
    return NextResponse.json({ error: message }, { status: externalFailure ? 502 : 500 })
  }
}


// Deduplicate only within the same agency. Separate office logins must never
// receive another agency's sync response. Database upserts remain idempotent.
const pending = new Map<string, Promise<NextResponse>>()
export async function syncOfficeRingCentral(agencyId: string) {
  const existing = pending.get(agencyId)
  if (existing) return (await existing).clone()
  const task = runOfficeSync(agencyId)
  pending.set(agencyId, task)
  try { return (await task).clone() }
  finally { if (pending.get(agencyId) === task) pending.delete(agencyId) }
}
