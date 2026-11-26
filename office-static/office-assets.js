/* Office feature scripts are first requested from this deployment when the view opens. */
(() => {
 'use strict';
 const groups = {
  record: [
   '/arctos-overview-template.js?v=client-controls-1',
   '/office-arctos-overview.js?v=agent-calendar-tabs-20261125-1',
   '/arctos-coverage-template.js?v=client-controls-1',
   '/office-coverage-soa.js?v=client-controls-1',
   '/office-arctos-coverage.js?v=office-perf-20261126-1',
   '/arctos-medical-files-template.js?v=client-controls-1',
   '/office-arctos-medical-files.js?v=office-perf-20261126-1',
   '/office-client-record.js?v=office-perf-20261126-1'
  ],
  backup: ['/vendor/zip-core-2.8.26.min.js', '/office-backup.js'],
  campaigns: ['/office-campaign-center.js?v=office-bulk-20261125-2']
 };
 const requests = new Map();
 const ready = new Set();

 function loadScript(url) {
  if (!requests.has(url)) {
   const request = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = false;
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => {
     requests.delete(url);
     script.remove();
     reject(new Error('The required Office tools could not be loaded. Please try again.'));
    };
    document.head.append(script);
   });
   requests.set(url, request);
  }
  return requests.get(url);
 }

 async function load(group) {
  if (ready.has(group)) return;
  await Promise.all(groups[group].map(loadScript));
  ready.add(group);
 }

 function mount(group, host, render) {
  if (ready.has(group)) return render();
  const status = document.createElement('div');
  status.className = 'loading-state';
  status.setAttribute('role', 'status');
  status.textContent = 'Loading…';
  host.replaceChildren(status);
  return load(group).then(() => {
   if (status.isConnected) render();
  }, error => {
   if (!status.isConnected) return;
   status.setAttribute('role', 'alert');
   status.textContent = error.message + ' ';
   const retry = document.createElement('button');
   retry.type = 'button';
   retry.className = 'outline';
   retry.textContent = 'Retry';
   retry.onclick = () => mount(group, host, render);
   status.append(retry);
  });
 }

 window.officeAssets = {load, mount};
})();
