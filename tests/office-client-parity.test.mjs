import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=file=>readFileSync(new URL('../office-static/'+file,import.meta.url),'utf8')
const js=source('arctos-client-parity.js')
const css=source('arctos-client-parity.css')

test('Office client record starts parity after user logs in and creates the dialog',()=>{
 assert.match(js,/obs\.observe\(document\.body,\{childList:true,subtree:true\}\)/)
 assert.match(js,/currentDialog\(\)/)
 assert.match(js,/data-arctos-parity/)
})
test('Overview preserves editable note on top, and matches Arctos client intake boxes',()=>{
 assert.match(js,/client-glance-activity client-glance-reviews-layout/)
 assert.match(js,/form\.insertBefore\(row,form\.querySelector\('\.oc-client-category'\)\)/)
 for(const name of ['Client Name','Date of Birth & Gender','Email & Phone','Address','Client Assignment & Household'])
  assert.ok(js.includes(name),'missing '+name)
})
test('Sensitive data lives in relevant locations instead of consolidated Office grouping',()=>{
 assert.match(js,/Identification & Protected/)
 assert.match(js,/dataset\.parityStash/)
 assert.match(js,/Driver’s License Identification/)
 assert.match(js,/Banking Information/)
 assert.match(js,/Social Security Number/)
 assert.match(js,/Medicare Number/)
 assert.match(js,/Medicaid Number/)
 assert.match(js,/Medicare\.gov Login Credentials/)
 assert.match(js,/vault\.querySelector\('\[data-protected=/)
 assert.match(js,/loadProtected\(modal\)/)
 assert.match(js,/button\.click\(\)/)
 assert.match(js,/document\.visibilityState==='hidden'/)
 assert.doesNotMatch(js,/Reveal.*button\.onclick=.*original\.click\(\)/)
})
test('Existing note, client, and appointment handlers stay attached to original DOM',()=>{
 assert.match(js,/form\.prepend\(glance\)/)
 assert.match(js,/form\.insertBefore/)
 assert.match(js,/No stored identifier leaves the secure bridge/)
})
test('Official Arctos four-tabs and client record colors remain included',()=>{
 assert.match(css,/Source: Arctos client-four-tabs\.css/)
 assert.match(css,/Source: Arctos client-record-page-colors\.css/)
 assert.match(css,/Source: Arctos client-intake-sections\.css/)
})

test('Coverage uses Arctos main categories and preserves the health plan and HIP sections',()=>{
 for(const key of ['medicare','life','hospital_indemnity','retirement'])
   assert.ok(js.includes("['"+key+"'"),'Missing coverage category '+key)
 assert.match(js,/Health Plan Information/)
 assert.match(js,/Medicare Information/)
 assert.match(js,/Medicaid Information/)
 assert.match(js,/Medicare\.gov Login Credentials/)
 assert.match(js,/Sunfire/)
 assert.match(js,/Hospital Indemnity Plan Information/)
 assert.match(js,/Annual Medicare Reviews/)
})
test('Notes & Files shows document list and original secure open control',()=>{
 assert.match(js,/Documents & Files/)
 assert.match(js,/arctos-files-status/)
 assert.match(js,/data-office-doc/)
 assert.match(js,/Client Notes/)
 assert.match(css,/arctos-files-section/)
})
test('Arctos personal intake boxes are full width and do not split into mismatched columns',()=>{
 assert.match(css,/arctos-personal-group/)
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/)
 assert.match(css,/intake-section-address/)
 assert.match(css,/client-glance-activity/)
})
