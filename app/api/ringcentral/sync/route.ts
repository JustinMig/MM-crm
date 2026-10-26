import { NextResponse } from 'next/server'
import { getCrmSession } from '@/lib/crm-session'
import { syncOfficeRingCentral } from '@/lib/office-ringcentral-sync'
import { isRingCentralConfigured } from '@/lib/ringcentral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { profile } = await getCrmSession()
  const available = Boolean(profile?.agency_id)
  return NextResponse.json({
    pilot: available,
    office: available,
    configured: available && isRingCentralConfigured()
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}


export async function POST() {
  const { profile } = await getCrmSession()
  if (!profile?.agency_id) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }
  if (!isRingCentralConfigured()) {
    return NextResponse.json({
      configured: false,
      error: 'RingCentral credentials have not been added to Vercel yet.'
    }, { status: 409 })
  }

  return syncOfficeRingCentral(profile.agency_id)
}
