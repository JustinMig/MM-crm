// Capture the actual rendered Arctos Coverage UI with synthetic, in-memory data.
// No production data or credentials are read. Run: node scripts/copy-arctos-coverage.cjs ../arctos-opt
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {JSDOM}=require('jsdom'),postcss=require('postcss');
const from=path.resolve(process.argv[2]||'../arctos-opt'),out=path.resolve(__dirname,'../office-static');
const {build}=createRequire(path.join(from,'package.json'))('esbuild');
const modules=['medicare-gov-credentials','life-multiple-policies','life-other-carrier','client-health-tabs','hospital-indemnity-documents','client-medicare-cleanup','client-medicare-assets','new-client-soa-actions','client-soa-compliance','new-client-medicare-uploads','client-file-experience','life-policy-documents'];
const entry=`import {mhRepository} from './supabase-repository.js';import {Dialogs} from './dialogs.js';import {clientForm} from './views.js';import {hydrate} from './core.js';${modules.map(n=>`import './${n}.js';`).join('')}window.capture={mhRepository,Dialogs,clientForm,hydrate};`;
const inputs=new Map();
(async()=>{
 const result=await build({stdin:{contents:entry,resolveDir:from},bundle:true,format:'iife',write:false,metafile:true,plugins:[{name:'synthetic-only',setup(b){
  b.onResolve({filter:/supabase-repository\.js$/},()=>({path:'repository',namespace:'capture'}));
  b.onResolve({filter:/supabase-client\.js$/},()=>({path:'database',namespace:'capture'}));
  b.onLoad({filter:/.*/,namespace:'capture'},args=>({contents:args.path==='database'?'export const supabase=window.captureDB;':'export const supabase=window.captureDB;export const mhRepository=window.captureRepository;'}));
  b.onLoad({filter:/\.js$/},args=>{const contents=fs.readFileSync(args.path,'utf8');inputs.set(path.relative(from,args.path),contents);return {contents,loader:'js'};});
 }}]});
 async function capture(populated=false){
  const dom=new JSDOM('<body></body>',{url:'https://arctos-capture.invalid',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
  const id='11111111-1111-4111-8111-111111111111',rowId='22222222-2222-4222-8222-222222222222';
  const db={life_policies:populated?[{id:rowId,client_id:id},{id:'33333333-3333-4333-8333-333333333333',client_id:id}]:[],hospital_indemnity_plans:populated?[{id:rowId,client_id:id}]:[]};
  const client={id,first_name:'',last_name:'',_health_id:null};
  w.captureDB={from(table){let one=false;const q=new Proxy({then(resolve){resolve({data:one?(db[table]?.[0]||null):(db[table]||[]),error:null});}}, {get(target,key){if(key==='then')return target.then;if(['single','maybeSingle'].includes(key))return()=>{one=true;return q;};return()=>q;}});return q;},rpc:async()=>({data:[],error:null}),auth:{getUser:async()=>({data:{user:{id}}}),getSession:async()=>({data:{session:{user:{id},access_token:'SYNTHETIC'}}})},functions:{invoke:async()=>({data:{},error:null})},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:''},error:null})})}};
  w.captureRepository={user:{id},profile:{id,role:'owner',full_name:'',phone:''},agents:[],getClient:async()=>client,saveClient:async r=>r};
  const observers=[],Native=w.MutationObserver;w.MutationObserver=class extends Native{constructor(fn){super(fn);observers.push(this);}};
  w.CSS={escape:value=>String(value)};w.open=()=>null;w.scrollTo=()=>{};w.confirm=()=>false;
  w.fetch=async()=>new Response(JSON.stringify({error:'Synthetic capture does not use the network'}),{status:400});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
  w.eval(result.outputFiles[0].text);
  const {mhRepository,Dialogs,clientForm,hydrate}=w.capture;
  const record=await mhRepository.getClient(id),manager=new Dialogs(),controller=manager.open({kind:'client-dialog',clientId:id,body:clientForm(true)}),form=controller.node.querySelector('form');
  hydrate(form,record);controller.attachForm(form);
  await new Promise(resolve=>setTimeout(resolve,120));
  const coverage=form.querySelector('[data-client-group-panel="coverage"]');
  coverage.querySelectorAll('details').forEach(el=>el.open=false);
  for(const el of coverage.querySelectorAll('[data-indemnity-document-key]'))el.removeAttribute('data-indemnity-document-key');
  const cards={life:coverage.querySelector('[data-life-policy-card]')?.outerHTML,lifeExtra:coverage.querySelectorAll('[data-life-policy-card]')[1]?.outerHTML,indemnity:coverage.querySelector('[data-health-card]')?.outerHTML};
  if(populated){
   form.querySelector('[data-add-life-policy]').click();form.querySelector('[data-add-health-record="hospital_indemnity"]').click();
   await new Promise(resolve=>setTimeout(resolve,30));
   cards.lifeNew=coverage.querySelector('[data-life-policy-list] > :last-child')?.outerHTML;
   cards.indemnityNew=coverage.querySelector('[data-health-list] > :last-child')?.outerHTML;
   cards.indemnityNew=cards.indemnityNew.replace(/ data-indemnity-document-key="[^"]*"/g,'');
  }
  if(errors.length)throw new Error(errors.join('\n'));
  const html=coverage.innerHTML;
  observers.forEach(o=>o.disconnect());manager.destroy();w.close();return {html,cards};
 }
 const empty=await capture(),saved=await capture(true);
 fs.writeFileSync(path.join(out,'arctos-coverage-template.js'),'/* Generated from Arctos source modules; synthetic empty and saved records. */\nwindow.officeArctosCoverageMarkup='+JSON.stringify(empty.html)+';\nwindow.officeArctosCoverageCards='+JSON.stringify({...saved.cards,lifeEmpty:empty.cards.life})+';\n');
 const soaSource=inputs.get('client-soa-compliance.js').replace(/^import .*;$/gm,'').split("document.addEventListener('click'")[0].replace('https://mh.mayerig.com/soa-sign.html','${apiAdapter.signOrigin}/soa-sign.html');
 fs.appendFileSync(path.join(out,'arctos-coverage-template.js'),'\n/* The original Arctos SOA dialogs, with agency-specific data adapters. */\nwindow.officeArctosSoaUi=function(apiAdapter){const supabase=apiAdapter.supabase,mhRepository=apiAdapter.repository;\n'+soaSource+'\nreturn {sign:openCompliantSignOnScreen,text:openCompliantTextSoa,latest:latestSoa,open:openStored};};\n');
 const signPage=fs.readFileSync(path.join(from,'soa-sign.html'),'utf8');inputs.set('soa-sign.html',signPage);
 fs.mkdirSync(path.join(out,'platinum'),{recursive:true});
 fs.writeFileSync(path.join(out,'platinum/soa-sign.html'),signPage.replaceAll('bogusfmvdrlvxscopgaw','sggzshbdfgkyyvxbebul').replaceAll('M&H Insurance Group','Platinum Financial').replaceAll('M&amp;H Insurance Group','Platinum Financial'));
 // Expand imports in source order. All selectors are bounded by the Coverage panel.
 const cssInputs=new Map();
 function expand(name){const raw=fs.readFileSync(path.join(from,name),'utf8');cssInputs.set(name,raw);return raw.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g,(_,file)=>expand(path.join(path.dirname(name),file.split('?')[0])));}
 const expandedCss=expand('client-record-page-colors.css')+'\n'+expand('workspace-styles.css'),root=postcss.parse(expandedCss);
 if(process.env.COVERAGE_REVIEW_DIR){fs.mkdirSync(process.env.COVERAGE_REVIEW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.COVERAGE_REVIEW_DIR,'source.css'),expandedCss);fs.writeFileSync(path.join(process.env.COVERAGE_REVIEW_DIR,'source.html'),empty.html);}
 const scope='#dialog .oc-arctos-client-dialog [data-office-arctos-coverage]';
 const sample=new JSDOM('<body>'+empty.html+saved.html+'</body>');
 const classes=new Set([...sample.window.document.querySelectorAll('[class]')].flatMap(el=>[...el.classList]));
 for(const name of ['workspace-dialog','client-dialog','main','modal-body','modal-footer','footer-actions','client-form','client-four-tabs','error','queued','disabled','active','multi-file-row','life-policy-document-row','indemnity-doc-row'])classes.add(name);
 sample.window.close();
 root.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});
 root.walkRules(rule=>{
  if(rule.selector==='body')rule.walkDecls(decl=>{if(!['font-family','font-size','line-height','color-scheme'].includes(decl.prop))decl.remove();});
  const selectors=postcss.list.comma(rule.selector).filter(selector=>[...selector.matchAll(/\.([A-Za-z][\w-]*)/g)].every(match=>classes.has(match[1]))&&!/^(?:html|\.main)$/.test(selector));
  if(!selectors.length){rule.remove();return;}
  if(selectors.every(selector=>/^(?:\.workspace-dialog(?:\.client-dialog)?|\.client-dialog|\.modal-body)$/.test(selector)))rule.walkDecls(decl=>{if(!['font-family','font-size','font-weight','line-height','color-scheme','color','background','background-color'].includes(decl.prop)&&!decl.prop.startsWith('--'))decl.remove();});
  rule.selector=selectors.map(selector=>{
   selector=selector.replace(/:where\(\.main,\s*\.workspace-dialog\)/g,'').replace(/(?:^|\s)\.(?:workspace-dialog(?:\.client-dialog)?|client-dialog|modal-body|main)(?=\s|$)/g,' ').replace(/^(?:html|body|:root)(?:\s|$)/,' ').trim();
   return selector?scope+' '+selector:scope;
  }).join(',\n');
 });
 const environment='#dialog .oc-arctos-client-dialog:has([data-office-exact-coverage-panel]:not([hidden]))';
 const frame='\n/* Match the Arctos dialog dimensions and keep Save visible while the copied form scrolls. */\n'+environment+'{width:min(980px,96vw);height:min(820px,92dvh);max-width:96vw;max-height:92dvh;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}\n'+environment+' > .oc-client-four-tabs{min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column}\n'+environment+' .oc-client-tabs{flex-shrink:0}\n'+environment+' [data-office-exact-coverage-panel]{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}\n'+environment+' [data-office-exact-coverage]{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}\n'+environment+' [data-tab-save-footer="coverage"]{flex-shrink:0;margin:0}\n';
 const soaStyles=postcss.parse(expandedCss);
 soaStyles.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});
 soaStyles.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).filter(selector=>/\.mh-soa-/.test(selector));if(selectors.length)rule.selector=selectors.join(',');else rule.remove();});
 const soaBase=postcss.parse(fs.readFileSync(path.join(from,'styles.css'),'utf8'));
 soaBase.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).filter(selector=>/^(?:\*|button|input|select|textarea|h[1-4]|p|\.field(?:\b|\s)|\.btn(?:\b|\s)|\.modal-close)/.test(selector));if(selectors.length)rule.selector=selectors.map(selector=>'.mh-soa-dialog '+selector).join(',');else rule.remove();});
 fs.writeFileSync(path.join(out,'arctos-coverage.css'),'/* Exact Arctos declarations and cascade, scoped to Office Coverage. */\n'+root.toString()+frame+'\n/* The copied Arctos signing dialogs. */\n'+soaBase.toString()+'\n'+soaStyles.toString());
 const hashes={};for(const [name,content]of [...inputs,...cssInputs])hashes[name]=crypto.createHash('sha256').update(content).digest('hex');
 fs.writeFileSync(path.join(out,'arctos-coverage-source.json'),JSON.stringify({source:'https://mh.mayerig.com',copied:'2026-10-25',method:'Rendered from original source with synthetic records; no live data',files:hashes},null,2)+'\n');
 console.log('Captured complete Arctos Coverage and life/indemnity card templates.');
})().catch(error=>{console.error(error);process.exitCode=1;});
