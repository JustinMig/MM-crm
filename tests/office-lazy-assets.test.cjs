const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const root = path.join(__dirname, '../office-static');
const source = file => readFileSync(path.join(root, file), 'utf8');

function workspace() {
 const dom = new JSDOM(source('index.html'), {url:'https://office.test/', runScripts:'outside-only'});
 const w = dom.window;
 w.eval(source('office-assets.js'));
 const host = w.document.querySelector('#office-root');
 const scripts = () => Array.from(w.document.head.querySelectorAll('script[src]'));
 return {dom, w, host, scripts};
}

test('Office sign-in does not request feature bundles, and records reuse their scripts', async () => {
 const {dom, w, scripts} = workspace();
 try {
  const eager = Array.from(w.document.body.querySelectorAll('script[src]'), s => s.src);
  assert.ok(eager.some(url => url.includes('/office-live.js')));
  assert.ok(eager.some(url => url.includes('/arctos-client-parity.js')), 'new client still receives parity enhancements');
  assert.ok(!eager.some(url => /zip-core|office-backup|office-campaign-center|office-client-record|arctos-(overview|coverage|medical-files)/.test(url)));
  assert.equal(scripts().length, 0);
  const both = Promise.all([w.officeAssets.load('record'), w.officeAssets.load('record')]);
  const pending = scripts();
  assert.equal(pending.length, 8);
  for (const script of pending) {
   const url = new URL(script.src);
   assert.equal(url.origin, 'https://office.test');
   // Evaluate the production template and binding scripts in their actual order.
   w.eval(source(url.pathname));
   script.onload();
  }
  await both;
  assert.equal(typeof w.officeClientRecordEnhance, 'function');
  assert.equal(typeof w.officeArctosCoverageMount, 'function');
  assert.equal(typeof w.officeArctosMedicalFilesMount, 'function');
  assert.equal(typeof w.officeArctosOverviewMount, 'function');
  await w.officeAssets.load('record');
  assert.deepEqual(scripts(), pending);
 } finally { dom.window.close(); }
});

test('Backup retries only its failed file and renders once after retry', async () => {
 const {dom, w, host, scripts} = workspace();
 try {
  let renders = 0;
  const mounted = w.officeAssets.mount('backup', host, () => { renders++; host.textContent='Backup'; });
  const [zip, backup] = scripts();
  assert.match(zip.src, /zip-core/);
  assert.match(backup.src, /office-backup/);
  backup.onload();
  zip.onerror();
  await mounted;
  assert.equal(renders, 0);
  const retry = host.querySelector('[role="alert"] button');
  assert.equal(retry.textContent, 'Retry');
  const retrying = retry.onclick();
  const [saved, secondZip] = scripts();
  assert.equal(saved, backup);
  assert.equal(secondZip.src, zip.src);
  secondZip.onload();
  await retrying;
  assert.equal(host.textContent, 'Backup');
  assert.equal(renders, 1);
 } finally { dom.window.close(); }
});

test('Campaign resources completing after changing agent do not replace the newer view', async () => {
 const {dom, w, host, scripts} = workspace();
 try {
  const rendered = [];
  const first = w.officeAssets.mount('campaigns', host, () => rendered.push('first'));
  const second = w.officeAssets.mount('campaigns', host, () => rendered.push('second'));
  assert.equal(scripts().length, 1);
  scripts()[0].onload();
  await Promise.all([first, second]);
  assert.deepEqual(rendered, ['second']);
 } finally { dom.window.close(); }
});

test('New Client, an existing record, and Backup request assets through their normal controls', async () => {
 const {fixture, until} = require('./helpers/office-client-fixture.cjs');
 const {w, q} = await fixture('arctos', {}, true, {openRecord:false});
 try {
  w.eval(source('office-assets.js'));
  const requested = [];
  const head = w.document.head;
  const append = head.append.bind(head);
  head.append = function(script) {
   append(script);
   const file = new URL(script.src).pathname.slice(1);
   requested.push(file);
   queueMicrotask(() => {
    // The real backup implementation only uses ZIP when an encrypted backup starts.
    if (!file.startsWith('vendor/')) w.eval(source(file));
    script.onload();
   });
  };
  q('#officeNewClient').click();
  await until(() => q('.oc-new-client-dialog[data-arctos-parity="done"]'));
  assert.deepEqual(requested, []);
  q('[data-office-client-close]').click();
  q('#clientSearch').value = 'Sample';
  q('#clientSearch').dispatchEvent(new w.KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
  await until(() => q('[data-client^="arctos:"]'));
  q('[data-client^="arctos:"]').click();
  await until(() => q('[data-office-exact-overview]') && q('[data-office-exact-coverage]'));
  assert.equal(requested.length, 8);
  q('[data-office-client-close]').click();
  q('[data-tab="backup"]').click();
  await until(() => q('#officeBackup form'));
  assert.deepEqual(requested.slice(8), ['vendor/zip-core-2.8.26.min.js', 'office-backup.js']);
 } finally { w.close(); }
});
