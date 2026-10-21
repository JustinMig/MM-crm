import { redirect } from 'next/navigation'
import { getCrmSession } from '@/lib/crm-session'
import BackupDrivePanel from './BackupDrivePanel'
import ExternalDriveBackupPanel from './ExternalDriveBackupPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BackupPage() {
  const { supabase, profile } = await getCrmSession()

  if (!profile?.agency_id) redirect('/account-setup')
  if (profile.role !== 'admin') redirect('/dashboard')

  const [driveBackupResult, externalBackupResult] = await Promise.all([
    supabase
      .from('audit_log')
      .select('created_at')
      .eq('agency_id', profile.agency_id)
      .eq('action', 'backup.google_drive.completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('audit_log')
      .select('created_at')
      .eq('agency_id', profile.agency_id)
      .eq('action', 'backup.external_drive.completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <>
      <div className="clients-page-heading">
        <h1>CRM Backup</h1>
        <p className="subtle">Protect the CRM with an incremental Google Drive backup and a separate full disaster-recovery file for an external hard drive.</p>
      </div>
      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <h2>CRM to CRM</h2>
        <p className="subtle">Client migration and archival tools for authorized administrators. The full disaster-recovery download below preserves the entire CRM, not just Isaiah Hernandez’s clients. An Isaiah-only, verified, import-ready package is not yet available; do not treat an existing full-CRM backup as an Isaiah-only export.</p>
      </section>
      <BackupDrivePanel lastBackupAt={driveBackupResult.data?.created_at || null} />
      <ExternalDriveBackupPanel lastBackupAt={externalBackupResult.data?.created_at || null} />
    </>
  )
}
