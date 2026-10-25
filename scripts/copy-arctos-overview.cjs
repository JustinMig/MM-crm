// Run with a clean Arctos source directory. Copies its real client template and
// enhancement functions, rather than maintaining another hand-written layout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom'),postcss=require('postcss');
const from=path.resolve(process.argv[2]||'../arctos'),out=path.resolve(__dirname,'../office-static');
const hashes={};
const read=name=>{const s=fs.readFileSync(path.join(from,name),'utf8');hashes[name]=crypto.createHash('sha256').update(s).digest('hex');return s;};
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
w.eval('const CLIENT_TABS=[];const esc=v=>String(v??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","\'":"&#39;"}[c]));'+read('views.js').replace(/^import .*;$/gm,'').replace(/export /g,'')+';window.template=clientForm(true);');
w.document.body.innerHTML=w.template;
const form=w.document.querySelector('form');
const run=(name,start,end,call)=>{const s=read(name);w.eval(s.slice(s.indexOf(start),s.indexOf(end))+'\n'+call);};
run('client-product-status.js','function enhanceClientForm','document.addEventListener','enhanceClientForm(document.querySelector("form"));');
run('banking-information.js','function accountMethodPanel','function showMethod','document.querySelector("[data-panel=information]").insertAdjacentHTML("beforeend",markup());');
run('client-personal-underwriting.js','function markup','const baseGetClient','installFields(document.querySelector("form"));');
const intake=read('client-intake-sections.js').replace(/^import .*;$/gm,'');
w.eval(intake.slice(0,intake.indexOf('const originalOpen'))+'\norganizePersonalContact(document.querySelector("form"));');
const overview=form.querySelector('[data-client-group-panel=overview]');
fs.writeFileSync(path.join(out,'arctos-overview-template.js'),'/* Generated from the live Arctos client Overview. See arctos-overview-source.json. */\nwindow.officeArctosOverviewMarkup='+JSON.stringify(overview.innerHTML.replaceAll('Save Client','Save Info'))+';\n');
// Preserve source declaration values, media queries and cascade order. Prefix
// selectors so these copied styles cannot affect any other Office screen.
const scope='#dialog .oc-arctos-client-dialog [data-office-arctos-overview]';
const workspaceCss=read('workspace-styles.css');
const sheets=workspaceCss.includes('@import')?['styles.css','single-user.css','client-record-page-colors.css','client-product-status.css','banking-information.css','client-personal-underwriting.css','client-intake-sections.css','client-product-contrast.css','client-four-tabs.css','arctos-visual-system.css','workspace-styles.css']:['client-record-page-colors.css','workspace-styles.css'];
const classes=new Set([...overview.querySelectorAll('[class]')].flatMap(el=>[...el.classList]));
for(const name of ['client-form','client-four-tabs','workspace-dialog','client-dialog','main','modal-body','modal-footer','footer-actions','btn','primary','secondary','subtle'])classes.add(name);
let css='/* Generated Arctos Overview styles: unrelated selectors removed, remaining declarations and cascade preserved. */\n';
for(const name of sheets){
 const root=postcss.parse(read(name));
 // The Overview inherits its light dialog surface, not Arctos's dark app body.
 root.walkRules(rule=>{if(rule.selector==='body')rule.walkDecls(decl=>{if(!['font-family','font-size','line-height'].includes(decl.prop))decl.remove();});});
 root.walkAtRules(rule=>{if(['import','font-face','keyframes'].includes(rule.name))rule.remove();});
 root.walkRules(rule=>{
  const selectors=postcss.list.comma(rule.selector).filter(s=>[...s.matchAll(/\.([a-zA-Z][\w-]*)/g)].every(m=>classes.has(m[1]))&&!/#[a-z][\w-]*/i.test(s)).map(s=>{
   s=s.replace(/:where\(\.main,\.workspace-dialog\)/g,'').replace(/\.(?:workspace-dialog|modal-body|client-dialog)\s+/g,'').trim();
   if(s===':root'||s==='body'||s==='html')return scope;
   return scope+' '+s;
  });
  if(selectors.length)rule.selector=selectors.join(',\n');else rule.remove();
 });
 css+='\n/* Source: Arctos '+name+' */\n'+root.toString();
}
css+='\n/* Arctos dialog environment and the permanent Office save binding. */\n'+scope+'{color-scheme:light;color:var(--arctos-ink);background:var(--arctos-surface-soft)}\n'+scope+' > .office-tab-save-footer{position:sticky;bottom:0;z-index:25;margin-top:16px}\n'+scope+' > .office-tab-save-footer [role=status]{font-size:12px;color:var(--arctos-muted)}\n';
fs.writeFileSync(path.join(out,'arctos-overview.css'),css);
fs.writeFileSync(path.join(out,'arctos-overview-source.json'),JSON.stringify({source:'https://mh.mayerig.com',copied:'2026-10-24',files:hashes},null,2)+'\n');
w.close();
