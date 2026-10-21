import { NextRequest, NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm-session'
import { createAdminClient } from '@/lib/supabase/admin'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request: NextRequest) {
  const { profile } = await getCrmSession()
  if (!profile?.active || profile.role !== 'admin' || !profile.agency_id || profile.full_name?.trim().toLowerCase() !== 'justin mayer')
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const { documentId } = await request.json().catch(() => ({}))
  if (typeof documentId !== 'string' || !/^[a-f0-9-]{36}$/i.test(documentId))
    return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 })
  const db = createAdminClient()
  const { data: doc, error } = await db.from('documents').select('id,client_id,agency_id,storage_path').eq('id', documentId).eq('agency_id', profile.agency_id).single()
  if (error || !doc) return NextResponse.json({ error: 'Document missing' }, { status: 404 })
  const { data: client } = await db.from('clients').select('id,assigned_agent_id').eq('id', doc.client_id).eq('agency_id', profile.agency_id).single()
  const { data: agent } = await db.from('profiles').select('id').eq('id', client?.assigned_agent_id || '').eq('agency_id', profile.agency_id).ilike('full_name','Isaiah Hernandez').maybeSingle()
  if (!client || !agent || !String(doc.storage_path).startsWith(profile.agency_id + '/' + doc.client_id + '/'))
    return NextResponse.json({ error: 'Document not within Isaiah export' }, { status: 403 })
  const { data: blob, error: downloadError } = await db.storage.from('client-documents').download(doc.storage_path)
  if (downloadError || !blob) return NextResponse.json({ error: 'File could not be downloaded' }, { status: 404 })
  return new Response(blob.stream(), {headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
}
