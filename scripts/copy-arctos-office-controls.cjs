const fs=require('node:fs'),path=require('node:path'),postcss=require('postcss');
const from=path.resolve(process.argv[2]||'../arctos-opt'),out=path.resolve(__dirname,'../office-static/office-client-controls.css');
function expand(name){return fs.readFileSync(path.join(from,name),'utf8').replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g,(_,file)=>expand(path.join(path.dirname(name),file.split('?')[0])));}
const source=postcss.parse(expand('workspace-styles.css')),lookup=source.clone(),footer=source.clone();
lookup.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});
lookup.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).filter(selector=>/\.client-(?:summary|birthday|deceased)/.test(selector));if(selectors.length)rule.selector=selectors.map(selector=>'#main .office-client-lookup '+selector).join(',');else rule.remove();});
const button='#dialog .oc-arctos-client-dialog .office-tab-save-footer .footer-actions > button';
footer.walkAtRules(rule=>{if(['font-face','keyframes','charset','import'].includes(rule.name))rule.remove();});
footer.walkRules(rule=>{const selectors=postcss.list.comma(rule.selector).map(selector=>selector.replace(/^:where\(\.main,\s*\.workspace-dialog\)\s*/,''));const kept=selectors.filter(selector=>/^(?:button)?\.btn(?:\.primary)?(?::hover(?::not\(:disabled\))?|:disabled)?$/.test(selector));if(kept.length)rule.selector=kept.map(selector=>button+selector.replace(/^button/,'')).join(',');else rule.remove();});
const frame='#dialog .oc-arctos-client-dialog:has(#editClient)';
const css='/* Arctos lookup cards and Save action, bounded to Office client controls. */\n'+lookup.toString()+'\n'+footer.toString()+`\n#main .office-client-lookup .client-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-width:360px}
#main .office-client-lookup button.client-summary-card{font-family:inherit;cursor:pointer}
#main .office-client-lookup .office-client-search{display:flex;gap:10px;align-items:stretch;margin-bottom:12px}
#main .office-client-lookup .office-client-search .search-field{flex:1;min-width:0}
#main .office-client-lookup .office-client-search input{width:100%;min-width:0}
#main .office-client-lookup .office-client-more{display:flex;justify-content:center;margin-top:14px}
#main .office-client-lookup [hidden]{display:none!important}
#main .office-client-lookup #clientLookupStatsStatus:empty{display:none}
#main .office-client-lookup #clientLookupArchive{color:#233d50}
#main .office-client-lookup .client-birthday-client .agency-tag{margin-left:auto}
${frame}{width:min(980px,96vw);height:min(820px,92dvh);max-width:96vw;max-height:92dvh;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
${frame}>.oc-client-four-tabs{min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column}
${frame} .oc-client-tabs{flex-shrink:0}
${frame} [data-oc-client-panel]:not([hidden]){display:flex;flex-direction:column;min-height:0;flex:1;overflow:hidden}
${frame} [data-oc-client-panel]>form{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
${frame} .office-tab-save-footer{--arctos-sage:#246857;--arctos-sage-hover:#195446;position:static;flex-shrink:0;border-top:1px solid #d7e0e7;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#fff;margin:0;box-shadow:none}
${frame} .office-tab-save-footer .footer-actions{display:flex;gap:8px;flex-shrink:0}
${frame} .office-tab-save-footer [data-tab-save-status]{color:#64748b;min-width:0;font-size:12px}
#dialog .oc-arctos-client-dialog button[hidden]{display:none!important}
@media(max-width:720px){${frame} .office-tab-save-footer{padding:10px 12px max(10px,env(safe-area-inset-bottom));gap:7px}${frame} .office-tab-save-footer .footer-actions{gap:6px}}
`;
fs.writeFileSync(out,css);console.log('Copied Arctos lookup cards and the single footer action.');
