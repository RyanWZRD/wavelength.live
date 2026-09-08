(()=>{'use strict';if(window.WavelengthAccess)return;
const CONFIG={mode:'preview',monthly_gbp:29,annual_gbp:290,session_endpoint:'/api/wavelength/session'};
const PRO_ROUTES=new Set(['decision-desk.html','portfolio-intelligence.html','ask-wavelength.html','decision-room.html','replay.html','thesis-watch.html','evidence-map.html']);
const MIXED_ROUTES=new Set(['discover.html','proof-ledger.html']);
const FREE_ROUTES=new Set(['index.html','wavelength-today.html','cockpit.html','coin.html']);
const LOCAL_KEYS=['wavelength_portfolio_v1','wavelength_portfolio_sample_v1','wavelength_thesis_watch_v1','wavelength_thesis_watch_v2','wavelength_research_context_v1','wavelength_customer_onboarding_v1','wavelength_watchlist_v2','wavelength_user_decisions_v1','wavelength_attention_snapshot_v1'];
let provider=null,state={status:'loading',authenticated:false,plan:'unknown',entitled:false,email:null,renewal_at:null,cancel_at_period_end:false};
const page=()=>((location.pathname.split('/').pop()||'index.html').toLowerCase());
const routeTier=p=>PRO_ROUTES.has(p)?'pro':MIXED_ROUTES.has(p)?'mixed':FREE_ROUTES.has(p)?'free':'unclassified';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setProvider(p){provider=p}
async function liveSession(){if(provider?.getSession)return await provider.getSession();try{const r=await fetch(CONFIG.session_endpoint,{credentials:'include',cache:'no-store'});if(r.ok)return await r.json()}catch{}return{status:'signed_out',authenticated:false,plan:'free',entitled:false}}
async function refresh(){if(CONFIG.mode==='preview')state={status:'preview',authenticated:false,plan:'preview_pro',entitled:true,email:null,renewal_at:null,cancel_at_period_end:false};else state=await liveSession();renderBadge();enforce();window.dispatchEvent(new CustomEvent('wavelength:access',{detail:state}));return state}
function can(feature){if(CONFIG.mode==='preview')return true;if(state.plan==='pro'&&state.entitled)return true;const free=new Set(['today','assets','discover_limited','proof_summary','methodology']);return free.has(feature)}
function exportLocal(){const data={schema:'wavelength-local-account-export-v1',exported_at:new Date().toISOString(),items:{}};for(const k of LOCAL_KEYS){const v=localStorage.getItem(k);if(v!==null)data.items[k]=v}return data}
function importLocal(payload){if(!payload||payload.schema!=='wavelength-local-account-export-v1'||typeof payload.items!=='object')throw Error('Invalid Wavelength account export');for(const [k,v] of Object.entries(payload.items)){if(LOCAL_KEYS.includes(k)&&typeof v==='string')localStorage.setItem(k,v)}return true}
function renderBadge(){const top=document.querySelector('.topbar');if(!top||document.getElementById('wlAccountBadge'))return;const a=document.createElement('a');a.id='wlAccountBadge';a.href='account.html';a.className='pill-btn';a.style.textDecoration='none';a.title='Account and subscription';a.textContent=CONFIG.mode==='preview'?'PREVIEW PRO':state.plan==='pro'&&state.entitled?'PRO':state.authenticated?'FREE':'ACCOUNT';top.appendChild(a)}
function enforce(){if(CONFIG.mode!=='enforced')return;const tier=routeTier(page());if(tier!=='pro'||(state.plan==='pro'&&state.entitled))return;const ret=encodeURIComponent(location.pathname.split('/').pop()+location.search+location.hash);location.replace(`upgrade.html?return=${ret}`)}
function registerMigration(adapter){window.WavelengthAccessMigration=adapter}
window.WavelengthAccess={config:CONFIG,get state(){return state},routeTier,can,refresh,setProvider,exportLocal,importLocal,registerMigration,localKeys:[...LOCAL_KEYS],proRoutes:[...PRO_ROUTES],mixedRoutes:[...MIXED_ROUTES],freeRoutes:[...FREE_ROUTES]};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
