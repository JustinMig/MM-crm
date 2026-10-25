// Render the original Arctos Medical and Notes & Files integrations with synthetic data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {JSDOM}=require('jsdom'),postcss=require('postcss');
const from=path.resolve(process.argv[2]||'../arctos-opt'),out=path.resolve(__dirname,'../office-static');
const {build}=createRequire(path.join(from,'package.json'))('esbuild');
const modules=['client-pharmacy','client-health-tabs','medication-autocomplete','client-collapse','client-file-experience','client-notes-extras','client-files-hub'];
const inputs=new Map(),id='11111111-1111-4111-8111-111111111111';
(async()=>{
 const bundled=await build({stdin:{contents:`import {mhRepository} from './supabase-repository.js';import {Dialogs} from './dialogs.js';import {clientForm} from './views.js';import {hydrate} from './core.js';${modules.map(name=>`import './${name}.js';`).join('')}window.capture={mhRepository,Dialogs,clientForm,hydrate};`,resolveDir:from},bundle:true,format:'iife',write:false,plugins:[{name:'synthetic-only',setup(b){
  b.onResolve({filter:/supabase-(?:repository|client)\.js$/},args=>({path:args.path.includes('repository')?'repository':'database',namespace:'capture'}));
  b.onLoad({filter:/.*/,namespace:'capture'},args=>({contents:args.path==='repository'?'export const mhRepository=window.captureRepository;export const supabase=window.captureDB;':'export const supabase=window.captureDB;'}));
  b.onLoad({filter:/\.js$/},args=>{const contents=fs.readFileSync(args.path,'utf8');inputs.set(path.relative(from,args.path),contents);return {contents,loader:'js'};});
 }}]});
 async function capture(populated=false){
  const dom=new JSDOM('<body></body>',{url:'https://arctos-capture.invalid',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
  const client={id,first_name:'',last_name:'',notes:'',doctors_section_notes:''};
  const database={client_doctors:populated?[{id:'22222222-2222-4222-8222-222222222222',client_id:id}]:[],client_medications:populated?[{id:'33333333-3333-4333-8333-333333333333',client_id:id}]:[],client_pharmacies:[],documents:[],client_notes:[]};
  w.captureDB={from(table){let one=false,start=0,end=999;const q=new Proxy({then(resolve){const rows=(database[table]||[]).slice(start,end+1);resolve({data:one?rows[0]||null:rows,error:null});}},{get(target,key){if(key==='then')return target.then;if(['single','maybeSingle'].includes(key))return()=>{one=true;return q;};if(key==='range')return(a,b)=>{start=a;end=b;return q;};return()=>q;}});return q;},auth:{getUser:async()=>({data:{user:{id}}}),getSession:async()=>({data:{session:{user:{id},access_token:'SYNTHETIC'}}})}};
  w.captureRepository={user:{id},profile:{id,role:'owner'},agents:[],getClient:async()=>client,saveClient:async row=>row};
  const observers=[],Native=w.MutationObserver;w.MutationObserver=class extends Native{constructor(fn){super(fn);observers.push(this);}};
  w.fetch=async()=>new Response('{}',{status:400});w.CSS={escape:value=>String(value)};w.open=()=>null;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.eval(bundled.outputFiles[0].text);
  const {mhRepository,Dialogs,clientForm,hydrate}=w.capture,record=await mhRepository.getClient(id),manager=new Dialogs(),controller=manager.open({kind:'client-dialog',clientId:id,body:clientForm(true)}),form=controller.node.querySelector('form');hydrate(form,record);controller.attachForm(form);
  await new Promise(resolve=>setTimeout(resolve,120));form.querySelector('[data-client-group-tab="files"]').click();await new Promise(resolve=>setTimeout(resolve,30));
  form.querySelectorAll('details').forEach(el=>el.open=false);
  const medical=form.querySelector('[data-client-group-panel="medical"]').outerHTML,files=form.querySelector('[data-client-group-panel="files"]').outerHTML;
  const cards={doctor:form.querySelector('[data-health-card][data-kind="doctor"]')?.outerHTML,medication:form.querySelector('[data-health-card][data-kind="medication"]')?.outerHTML};
  if(errors.length)throw Error(errors.join('\n'));observers.forEach(o=>o.disconnect());manager.destroy();w.close();return {medical,files,cards};
 }
 const empty=await capture(),saved=await capture(true);
 let js='/* Generated from the actual Arctos Medical and Notes & Files modules. */\nwindow.officeArctosMedicalFilesMarkup='+JSON.stringify({medical:empty.medical,files:empty.files})+';\nwindow.officeArctosMedicalCards='+JSON.stringify(saved.cards)+';\n';
 const hub=inputs.get('client-files-hub.js').replace(/^import .*;\s*$/gm,'').replace("dialog.classList.contains('client-dialog')","dialog.classList.contains('oc-arctos-client-dialog')").replace("modal.className='mh-file-preview-dialog cfh-preview'","modal.className='mh-file-preview-dialog cfh-preview office-file-preview'").replace('document.body.append(modal);','document.body.append(modal);apiAdapter.onPreview?.(modal);').replace('observeClientDialogs(bind);','return {bind,openFileModal};');
 const model=inputs.get('client-files-hub-model.js').replace(/^export /gm,'');
 js+='\n/* Original file hub, filters, note history, and previews, using an Office data adapter. */\nwindow.officeArctosFilesUi=function(apiAdapter){const supabase=apiAdapter.supabase,mhRepository=apiAdapter.repository;\n'+model+'\n'+hub+'\n};\n';
 let autocomplete=inputs.get('medication-autocomplete.js').replace(/^import .*;\s*$/gm,'');
 autocomplete=autocomplete.replace(/async function searchMedication\(query, signal\) \{[\s\S]*?\n\}\n\nfunction showSuggestions/,'async function searchMedication(query,signal){const key=query.toLocaleLowerCase("en-US");if(suggestionCache.has(key))return suggestionCache.get(key);const rows=await apiAdapter.search(query,signal);suggestionCache.set(key,rows);return rows;}\n\nfunction showSuggestions');
 autocomplete=autocomplete.replaceAll("document.addEventListener(","root.addEventListener(").replace('function prepareVisibleMedicationCards(root = document)','function prepareVisibleMedicationCards(root = apiAdapter.root)').replace(/prepareVisibleMedicationCards\(\);/g,'prepareVisibleMedicationCards(root);');
 js+='\n/* Original Arctos medication suggestions and dosage controls. */\nwindow.officeArctosMedicationUi=function(apiAdapter){const root=apiAdapter.root;\n'+autocomplete+'\nreturn {prepare:prepareCard,close:closeMenu};\n};\n';
 fs.writeFileSync(path.join(out,'arctos-medical-files-template.js'),js);
 const cssInputs=new Map();function expand(name){const raw=fs.readFileSync(path.join(from,name),'utf8');cssInputs.set(name,raw);return raw.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g,(_,file)=>expand(path.join(path.dirname(name),file.split('?')[0])));}
 const expanded=expand('client-record-page-colors.css')+'\n'+expand('workspace-styles.css'),root=postcss.parse(expanded),scope='#dialog .oc-arctos-client-dialog [data-office-arctos-medical-files]';
 const sample=new JSDOM('<body>'+empty.medical+empty.files+saved.medical+saved.files+'</body>'),classes=new Set([...sample.window.document.querySelectorAll('[class]')].flatMap(el=>[...el.classList]));sample.window.close();
 for(const name of ['workspace-dialog','client-dialog','main','modal-body','modal-footer','footer-actions','client-form','client-four-tabs','error','queued','disabled','active','medication-autocomplete-menu','medication-autocomplete-option','medication-lookup-status','no-results','cfh-file','cfh-file-info','cfh-note','cfh-more','cfh-unavailable','pharmacy-file-row','document-row','document-row-main','document-row-actions'])classes.add(name);
 root.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});
 root.walkRules(rule=>{
  if(rule.selector==='body')rule.walkDecls(decl=>{if(!['font-family','font-size','line-height','color-scheme'].includes(decl.prop))decl.remove();});
  const selectors=postcss.list.comma(rule.selector).filter(selector=>[...selector.matchAll(/\.([A-Za-z][\w-]*)/g)].every(match=>classes.has(match[1]))&&!/^(?:html|\.main)$/.test(selector));
  if(!selectors.length){rule.remove();return;}
  if(selectors.every(selector=>/^(?:\.workspace-dialog(?:\.client-dialog)?|\.client-dialog|\.modal-body)$/.test(selector)))rule.walkDecls(decl=>{if(!['font-family','font-size','font-weight','line-height','color-scheme','color','background','background-color'].includes(decl.prop)&&!decl.prop.startsWith('--'))decl.remove();});
  rule.selector=selectors.map(selector=>{selector=selector.replace(/:where\(\.main,\s*\.workspace-dialog\)/g,'').replace(/(?:^|\s)\.(?:workspace-dialog(?:\.client-dialog)?|client-dialog|modal-body|main)(?=\s|$)/g,' ').replace(/^(?:html|body|:root)(?:\s|$)/,' ').trim();return selector?scope+' '+selector:scope;}).join(',\n');
 });
 const frame='#dialog .oc-arctos-client-dialog:has([data-office-exact-medical-files-panel]:not([hidden]))';
 let css='/* Exact Arctos Medical and Notes & Files declarations and cascade. */\n'+root.toString()+'\n'+frame+'{width:min(980px,96vw);height:min(820px,92dvh);max-width:96vw;max-height:92dvh;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}\n'+frame+' > .oc-client-four-tabs{min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column}\n'+frame+' .oc-client-tabs{flex-shrink:0}\n'+frame+' [data-office-exact-medical-files-panel]{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}\n'+frame+' form[data-office-arctos-medical-files]{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}\n'+frame+' .office-tab-save-footer{flex-shrink:0;margin:0}\n';
 const preview=postcss.parse(expanded);preview.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});preview.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).filter(selector=>/\.(?:mh-file-preview|cfh-preview)/.test(selector));if(selectors.length)rule.selector=selectors.join(',');else rule.remove();});
 const base=postcss.parse(fs.readFileSync(path.join(from,'styles.css'),'utf8'));base.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).filter(selector=>/^(?:\*|button|input|select|textarea|h[1-4]|p|\.field(?:\b|\s)|\.btn(?:\b|\s)|\.modal-close)/.test(selector));if(selectors.length)rule.selector=selectors.map(selector=>'.office-file-preview '+selector).join(',');else rule.remove();});
 css+='\n/* Original in-site document preview. */\n'+base.toString()+'\n'+preview.toString();fs.writeFileSync(path.join(out,'arctos-medical-files.css'),css);
 const hashes={};for(const [name,content]of [...inputs,...cssInputs])hashes[name]=crypto.createHash('sha256').update(content).digest('hex');
 fs.writeFileSync(path.join(out,'arctos-medical-files-source.json'),JSON.stringify({source:'https://mh.mayerig.com',copied:'2026-10-25',method:'Original enhanced DOM and source UI functions; synthetic records only',files:hashes},null,2)+'\n');
 if(process.env.MEDICAL_FILES_REVIEW_DIR){fs.mkdirSync(process.env.MEDICAL_FILES_REVIEW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.MEDICAL_FILES_REVIEW_DIR,'source.css'),expanded);for(const key of ['medical','files'])fs.writeFileSync(path.join(process.env.MEDICAL_FILES_REVIEW_DIR,key+'.html'),empty[key]);}
 console.log('Copied the complete Arctos Medical and Notes & Files UI.');
})().catch(error=>{console.error(error);process.exitCode=1;});
