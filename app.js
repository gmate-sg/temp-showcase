import { mountDemo, previewMarkup } from './src/demos.js';
const $ = (s) => document.querySelector(s);
const categories = [
{id:'navigation',name:'导航与菜单',en:'NAVIGATION',note:'网站的方向与入口'},
{id:'layout',name:'界面与布局',en:'LAYOUT',note:'内容如何组织与排列'},
{id:'actions',name:'按钮与操作',en:'ACTIONS',note:'每一次点击的回应'},
{id:'forms',name:'表单与输入',en:'FORMS & INPUT',note:'输入、选择与验证'},
{id:'content',name:'卡片与内容',en:'CONTENT',note:'把信息呈现得清晰'},
{id:'feedback',name:'状态与反馈',en:'FEEDBACK',note:'让用户看见变化'},
{id:'overlays',name:'弹窗与浮层',en:'OVERLAYS',note:'在需要的时候出现'},
{id:'media',name:'图片与媒体',en:'MEDIA',note:'图像、画廊与观看'},
{id:'motion',name:'动效与交互',en:'MOTION',note:'让界面有时间与节奏'},
{id:'three',name:'3D 与视觉',en:'THREE.JS',note:'超越平面的表达'},
];
const categoryMap = Object.fromEntries(categories.map(c=>[c.id,c]));
const state = {entries:[],category:'all',view:'all',query:'',visible:24,active:null};
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = v => String(v).normalize('NFKC').toLowerCase().replace(/[.\-_]/g,'');
let saved = new Set(), demoCleanup = null, threeCleanup = null, detailRevision = 0;
try {saved=new Set(JSON.parse(localStorage.getItem('frame.components.saved.v2')||'[]'));}catch{}
const featureCleanups = [];
let graphics;
const graphicReady = import('./graphics.js').then(module=>{graphics=module;return module;}).catch(error=>{
 console.warn('Graphics fallback:',error.message);
 // Content remains available even when the graphics module cannot load.
 $('#hero-fallback').hidden=false;$('#lab-fallback').hidden=false;
 const remaining=Math.max(0,5000-(performance.now()-pageStarted));
 setTimeout(()=>{document.body.classList.add('intro-reveal');$('#intro').classList.add('is-exiting');},Math.max(0,remaining-700));
 setTimeout(finishFallback,remaining);
 return null;
});
const pageStarted=performance.now();
function finishFallback(){document.body.classList.remove('intro-active','intro-reveal');$('#site-content').inert=false;$('#intro').hidden=true;}
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2300);}
function updateSaved(){ $('#saved-count').textContent=saved.size;document.querySelectorAll('[data-save]').forEach(button=>{const yes=saved.has(button.dataset.save);button.classList.toggle('is-saved',yes);button.setAttribute('aria-pressed',String(yes));const entry=state.entries.find(e=>e.id===button.dataset.save);button.setAttribute('aria-label',`${yes?'取消收藏':'收藏'} ${entry?.name||''}`);});if(state.active)$('#detail-save').textContent=saved.has(state.active.id)?'已收藏 · 取消 ♧':'收藏此样式 ♧';}
function toggleSaved(id){saved.has(id)?saved.delete(id):saved.add(id);try{localStorage.setItem('frame.components.saved.v2',JSON.stringify([...saved]));notify(saved.has(id)?'已加入本机收藏':'已取消收藏');}catch{notify('收藏保存在本次浏览中');}if(state.view==='saved')renderCatalog();updateSaved();}
function overview(){
 $('#total-count').textContent=state.entries.length;
 $('#category-map').innerHTML=categories.map((c,i)=>`<button class="category-tile" data-category="${c.id}" aria-label="查看${c.name}"><div class="category-top"><span>${String(i+1).padStart(2,'0')} / ${state.entries.filter(e=>e.category===c.id).length} STYLES</span><b>↗</b></div><h3>${c.name}</h3><p>${c.en}</p><small>${c.note}</small></button>`).join('');
 $('#category-filters').innerHTML='<button class="active" data-filter="all" aria-pressed="true">全部分类</button>'+categories.map(c=>`<button data-filter="${c.id}" aria-pressed="false">${c.name}</button>`).join('');
 const picks=['navigation','actions','content'].map(category=>state.entries.find(e=>e.category===category));
 $('#feature-showcase').innerHTML=picks.map((e,i)=>`<article class="featured-item"><div class="featured-demo" id="featured-demo-${i}"></div><div class="featured-footer"><div><strong>${escape(e.name)}</strong><p>${escape(e.en)}</p></div><button data-open="${e.id}" aria-label="打开${escape(e.name)}详情">↗</button></div></article>`).join('');
 picks.forEach((e,i)=>{const cleanup=mountDemo($(`#featured-demo-${i}`),e);if(typeof cleanup==='function')featureCleanups.push(cleanup);});
}
function filtered(){const words=normalize(state.query).trim().split(/\s+/).filter(Boolean);return state.entries.filter(e=>(state.category==='all'||e.category===state.category)&&(state.view==='all'||saved.has(e.id))&&words.every(word=>normalize([e.name,e.en,e.description,e.interaction,categoryMap[e.category].name,...e.tags].join(' ')).includes(word)));}
function interleave(entries){const buckets=categories.map(c=>entries.filter(e=>e.category===c.id));const result=[];let i=0;while(buckets.some(b=>b.length>i)){for(const b of buckets)if(b[i])result.push(b[i]);i++;}return result;}
function renderCatalog(){
 const entries=state.category==='all'&&state.view==='all'&&!state.query?interleave(filtered()):filtered();
 $('#result-count').textContent=`找到 ${entries.length} 种样式 · 当前显示 ${Math.min(state.visible,entries.length)} 种`;
 $('#empty-state').hidden=entries.length>0;$('#load-more').hidden=entries.length<=state.visible;
 $('#clear-filters').hidden=state.category==='all'&&state.view==='all'&&!state.query;
 $('#catalog-grid').innerHTML=entries.slice(0,state.visible).map(e=>`<article class="catalog-card"><button class="card-open" data-open="${e.id}" aria-label="体验${escape(e.name)}">${previewMarkup(e)}<div class="card-content"><div class="card-meta"><span>${categoryMap[e.category].name}</span><span>LIVE DEMO ↗</span></div><h3>${escape(e.name)}</h3><p class="card-en">${escape(e.en)}</p><p class="card-description">${escape(e.description)}</p></div></button><button class="card-save" data-save="${e.id}" aria-label="收藏 ${escape(e.name)}" aria-pressed="false">♧</button></article>`).join('');
 document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===state.category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 updateSaved();
}
function filter({category=state.category,view=state.view,query=state.query}={},scroll=false){state.category=category;state.view=view;state.query=query;state.visible=24;$('#search').value=query;renderCatalog();if(scroll)$('#library').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
function destroyDemo(){detailRevision++;if(typeof demoCleanup==='function')demoCleanup();if(typeof threeCleanup==='function')threeCleanup();demoCleanup=threeCleanup=null;}
async function renderDetailDemo(){destroyDemo();if(!state.active)return;const token=detailRevision,entry=state.active;$('#detail-preview').innerHTML='';demoCleanup=mountDemo($('#detail-preview'),entry);if(entry.category==='three'){const module=await graphicReady;if(token!==detailRevision||!$('#detail-dialog').open)return;if(module?.mountThreeDemo){const host=$('#detail-preview .three-detail-host')||$('#detail-preview .three-live-stage');if(host)threeCleanup=module.mountThreeDemo(host,entry);}}}
function openDetail(id){const e=state.entries.find(entry=>entry.id===id);if(!e)return;state.active=e;$('#detail-category').textContent=categoryMap[e.category].en+' / '+categoryMap[e.category].name;$('#detail-en').textContent=e.en;$('#detail-title').textContent=e.name;$('#detail-description').textContent=e.description;$('#detail-interaction').textContent='操作提示 / '+e.interaction;$('#detail-uses').innerHTML=e.useCases.map(v=>`<li>${escape(v)}</li>`).join('');$('#detail-tags').innerHTML=e.tags.map(v=>`<span>${escape(v)}</span>`).join('');$('#detail-related').innerHTML=e.related.map(id=>state.entries.find(x=>x.id===id)).filter(Boolean).map(r=>`<button data-open="${r.id}">${escape(r.name)} ↗</button>`).join('');$('#demo-size').value='wide';$('#detail-preview').classList.remove('narrow');if(!$('#detail-dialog').open)$('#detail-dialog').showModal();renderDetailDemo();updateSaved();}
function bind(){
 document.addEventListener('click',event=>{if(document.body.classList.contains('intro-active'))return;const labLink=event.target.closest('a[href="#lab"]');if(labLink&&labLink.closest('#detail-preview')){event.preventDefault();const variant=state.active?.variant;const scene=['fluid','bloom'].includes(variant)?'waves':['particles','instances','picking'].includes(variant)?'vortex':'aurora';document.dispatchEvent(new CustomEvent('frame:open-lab',{detail:{scene}}));return;}const b=event.target.closest('button');if(!b)return;if(b.dataset.open)openDetail(b.dataset.open);else if(b.dataset.save)toggleSaved(b.dataset.save);else if(b.dataset.category)filter({category:b.dataset.category,view:'all',query:''},true);else if(b.dataset.filter)filter({category:b.dataset.filter});else if(b.dataset.view)filter({view:b.dataset.view});});
 $('#search').addEventListener('input',event=>filter({query:event.target.value}));
 $('#saved-nav').addEventListener('click',()=>filter({category:'all',view:'saved',query:''},true));
 $('#three-patterns').addEventListener('click',()=>filter({category:'three',view:'all',query:''},true));
 $('#clear-filters').addEventListener('click',()=>filter({category:'all',view:'all',query:''}));$('#empty-reset').addEventListener('click',()=>filter({category:'all',view:'all',query:''}));
 $('#load-more').addEventListener('click',()=>{state.visible+=24;renderCatalog();});
 $('#detail-close').addEventListener('click',()=>$('#detail-dialog').close());
 $('#detail-dialog').addEventListener('close',()=>{destroyDemo();state.active=null;$('#detail-preview').innerHTML='';});
 $('#detail-dialog').addEventListener('click',event=>{if(event.target!==$('#detail-dialog'))return;const r=$('#detail-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#detail-dialog').close();});
 $('#detail-save').addEventListener('click',()=>{if(state.active)toggleSaved(state.active.id);});$('#demo-reset').addEventListener('click',renderDetailDemo);
 $('#demo-size').addEventListener('change',event=>$('#detail-preview').classList.toggle('narrow',event.target.value==='narrow'));
 $('#copy-name').addEventListener('click',async()=>{if(!state.active)return;try{await navigator.clipboard.writeText(`${state.active.name} / ${state.active.en}`);notify('已复制样式名称');}catch{notify('名称：'+state.active.en);}});
 document.addEventListener('keydown',event=>{if(document.body.classList.contains('intro-active')||$('#detail-dialog').open||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;if(event.key==='/'){event.preventDefault();$('#search').focus();}});
 // Details can offer a guided jump to the full Three.js gallery.
 document.addEventListener('frame:open-lab',event=>{if($('#detail-dialog').open)$('#detail-dialog').close();if(event.detail?.scene)window.dispatchEvent(new CustomEvent('frame:scene',{detail:{scene:event.detail.scene}}));$('#lab').scrollIntoView({behavior:'smooth'});});
}
async function init(){try{const response=await fetch('./catalog.json');if(!response.ok)throw Error('catalog HTTP'+response.status);state.entries=await response.json();if(!Array.isArray(state.entries)||state.entries.some(e=>!categoryMap[e.category]))throw Error('invalid catalog');saved=new Set([...saved].filter(id=>state.entries.some(e=>e.id===id)));overview();bind();renderCatalog();if(location.hash){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{}if(id)requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'instant'}));}}catch(error){$('#result-count').textContent='样式暂时未加载，请刷新页面重试。';console.error(error);}}
init();
