const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v).normalize('NFKC').toLowerCase().replace(/[\s.\-_]/g,'');
let catalog,universe,experimentModule,lab=null,active=null,currentLevel=null,searchRows=[],searchIndex=-1;
const planets=[],sectors=[],visited=new Set();
try{JSON.parse(localStorage.getItem('nebula.visited.v3')||'[]').forEach(id=>visited.add(id));}catch{}
const params=new URLSearchParams(location.search),seed=Number(params.get('seed'))||Math.floor(Math.random()*999999);
const initialCoordinate=decodeURIComponent(location.hash.slice(1));
const commands=[
{id:'random',name:'随机探索',en:'RANDOM WARP',note:'飞向尚未探索的技术行星',aliases:'随机跃迁随机randomwarp'},
{id:'tour',name:'星际漫游',en:'COSMIC JOURNEY',note:'沿精选轨迹穿过技术宇宙；操作即可自由探索',aliases:'漫游巡游带我漫游tour'},
{id:'wave',name:'释放引力波',en:'GRAVITY WAVE',note:'让一圈能量穿过星云 · W',aliases:'引力波波动wave'},
{id:'meteor',name:'流星雨',en:'METEOR SHOWER',note:'在当前空间生成一场流星雨 · M',aliases:'流星meteor'},
{id:'audio',name:'声音声场',en:'SPATIAL SOUND',note:'开启或关闭程序生成的环境声场',aliases:'声音音频audio音乐'},
{id:'capture',name:'保存作品',en:'CAPTURE THE COSMOS',note:'保存当前三维构图为 PNG',aliases:'保存构图作品壁纸截图capture'},
{id:'home',name:'回到总览',en:'RETURN TO THE GALAXY',note:'返回银河中心，重新选择方向',aliases:'首页返回总览home'},
{id:'help',name:'探索指南',en:'HOW TO EXPLORE',note:'查看鼠标、触摸和键盘动作',aliases:'帮助指引指南help'},
];
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);$('#live-status').textContent=text;}
function updateVisits(){for(const id of [...visited])if(!planets.some(p=>p.id===id))visited.delete(id);$('#visited-count').textContent=`${visited.size} / ${planets.length} 已探索`;try{localStorage.setItem('nebula.visited.v3',JSON.stringify([...visited]));}catch{}universe?.refreshLabels?.();}
function closeSearch(){searchRows=[];searchIndex=-1;$('#search-results').hidden=true;$('#search').setAttribute('aria-expanded','false');$('#search').removeAttribute('aria-activedescendant');}
function renderSearch(){
 const query=norm($('#search').value),results=[];
 const matchedCommands=commands.filter(c=>!query||norm(c.name+c.aliases+c.en).includes(query));
 if(query){
  for(const g of catalog.galaxies)if(norm(g.name+g.en+g.description).includes(query))results.push({type:'galaxy',id:g.id,name:g.name,note:g.en+' / 进入星系'});
  for(const s of sectors)if(norm(s.name+s.en).includes(query))results.push({type:'sector',id:s.id,name:s.name,note:s.galaxyName+' / 子星系'});
  for(const p of planets)if(norm([p.name,p.en,p.description,p.galaxyName,...p.tags].join('')).includes(query))results.push({type:'planet',id:p.id,name:p.name,note:p.galaxyName+' / '+p.sectorName+' / '+p.en});
 }else{
  for(const g of catalog.galaxies)results.push({type:'galaxy',id:g.id,name:g.name,note:g.en+' / 4 颗技术行星'});
 }
 searchRows=[...matchedCommands.map(c=>({type:'command',...c})),...results].slice(0,24);searchIndex=-1;
 $('#search-results').innerHTML='<div class="search-caption">'+(query?`找到 ${searchRows.length} 个坐标 / 指令`:'EXPLORE A WORLD / CHOOSE A DIRECTION')+'</div>'+searchRows.map((r,i)=>`<button class="search-result" role="option" id="search-option-${i}" data-search-index="${i}" aria-selected="false"><span>${r.type==='command'?'↗':r.type==='planet'?'◉':'✦'}</span><div><strong>${esc(r.name)}</strong><small>${esc(r.note)}</small></div><b>→</b></button>`).join('')+(searchRows.length?'':'<p class="search-empty">没有找到这个坐标。试试 AI、量子、光学或生成艺术。</p>');
 $('#search-results').hidden=false;$('#search').setAttribute('aria-expanded','true');
}
function moveSearch(delta){if(!searchRows.length)return;searchIndex=(searchIndex+delta+searchRows.length)%searchRows.length;document.querySelectorAll('[data-search-index]').forEach((b,i)=>{b.classList.toggle('selected',i===searchIndex);b.setAttribute('aria-selected',String(i===searchIndex));});$('#search').setAttribute('aria-activedescendant','search-option-'+searchIndex);$('#search-option-'+searchIndex).scrollIntoView({block:'nearest'});}
function chooseSearch(index){const row=searchRows[index];if(!row)return;closeSearch();$('#search').blur();if(row.type==='command')runCommand(row.id);else if(universe)universe.navigateTo(row.id);else if(row.type==='planet')openPlanet(row.id);else notify('请搜索并选择具体技术行星。');}
function renderLevel(info){
 currentLevel=info;$('#level-kicker').textContent=['01 / THE COSMIC ATLAS','02 / INSIDE A GALAXY','03 / THE ORBITAL LABORATORY'][Math.min(2,info.depth)]||'THE COSMIC ATLAS';
 $('#level-title').textContent=info.title;$('#level-note').textContent=info.description;
 const crumbs=[{id:'home',name:'银河总览'},...(info.path||[]).filter(n=>n.type!=='planet')];
 $('#breadcrumbs').innerHTML=crumbs.map((n,i)=>(i?'<span> / </span>':'')+`<button data-coordinate="${esc(n.id)}">${esc(n.name)}</button>`).join('');$('#back').hidden=info.depth===0;
 $('#universe-canvas').dataset.level=info.depth;$('#universe-canvas').dataset.coordinate=info.id||'home';
 if(!info.planet){closePlanet(false);history.replaceState(null,'',location.pathname+location.search+(info.id&&info.id!=='home'?'#'+info.id:''));}
}
function closePlanet(returnToSector=false){lab?.dispose?.();lab=null;active=null;$('#experiment-host').innerHTML='';$('#planet-sheet').hidden=true;document.body.classList.remove('planet-open');if(returnToSector)universe?.back();}
async function openPlanet(id){
 const entry=planets.find(p=>p.id===id);if(!entry)return;
 lab?.dispose?.();lab=null;active=entry;
 $('#planet-kind').textContent={runtime:'实际计算',simulation:'原理模拟',research:'研究可视化'}[entry.kind]||'原理实验';$('#planet-index').textContent=String(planets.indexOf(entry)+1).padStart(2,'0')+' / '+planets.length;
 $('#planet-en').textContent=entry.en;$('#planet-title').textContent=entry.name;$('#planet-description').textContent=entry.description;
 const source=entry.source;$('#planet-source').textContent=source.title+' ↗';$('#planet-source').href=/^https:\/\//.test(source.url)?source.url:'#';$('#source-date').textContent=catalog.updated;
 $('#planet-related').innerHTML=entry.related.map(id=>planets.find(p=>p.id===id)).filter(Boolean).map(p=>`<button data-coordinate="${p.id}">${esc(p.name)} ↗</button>`).join('');
 $('#experiment-host').innerHTML='';$('#planet-sheet').hidden=false;document.body.classList.add('planet-open');
 if(!experimentModule)experimentModule=await import('./src/experiments.js?v=20261001-r5');
 if(active?.id!==entry.id)return;
 lab=experimentModule.mountExperiment($('#experiment-host'),entry,{onParameter:(key,value)=>{const c=entry.controls.find(c=>c.key===key);const normalized=c?(Number(value)-c.min)/(c.max-c.min):Number(value);universe?.setParameter(entry.id,key,Math.max(0,Math.min(1,normalized)));},onAction:(action,value)=>{universe?.command('model-wave');$('#universe-canvas').dataset.lastAction=action;}});
 visited.add(id);updateVisits();$('#planet-sheet').scrollTop=0;history.replaceState(null,'',location.pathname+location.search+'#'+id);$('#live-status').textContent=entry.name+'，'+entry.description;
}
function share(){const id=active?.id||currentLevel?.id||'home';const url=new URL(location.href);url.searchParams.set('seed',String(seed));url.hash=id==='home'?'':id;$('#coordinate-url').value=url.href;$('#coordinate-dialog').showModal();}
async function copyCoordinate(){try{if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText($('#coordinate-url').value);notify('星际坐标已复制。');}catch{notify('请选中坐标地址直接复制。');}}
function capture(){const result=universe?.capture();if(!result){notify('当前设备暂时无法保存构图。');return;}const a=document.createElement('a');a.href=typeof result==='string'?result:result.dataUrl;a.download=`NEBULA-${seed}-${active?.id||currentLevel?.id||'galaxy'}.png`;const canvas=$('#universe-canvas');canvas.dataset.captureFormat=a.href.slice(0,30);canvas.dataset.captureBytes=String(Math.floor((a.href.length-a.href.indexOf(',')-1)*.75));canvas.dataset.captureSize=canvas.width+'×'+canvas.height;document.body.append(a);a.click();a.remove();notify('PNG 构图已生成，正在下载。');}
function runCommand(id){
 if(id==='random'){const unknown=planets.filter(p=>!visited.has(p.id));const candidates=unknown.length?unknown:planets;const p=candidates[Math.floor(Math.random()*candidates.length)];universe?.navigateTo(p.id);notify('跃迁坐标 / '+p.name);}
 else if(id==='home')universe?.navigateTo('home');else if(id==='help')$('#help-dialog').showModal();else if(id==='capture')capture();else{const result=universe?.command(id);if(id==='audio')notify(result?'声场已开启。':'声场已关闭。');else if(id==='tour')notify('漫游开始，拖动或选择即可自由探索。');else if(id==='meteor')notify('一场流星雨正在经过。');else if(id==='wave')notify('引力波正在穿过星云。');}
}
function bind(){
 $('#search').addEventListener('focus',renderSearch);$('#search').addEventListener('input',renderSearch);
 $('#search').addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();moveSearch(e.key==='ArrowDown'?1:-1);}else if(e.key==='Enter'){e.preventDefault();chooseSearch(searchIndex<0?0:searchIndex);}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSearch();$('#search').blur();}});
 $('#search-results').addEventListener('click',e=>{const b=e.target.closest('[data-search-index]');if(b)chooseSearch(Number(b.dataset.searchIndex));});
 document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))closeSearch();const b=e.target.closest('button[data-coordinate]');if(b)universe?.navigateTo(b.dataset.coordinate);const action=e.target.closest('[data-model-action]');if(action){universe?.command('model-'+action.dataset.modelAction);notify({burst:'结构正在展开并重新汇合。',spin:'雕塑开始旋转跃动。',wave:'能量正在沿着结构传递。'}[action.dataset.modelAction]);}});
 $('#brand').addEventListener('click',e=>{e.preventDefault();universe?.navigateTo('home');});$('#back').addEventListener('click',()=>universe?.back());$('#sheet-close').addEventListener('click',()=>closePlanet(true));
 $('#random-warp').addEventListener('click',()=>runCommand('random'));$('#help-open').addEventListener('click',()=>runCommand('help'));$('#help-close').addEventListener('click',()=>$('#help-dialog').close());
 $('#share-coordinate').addEventListener('click',share);$('#coordinate-close').addEventListener('click',()=>$('#coordinate-dialog').close());$('#coordinate-copy').addEventListener('click',copyCoordinate);$('#save-art').addEventListener('click',capture);
 document.addEventListener('keydown',e=>{if(document.body.classList.contains('intro-active')||$('#help-dialog').open||$('#coordinate-dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='/'){e.preventDefault();$('#search').focus();}else if(e.key==='Escape'){e.preventDefault();universe?.back();}else if(e.code==='Space'){e.preventDefault();runCommand('random');}else if(e.key.toLowerCase()==='w')runCommand('wave');else if(e.key.toLowerCase()==='m')runCommand('meteor');else if(e.key.toLowerCase()==='r')universe?.command('reset');else if(e.key.toLowerCase()==='x')universe?.command('model-burst');});
}
function finishIntro(){document.body.classList.remove('intro-active','intro-reveal');$('#site-ui').inert=false;$('#intro').hidden=true;if(initialCoordinate&&initialCoordinate!=='home'){if(universe)universe.navigateTo(initialCoordinate);else openPlanet(initialCoordinate);}}
async function init(){
 try{
  const response=await fetch('./catalog.json');if(!response.ok)throw Error('Catalog HTTP '+response.status);catalog=await response.json();if(catalog.version!==3)throw Error('Catalog version');
  for(const g of catalog.galaxies)for(const s of g.sectors){sectors.push({...s,galaxyId:g.id,galaxyName:g.name,theme:g.theme,type:'sector'});for(const p of s.planets)planets.push({...p,galaxyId:g.id,galaxyName:g.name,sectorId:s.id,sectorName:s.name,theme:g.theme,type:'planet'});}
  updateVisits();bind();const graphics=await import('./graphics.js?v=20261001-r5');universe=graphics.initUniverse({catalog,seed,visited,onNavigate:renderLevel,onSelect:openPlanet,onHover:node=>{$('#hover-card').hidden=!node;if(node)$('#hover-card').textContent=node.description;},onReady:()=>{$('#universe-canvas').dataset.ready='true';},onIntroFinished:finishIntro});
 }catch(error){console.error('Universe setup:',error);$('#fallback').hidden=false;let start=performance.now();$('#intro').dataset.clockSource='fallback';$('#intro').dataset.duration='5000';const frame=()=>{const elapsed=performance.now()-start,p=Math.min(1,elapsed/5000);$('#intro-progress').textContent=Math.round(p*100)+'%';$('#intro').style.setProperty('--progress',p);if(elapsed>=4300){document.body.classList.add('intro-reveal');$('#intro').classList.add('is-exiting');}if(elapsed<5000)requestAnimationFrame(frame);else{$('#intro').dataset.elapsed=elapsed.toFixed(2);finishIntro();}};requestAnimationFrame(frame);}
}
init();
