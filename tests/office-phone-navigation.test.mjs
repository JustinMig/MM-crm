import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const layout=source('app/(crm)/layout.tsx')
const phone=source('app/(crm)/phone/page.tsx')
const callPanel=source('app/(crm)/notifications/NotificationsCallsPanel.tsx')
const messages=source('app/(crm)/messages/MessagesCenter.tsx')

test('PHONE is visible in Office CRM sidebar and bottom mobile navigation',()=>{
 assert.match(layout,/className="nav-link nav-phone" href="\/phone">PHONE<\/Link>/)
 assert.match(layout,/className="mobile-phone-link" href="\/phone">/)
 assert.match(layout,/<span>PHONE<\/span>/)
 assert.match(layout,/\.nav>a\[href="\/phone"\]/)
 assert.match(layout,/\.mobile-nav>a\[href="\/phone"\]/)
})

test('Phone page has real text, call and voicemail sections',()=>{
 assert.match(phone,/href:'\/phone\?tab=messages'/)
 assert.match(phone,/href:'\/phone\?tab=calls'/)
 assert.match(phone,/href:'\/phone\?tab=voicemails'/)
 assert.match(phone,/<MessagesCenter viewerName=\{profile\.full_name\|\|''\}/)
 assert.match(phone,/<NotificationsCallsPanel filter=\{filter\} q=\{params\.q\|\|''\} location="phone"\/>/)
 assert.match(phone,/tab==='voicemails'\?'voicemail'/)
 assert.match(messages,/\/api\/sms\/conversations/)
})

test('Phone call and voicemail filters stay under /phone and retain search',()=>{
 assert.match(callPanel,/location='notifications'/)
 assert.match(callPanel,/location\?:'notifications'\|'phone'/)
 assert.match(callPanel,/location==='phone'/)
 assert.match(callPanel,/\/phone\?tab=/)
 assert.match(callPanel,/\?tab=calls&filter=/)
 assert.match(callPanel,/action=\{location==='phone'\?'\/phone':'\/notifications'\}/)
 assert.match(callPanel,/\['voicemail','Voicemails'\]/)
 assert.match(callPanel,/<details className="office-ring-day"/)
})
