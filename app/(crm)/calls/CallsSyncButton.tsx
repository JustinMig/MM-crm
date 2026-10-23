'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CallsSyncButton({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  // Keep Office Call Data current without requiring staff to press Sync.
  // Prevent repetitive rescans when switching sections or refreshing the page.
  useEffect(() => {
    if (!configured) return
    const key='office-ringcentral-last-sync'
    const last=Number(window.sessionStorage.getItem(key)||0)
    if(Date.now()-last<5*60*1000)return
    window.sessionStorage.setItem(key,String(Date.now()))
    void syncCalls()
    // syncCalls is intentionally started once per mounted configured panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured])

  async function syncCalls() {
    if (syncing) return
    setSyncing(true)
    setMessage('')
    try {
      const response = await fetch('/api/ringcentral/sync', { method: 'POST' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'RingCentral sync failed.')
      if (result.already_syncing) {
        setMessage(result.message || 'RingCentral sync is already running. Please wait a moment.')
        return
      }
      setMessage(`Synced ${result.synced || 0} calls · ${result.matched || 0} matched · ${result.unmatched || 0} unknown · ${result.recordings || 0} recordings · ${result.voicemails || 0} voicemails${result.voicemail_warning ? ' · Voicemail warning: '+result.voicemail_warning : ''}`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'RingCentral sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="ringcentral-calls-sync">
      <button className="btn btn-primary" type="button" onClick={syncCalls} disabled={!configured || syncing}>
        {syncing ? 'Syncing RingCentral…' : configured ? 'Sync RingCentral' : 'RingCentral Setup Needed'}
      </button>
      {message ? <div className="ringcentral-calls-sync-message">{message}</div> : null}
    </div>
  )
}
