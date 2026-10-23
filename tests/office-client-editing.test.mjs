import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const live = read('office-static/office-live.js')
const parity = read('office-static/arctos-client-parity.js')
const arctosBridge = read('office-static/office-crm-bridge-arctos.ts')
const platinumBridge = read('office-static/office-crm-bridge-platinum.ts')

test('Office client protected fields are editable and save through the agency bridge', () => {
  assert.match(live, /officeCrmClientBridge/)
  assert.match(live, /office:protected/)
  for (const field of ['ssn', 'drivers_license_number', 'medicare_number', 'medicaid_number']) {
    assert.ok(parity.includes(field), `missing editable protected field ${field}`)
  }
  for (const field of ['routing_number', 'account_number', 'username', 'password', 'security_answer']) {
    assert.ok(parity.includes(field), `missing editable protected field ${field}`)
  }
  assert.match(parity, /save_sensitive/)
  assert.match(parity, /api\.request\(current\.agency,'secure_client'/)
  assert.match(parity, /officeReloadProtected/)
  assert.match(parity, /Save Protected Information/)
})

test('Office client medical editors can add, update, and remove records', () => {
  assert.match(live, /data-add-health-row/)
  assert.match(live, /data-remove-health-row/)
  assert.match(live, /save_health_records/)
  for (const field of ['doctor_name', 'specialty', 'practice_name', 'pharmacy_name', 'medication_name', 'prescribing_doctor']) {
    assert.ok(live.includes(field), `missing editable health field ${field}`)
  }
})

test('Office Medicaid level matches Arctos choices and saves to medicare details', () => {
  assert.match(live, /ocMedicaidLevels/)
  for (const level of ['None', 'QMB', 'QMB+', 'SLMB', 'SLMB+', 'QI', 'QDWI', 'FBDE']) {
    assert.ok(live.includes(`['${level}','`), `missing Arctos Medicaid level ${level}`)
  }
  assert.match(live, /data-medicaid-level-editor/)
  assert.match(live, /save_medicare_details/)
  assert.match(parity, /medicaidEditor/)
  for (const bridge of [arctosBridge, platinumBridge]) {
    assert.match(bridge, /saveMedicaidLevel/)
    assert.match(bridge, /medicaidLevels/)
    assert.match(bridge, /from\("medicare_details"\)\.upsert/)
  }
})

for (const [name, bridge] of [['Arctos', arctosBridge], ['Platinum', platinumBridge]]) {
  test(`${name} bridge authorizes and audits protected and medical writes`, () => {
    assert.match(bridge, /actor\.permission\.can_edit/)
    assert.match(bridge, /actor\.permission\.can_view_sensitive/)
    assert.match(bridge, /saveOfficeProtected/)
    assert.match(bridge, /saveHealthRecords/)
    assert.match(bridge, /update_protected/)
    assert.match(bridge, /client_doctors/)
    assert.match(bridge, /client_medications/)
    assert.match(bridge, /client_pharmacies/)
  })
}

test('Arctos protected writes reuse the existing service-only encryption RPCs', () => {
  assert.match(arctosBridge, /mh_client_sensitive_save/)
  assert.match(arctosBridge, /mh_client_banking_save/)
  assert.match(arctosBridge, /mh_medicare_gov_credentials_save/)
})

test('Platinum protected writes preserve the existing AES-GCM vault format', () => {
  assert.match(platinumBridge, /platinumEncrypt/)
  assert.match(platinumBridge, /client_sensitive/)
  assert.match(platinumBridge, /client_banking_vault/)
  assert.match(platinumBridge, /client_medicare_gov_vault/)
})
