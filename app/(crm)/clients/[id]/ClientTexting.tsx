'use client'
import SmsPhotoAttachment, {SmsPhotos,type SmsPhoto} from '../../components/SmsPhotoAttachment'

import { useCallback, useEffect, useState } from 'react'

type SmsMessage = {
  id: string
  direction: 'outbound' | 'inbound'
  media_urls?: string[]
  body: string
  from_number: string | null
  to_number: string | null
  status: string
  error_code: string | null
  error_message: string | null
  created_at: string
}

export default function ClientTexting({ clientId, clientName, phone }: { clientId: string; clientName: string; phone: string }) {
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [body, setBody] = useState('')
  const [photo,setPhoto]=useState<SmsPhoto|null>(null)
  const [uploading,setUploading]=useState(false)
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/clients/${clientId}/sms`, { cache: 'no-store' })
    const result = await response.json()
    if (response.ok) setMessages(result.messages || [])
  }, [clientId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => window.clearInterval(timer)
  }, [load])

  async function send() {
    const text = body.trim()
    if ((!text&&!photo) || uploading || sending) return
    setSending(true)
    setStatus('Sending…')
    try {
      const response = await fetch(`/api/clients/${clientId}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, media_paths:photo?[photo.path]:[] })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send text.')
      setBody('')
      setPhoto(null)
      setStatus('Text sent to Twilio.')
      await load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to send text.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="card card-pad client-text-card" style={{ marginTop: 18 }}>
      <div className="client-text-heading">
        <div>
          <h2>Text {clientName}</h2>
          <p className="subtle">SMS conversation · {phone || 'No phone number saved'}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="client-text-thread">
        {messages.length ? messages.map((message) => (
          <div key={message.id} className={`client-text-message ${message.direction}`}>
            <div>{message.body}<SmsPhotos urls={message.media_urls}/></div>
            <small>
              {message.direction === 'outbound' ? 'You' : clientName} · {new Date(message.created_at).toLocaleString()} · {message.status}
              {message.error_code ? ` · Error ${message.error_code}` : ''}
            </small>
          </div>
        )) : <div className="client-text-empty">No messages yet. Send the first test text below.</div>}
      </div>

      <div className="client-text-compose">
        <SmsPhotoAttachment photo={photo} onChange={setPhoto} onBusy={setUploading} disabled={!phone||sending}/>
        <textarea
          className="textarea"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Type a text message…"
          maxLength={1500}
          disabled={!phone || sending}
        />
        <button type="button" className="btn btn-primary" onClick={send} disabled={!phone || (!body.trim()&&!photo) || uploading || sending}>{sending ? 'Sending…' : 'Send Text'}</button>
      </div>
      {status ? <div className="field-help">{status}</div> : null}
      <div className="field-help">Replies will appear here after Twilio's incoming-message webhook is pointed to the CRM.</div>
    </section>
  )
}
