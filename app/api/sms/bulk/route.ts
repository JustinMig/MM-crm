import { after, NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { canSeeAllClients } from '@/lib/client-access'
import { processBulkSmsJob } from '@/lib/background-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import {ownedPhotoPaths,photoUrls} from '@/lib/sms-media'

import {bulkSmsClientIds,chunks} from '@/lib/client-list-pages'
export const maxDuration=300

type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({})) as { client_ids?: string[]; body?: string; media_paths?: unknown }
    let clientIds:string[]
    try{clientIds=bulkSmsClientIds(payload.client_ids)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid client selection.'},{status:400})}
    const body = String(payload.body || '').trim()

    if (!clientIds.length) return NextResponse.json({ error: 'Choose at least one client.' }, { status: 400 })
    if (body.length > 1500) return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })

    const { userId, profile } = await getCrmSession()
    if (!profile?.active||!profile.agency_id) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })

    const admin = createAdminClient()
    const paths=ownedPhotoPaths(payload.media_paths,profile.agency_id,userId)
    await photoUrls(admin,paths)
    if(!body&&!paths.length)return NextResponse.json({error:'Enter a message or attach a photo.'},{status:400})
    const canSeeAgency = canSeeAllClients(profile.role)
    const clients:ClientRow[]=[]
    for(const ids of chunks(clientIds)){
      let clientQuery=admin.from('clients').select('id,first_name,last_name,phone').eq('agency_id',profile.agency_id).in('id',ids)
      if(!canSeeAgency)clientQuery=clientQuery.eq('assigned_agent_id',userId)
      const {data,error}=await clientQuery
      if(error)return NextResponse.json({error:error.message},{status:500})
      clients.push(...(data||[]))
    }
    const accessibleIds = new Set(clients.map((client) => client.id))
    const preflightFailures = clientIds
      .filter((id) => !accessibleIds.has(id))
      .map(() => 'One selected client is not accessible.')

    if (!clients.length) return NextResponse.json({ error: 'None of the selected clients are accessible.' }, { status: 403 })

    const { data: job, error: jobError } = await admin
      .from('crm_background_jobs')
      .insert({
        agency_id: profile.agency_id,
        created_by: userId,
        job_type: 'bulk_sms',
        status: 'queued',
        payload: { client_ids: clients.map((client) => client.id), body, media_paths:paths, preflight_failures: preflightFailures },
        total_items: clients.length,
        failed_items: preflightFailures.length
      })
      .select('id,status,total_items,created_at')
      .single()

    if (jobError || !job) return NextResponse.json({ error: jobError?.message || 'Unable to queue mass text.' }, { status: 500 })

    after(async () => {
      await processBulkSmsJob(job.id)
    })

    await admin.from('audit_log').insert({
      agency_id: profile.agency_id,
      actor_id: userId,
      client_id: null,
      action: 'bulk_sms.job_queued',
      details: { job_id: job.id, recipients: clients.length, inaccessible: preflightFailures.length }
    })

    return NextResponse.json({
      queued: true,
      job_id: job.id,
      total_count: clients.length,
      preflight_failed_count: preflightFailures.length
    }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to queue mass text.' }, { status: 500 })
  }
}
