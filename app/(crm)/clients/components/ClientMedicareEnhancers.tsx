'use client'

import { ClientRecordBootstrapProvider } from '../../components/ClientRecordBootstrapContext'
import MedicareCoveragePlainBridge from './MedicareCoveragePlainBridge'
import MedicareGovCredentialsBridge from './MedicareGovCredentialsBridge'

export default function ClientMedicareEnhancers({ clientId }: { clientId: string }) {
  return (
    <>
      <MedicareCoveragePlainBridge />
      <ClientRecordBootstrapProvider clientId={clientId}>
        <MedicareGovCredentialsBridge />
      </ClientRecordBootstrapProvider>
    </>
  )
}
