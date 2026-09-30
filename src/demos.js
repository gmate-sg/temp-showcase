const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art = (i=0, extra='') => '<div class="spec-art '+extra+'" data-art="'+(i%4)+'" role="img" aria-label="抽象示例画面"><i></i><b></b><em></em></div>';
const btn = (action, text, cls='') => '<button type="button" class="spec-button '+cls+'" data-action="'+esc(action)+'">'+text+'</button>';
const items = ['Atlas','Studio','Motion','Canvas','Gallery'];
const chips = (names,action,selected=0) => names.map((n,i)=>'<button type="button" class="spec-chip '+(i===selected?'selected':'')+'" data-action="'+action+'" data-index="'+i+'" aria-pressed="'+(i===selected)+'">'+esc(n)+'</button>').join('');
const report = '<p class="demo-result" role="status" aria-live="polite">在这里操作，结果会即时显示。</p>';
const shell = (content) => '<div class="spec-workspace">'+content+'</div>'+report;
const heading = (text) => '<div class="spec-heading">'+esc(text)+'</div>';
const input = (label,type='text',props='') => '<label class="spec-field"><span>'+esc(label)+'</span><input type="'+type+'" '+props+'></label>';

export function previewMarkup(entry) {
  const labels={navigation:'INDEX / MENU',layout:'GRID / SPACE',actions:'MAKE IT HAPPEN',forms:'YOUR INPUT',content:'CONTENT / 01',feedback:'STATUS / READY',overlays:'OPEN / CLOSE',media:'VIEW / IMAGE',motion:'MOVE / FEEL',three:'LIVE / THREE.JS'};
  const family = Object.hasOwn(labels,entry.demo) ? entry.demo : 'content';
  return '<div class="mini-preview mini-'+family+'" data-variant="'+esc(entry.variant)+'" aria-hidden="true"><span class="mini-kicker">'+labels[family]+'</span><div class="mini-spec"><i></i><b></b><em></em><span></span></div><span class="mini-caption">'+esc(entry.en)+'</span></div>';
}

export function mountDemo(container,entry) {
  let active=true; const releases=[]; const timers=new Set(); const frames=new Set();
  const html = templates[entry.demo]?.(entry.variant) || shell(btn('sample','操作示例'));
  container.innerHTML='<div class="demo-stage family-'+esc(entry.demo)+'" data-variant="'+esc(entry.variant)+'">'+html+'</div>';
  const stage=container.querySelector('.demo-stage');
  const q=s=>stage.querySelector(s), qa=s=>[...stage.querySelectorAll(s)];
  const on=(target,event,fn,opts)=>{target?.addEventListener(event,fn,opts);releases.push(()=>target?.removeEventListener(event,fn,opts));};
  const delay=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(active)fn();},ms);timers.add(id);return id;};
  const frame=fn=>{const id=requestAnimationFrame(t=>{frames.delete(id);if(active)fn(t);});frames.add(id);return id;};
  const result=text=>{const node=q('.demo-result');if(node)node.textContent=text;};
  const select=(action,index)=>qa('[data-action="'+action+'"]').forEach((el,i)=>{el.classList.toggle('selected',i===index);if(el.getAttribute('role')==='tab'){el.setAttribute('aria-selected',String(i===index));el.tabIndex=i===index?0:-1;}else el.setAttribute('aria-pressed',String(i===index));});
  const updateArt=(index)=>{const node=q('.spec-main-art');if(node)node.innerHTML=art(index);};
  let index=0, step=0, count=1, loading=false, playing=false, speed=1, muted=false;
  if(entry.demo==='navigation'&&entry.variant==='tabs')select('nav',0);
  const eventHandler=(e)=>{
    const control=e.target.closest('[data-action]'); if(!control||!stage.contains(control))return;
    const action=control.dataset.action, value=Number(control.dataset.index)||0, variant=entry.variant;
    if(action==='sample')result('已完成本地操作。');
    if(entry.demo==='navigation'){
      if(action==='nav'){select(action,value);q('.spec-view').textContent=['精选作品','设计工具','最新项目','个人资料','帮助中心'][value%5];result('当前栏目：'+control.textContent);}
      if(action==='collapse'){q('.spec-sidebar').classList.toggle('compact');control.setAttribute('aria-expanded',String(!q('.spec-sidebar').classList.contains('compact')));}
      if(action==='menu'){q('.spec-menu').hidden=!q('.spec-menu').hidden;control.setAttribute('aria-expanded',String(!q('.spec-menu').hidden));}
      if(action==='mega-item'){q('.spec-menu').hidden=true;result('打开分组：'+control.textContent);}
      if(action==='crumb'){qa('[data-action="crumb"]').forEach((el,i)=>{el.hidden=i>value;});q('.spec-view').textContent=['全部项目','作品目录','视觉设计','本次项目'][value];result('当前路径：'+q('.spec-view').textContent);}
      if(action==='restore-crumb')qa('[data-action="crumb"]').forEach(el=>el.hidden=false);
      if(action==='command'){q('.spec-view').textContent='已执行：'+control.textContent;result('本地命令已执行。');}
    }
    if(entry.demo==='layout'){
      if(action==='hero-topic'){select(action,value);q('.hero-headline').textContent=['为想法找到形态。','让界面开始表达。','把互动变成体验。'][value];q('.hero-visual').innerHTML=art(value);result('首屏主题：'+control.textContent);}
      if(action==='hero-start')result('你已选择开始了解这个演示项目。');
      if(action==='footer-theme'){const dark=q('.spec-footer').classList.toggle('light');control.setAttribute('aria-pressed',String(dark));result('页脚已切换为'+(dark?'浅色':'深色')+'。');}
      if(action==='footer-link')result('本地页脚入口：'+control.textContent);
      if(action==='cta-action'){control.textContent='已加入演示清单 ✓';q('.cta-copy').textContent='下一步已经准备好，感谢体验。';q('.spec-cta').classList.add('complete');result('本地行动号召已完成。');}
      if(action==='feature-tab'){select(action,value);q('.feature-title').textContent=['清晰组织每个模块','让细节自然响应','在不同屏幕保持秩序'][value];q('.feature-copy').textContent=['将内容分成有标题、有层级的可复用区域。','用状态反馈说明点击、选择和完成的结果。','根据可用空间调整列数、间距与内容顺序。'][value];q('.feature-visual').innerHTML=art(value);result('当前功能：'+control.textContent);}
      if(action==='bento'){qa('.bento-tile').forEach(el=>el.classList.remove('featured'));control.classList.add('featured');result('重点模块：'+control.textContent);}
      if(action==='add-masonry'){q('.spec-masonry').insertAdjacentHTML('beforeend','<button class="masonry-tile" data-action="masonry" style="--tile-h:'+(70+(count++%3)*35)+'px">新项目 '+count+'</button>');result('已添加不同高度的卡片。');}
      if(action==='masonry'){control.classList.toggle('selected');result('已选择：'+control.textContent);}
      if(action==='panel-prev'||action==='panel-next'){q('.spec-horizontal').scrollBy({left:(action==='panel-next'?1:-1)*q('.spec-horizontal').clientWidth*.84,behavior:'smooth'});}
      if(action==='next-stack'){index=(index+1)%3;qa('.stack-card').forEach((el,i)=>el.style.setProperty('--stack-order',(i-index+3)%3));result('当前卡片：'+(index+1));}
      if(action==='master'){select(action,value);q('.master-detail').innerHTML=heading(items[value])+'<p>'+['设计研究与结构整理。','排版、颜色与组件制作。','微交互、动画与转场。'][value]+'</p>'+art(value);result('已选择 '+items[value]);}
      if(action==='chapter'){q('.sticky-content').querySelectorAll('section')[value].scrollIntoView({block:'start',behavior:'smooth'});select(action,value);}
    }
    if(entry.demo==='actions'){
      if(action==='primary'){control.classList.add('is-success');control.textContent='已完成 ✓';result('主要操作已完成。');delay(()=>{control.classList.remove('is-success');control.textContent='立即开始 ↗';},1500);}
      if(action==='outline'){control.classList.toggle('selected');control.setAttribute('aria-pressed',String(control.classList.contains('selected')));result(control.classList.contains('selected')?'已选择这个方案。':'已取消选择。');}
      if(action==='favorite'){const yes=control.getAttribute('aria-pressed')!=='true';control.setAttribute('aria-pressed',String(yes));control.textContent=yes?'♥':'♡';result(yes?'已收藏这个示例。':'已取消收藏。');}
      if(action==='share'){result('分享内容：FRAME / 本地演示');}
      if(action==='split-open'){q('.split-options').hidden=!q('.split-options').hidden;control.setAttribute('aria-expanded',String(!q('.split-options').hidden));}
      if(action==='format'){q('.split-main').textContent='导出 '+control.textContent;q('.split-options').hidden=true;result('格式已切换为 '+control.textContent);}
      if(action==='export')result(q('.split-main').textContent+'：本地演示完成。');
      if(action==='toggle'){const yes=control.getAttribute('aria-pressed')!=='true';control.setAttribute('aria-pressed',String(yes));control.classList.toggle('selected',yes);q('.toggle-preview').classList.toggle('is-bold',yes);result(yes?'加粗已启用。':'加粗已关闭。');}
      if(action==='segment'){select(action,value);q('.segment-value').textContent=['128','896','3,840'][value];qa('.spec-bar').forEach((el,i)=>el.style.setProperty('--bar',((i*19+value*31)%70+25)+'%'));result('显示'+control.textContent+'数据。');}
      if(action==='fab'){q('.fab-options').hidden=!q('.fab-options').hidden;control.setAttribute('aria-expanded',String(!q('.fab-options').hidden));control.classList.toggle('expanded');}
      if(action==='fab-choice'){q('.fab-options').hidden=true;q('[data-action="fab"]').classList.remove('expanded');result('已选择：'+control.textContent);}
      if(action==='magnetic'){control.classList.remove('pulsing');void control.offsetWidth;control.classList.add('pulsing');result('点击反馈已触发。');}
    }
    if(entry.demo==='forms'){
      if(action==='search-choice'){q('.search-summary').textContent='已选择 '+control.textContent;result('已选择 '+control.textContent);}
      if(action==='combo-open'){q('.combo-options').hidden=!q('.combo-options').hidden;}
      if(action==='combo-choice'){q('.combo-input').value=control.textContent;q('.combo-options').hidden=true;result('已选择 '+control.textContent);}
      if(action==='minus'||action==='plus'){const node=q('.quantity-input');node.value=Math.max(1,Math.min(9,Number(node.value)+(action==='plus'?1:-1)));node.dispatchEvent(new Event('input',{bubbles:true}));}
    }
    if(entry.demo==='content'){
      if(action==='quote-prev'||action==='quote-next'){index=(index+(action==='quote-next'?1:2))%3;q('.testimonial-quote').textContent=['模块之间的层级很清晰，我们能快速找到需要的信息。','细节操作有明确反馈，展示过程也更容易理解。','内容可以在电脑和手机上自然阅读，团队交流更方便。'][index];q('.testimonial-author').textContent=['陈 / 设计师','林 / 项目负责人','周 / 内容编辑'][index]+' · 示例评价';q('.quote-counter').textContent=(index+1)+' / 3';result('当前第 '+(index+1)+' 条示例评价。');}
      if(action==='page'||action==='page-prev'||action==='page-next'){index=action==='page'?value:Math.max(0,Math.min(2,index+(action==='page-next'?1:-1)));qa('[data-action="page"]').forEach((el,i)=>{el.classList.toggle('selected',i===index);if(i===index)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});q('[data-action="page-prev"]').disabled=index===0;q('[data-action="page-next"]').disabled=index===2;q('.pagination-list').innerHTML=[1,2,3].map(n=>'<li><span>0'+(index*3+n)+'</span><strong>'+['结构研究','视觉设计','交互记录'][n-1]+'</strong><small>第 '+(index+1)+' 页</small></li>').join('');result('当前第 '+(index+1)+' 页，共 3 页。');}
      if(action==='cart'){count++;q('.cart-count').textContent=count-1;result('已加入本地演示清单。');}
      if(action==='favorite'){const yes=control.getAttribute('aria-pressed')!=='true';control.setAttribute('aria-pressed',String(yes));control.textContent=yes?'♥':'♡';result(yes?'已收藏。':'已取消收藏。');}
      if(action==='follow'){const yes=control.getAttribute('aria-pressed')!=='true';control.setAttribute('aria-pressed',String(yes));control.textContent=yes?'已关注 ✓':'关注 +';result(yes?'已关注设计师。':'已取消关注。');}
      if(action==='stats'){select(action,value);q('.stat-number').textContent=['12,840','38,520','154,080'][value];qa('.spec-bar').forEach((el,i)=>el.style.setProperty('--bar',(25+(i*17+value*21)%70)+'%'));result('统计周期：'+control.textContent);}
      if(action==='billing'){select(action,value);qa('.price-number').forEach((el,i)=>el.textContent=(value?19:29)*(i+1));result(value?'按年计费，显示月均金额。':'按月计费。');}
      if(action==='plan'){qa('.pricing-card').forEach(el=>el.classList.remove('selected'));control.closest('.pricing-card').classList.add('selected');result('已选择 '+control.dataset.plan);}
      if(action==='tree-file')result('当前路径：作品 / '+control.textContent);
      if(action==='timeline'){select(action,value);q('.timeline-info').textContent=['研究方向与收集案例','完成视觉组件与交互','整体验证与上线发布'][value];}
      if(action==='sort'){const key=control.dataset.key;control.dataset.reverse=control.dataset.reverse==='true'?'false':'true';const rows=qa('tbody tr').sort((a,b)=>key==='amount'?Number(a.dataset.amount)-Number(b.dataset.amount):a.dataset.name.localeCompare(b.dataset.name));if(control.dataset.reverse==='true')rows.reverse();rows.forEach(el=>q('tbody').append(el));result('已按'+control.textContent+'排序。');}
    }
    if(entry.demo==='feedback'){
      if(action==='toast'){q('.spec-toast').classList.add('show');result('演示保存成功。');delay(()=>q('.spec-toast')?.classList.remove('show'),1800);}
      if(action==='banner-close'){q('.spec-banner').hidden=true;result('消息已关闭。');}
      if(action==='banner-reset'){q('.spec-banner').hidden=false;}
      if(action==='severity'){select(action,value);q('.spec-banner').dataset.level=value;q('.banner-copy').textContent=['今天有新的设计内容。','请完成本地演示设置。','这个示例需要重新检查。'][value];}
      if(action==='progress'&&!loading){loading=true;step=0;control.disabled=true;const advance=()=>{step=Math.min(100,step+10);q('progress').value=step;q('.progress-value').textContent=step+'%';if(step<100)delay(advance,110);else{loading=false;control.disabled=false;result('本地模拟任务完成。');}};advance();}
      if(action==='step-next'||action==='step-prev'){step=Math.max(0,Math.min(2,step+(action==='step-next'?1:-1)));qa('.step-node').forEach((el,i)=>{el.classList.toggle('current',i===step);el.classList.toggle('complete',i<step);});q('.step-copy').textContent=['填写基本信息','检查已填写内容','准备完成演示'][step];result('当前第 '+(step+1)+' 步。');}
      if(action==='skeleton'){q('.skeleton-card').classList.add('loading');q('.loaded-copy').hidden=true;delay(()=>{q('.skeleton-card')?.classList.remove('loading');if(q('.loaded-copy'))q('.loaded-copy').hidden=false;result('内容已加载。');},1200);}
      if(action==='badge'){index=(index+1)%3;q('.spec-badge').dataset.state=index;q('.spec-badge').textContent=['● 准备就绪','◐ 处理中','✓ 已完成'][index];result('当前状态：'+q('.spec-badge').textContent);}
      if(action==='empty-add'){q('.empty-content').innerHTML='<div class="created-card">项目 01 '+btn('empty-remove','删除演示项目')+'</div>';result('已创建一个演示项目。');}
      if(action==='empty-remove'){q('.empty-content').innerHTML=emptyMarkup();result('当前没有项目。');}
      if(action==='loading-button'&&!loading){loading=true;control.disabled=true;control.innerHTML='<span class="spec-spinner"></span> 提交中';delay(()=>{loading=false;control.disabled=false;control.innerHTML='已完成 ✓';result('本地模拟提交成功。');},1300);}
    }
    if(entry.demo==='overlays'){
      if(action==='open-dialog'){q('dialog').showModal();result('对话框已打开。');}
      if(action==='close-dialog')q('dialog').close();
      if(action==='confirm-dialog'){q('dialog').close();if(variant==='confirm'){q('.deletable').hidden=true;result('演示项目已删除。');}else result('设置已确认。');}
      if(action==='restore-delete'){q('.deletable').hidden=false;result('演示项目已恢复。');}
      if(action==='open-panel'){q('.overlay-panel').hidden=false;q('.panel-shade').hidden=false;control.setAttribute('aria-expanded','true');q('.overlay-panel button')?.focus();}
      if(action==='close-panel'){q('.overlay-panel').hidden=true;q('.panel-shade').hidden=true;q('[data-action="open-panel"]')?.focus();result('面板已关闭。');}
      if(action==='popover'){q('.spec-popover').hidden=!q('.spec-popover').hidden;control.setAttribute('aria-expanded',String(!q('.spec-popover').hidden));}
      if(action==='drop-open'){q('.spec-dropdown').hidden=!q('.spec-dropdown').hidden;control.setAttribute('aria-expanded',String(!q('.spec-dropdown').hidden));}
      if(action==='overlay-choice'){result('已选择：'+control.textContent);q('.spec-dropdown')?.setAttribute('hidden','');q('.overlay-panel')?.setAttribute('hidden','');q('.panel-shade')?.setAttribute('hidden','');q('.context-menu')?.setAttribute('hidden','');}
      if(action==='context-open'){q('.context-menu').hidden=false;}
      if(action==='tooltip-act')result('信息按钮已经执行。');
      if(action==='drawer-add'){count++;q('.drawer-count').textContent=count;result('清单中有 '+count+' 件。');}
    }
    if(entry.demo==='media'){
      if(action==='media-prev'||action==='media-next'||action==='media-index'){index=action==='media-index'?value:(index+(action==='media-next'?1:3))%4;updateArt(index);select('media-index',index);result('当前第 '+(index+1)+' 张抽象示例画面。');}
      if(action==='lightbox'){index=value;q('.lightbox-art').innerHTML=art(index);q('dialog').showModal();}
      if(action==='lightbox-close')q('dialog').close();
      if(action==='lightbox-prev'||action==='lightbox-next'){index=(index+(action==='lightbox-next'?1:3))%4;q('.lightbox-art').innerHTML=art(index);}
      if(action==='zoom'){q('.zoom-target').classList.toggle('zoomed');control.setAttribute('aria-pressed',String(q('.zoom-target').classList.contains('zoomed')));result('已切换放大状态。');}
      if(action==='hotspot'){select(action,value);q('.hotspot-copy').textContent=['外轮廓：定义整体结构。','色块：突出视觉重点。','层叠：表达前后关系。'][value];}
      if(action==='video'){playing=!playing;control.textContent=playing?'暂停模拟':'播放模拟';control.setAttribute('aria-pressed',String(playing));q('.video-art').classList.toggle('running',playing);result(playing?'本地模拟时钟正在前进。':'本地模拟时钟已停下。');}
      if(action==='mute'){muted=!muted;control.textContent=muted?'静音 ✓':'声音示意';control.setAttribute('aria-pressed',String(muted));result('此演示没有真实音轨。');}
      if(action==='flip'){q('.flip-card').classList.toggle('flipped');result(q('.flip-card').classList.contains('flipped')?'显示卡片背面。':'显示卡片正面。');}
    }
    if(entry.demo==='motion'){
      if(action==='tilt'){index=(index+1)%3;q('.tilt-target').style.transform=['rotateX(0) rotateY(0)','rotateX(12deg) rotateY(-15deg)','rotateX(-12deg) rotateY(15deg)'][index];}
      if(action==='marquee-direction'){q('.marquee-track').classList.toggle('reverse');result('滚动方向已切换。');}
      if(action==='marquee-speed'){speed=speed===1?2:1;q('.marquee-track').style.animationDuration=(speed===1?18:9)+'s';result('速度：'+speed+'×');}
      if(action==='spring'){q('.spring-dot').style.transform='translate(90px,-45px)';delay(()=>q('.spring-dot').style.transform='translate(0,0)',120);result('已触发弹簧回弹。');}
      if(action==='stagger'){index=(index+1)%3;qa('.stagger-cell').forEach((el,i)=>{el.classList.remove('entered');el.style.transitionDelay=(index===0?i:index===1?8-i:Math.abs(i-4))*50+'ms';});frame(()=>frame(()=>qa('.stagger-cell').forEach(el=>el.classList.add('entered'))));result('入场顺序：'+['顺序','逆序','从中心'][index]);}
      if(action==='morph'){select(action,value);q('.morph-shape').dataset.shape=value;result('形态：'+control.textContent);}
      if(action==='trail-burst'){for(let i=0;i<16;i++)delay(()=>spawnTrail(80+i*10,90+Math.sin(i)*30),i*25);result('已生成一次轨迹。');}
    }
  };
  on(stage,'click',eventHandler);
  on(stage,'input',e=>{
    const t=e.target,variant=entry.variant;
    if(entry.demo==='navigation'&&variant==='command')qa('[data-action="command"]').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(t.value.toLowerCase()));
    if(entry.demo==='layout'){
      if(variant==='split'){q('.split-left').style.flexBasis=t.value+'%';q('.split-right').style.flexBasis=(100-t.value)+'%';result('左侧 '+t.value+'% / 右侧 '+(100-t.value)+'%');}
      if(variant==='grid'){q('.responsive-demo').style.width=t.value+'%';result('容器宽度：'+t.value+'%');}
    }
    if(entry.demo==='forms'){
      if(variant==='floating')result(t.value?'输入值：'+t.value:'等待输入。');
      if(variant==='search')qa('[data-action="search-choice"]').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(t.value.toLowerCase()));
      if(variant==='checkbox')result('已选择：'+qa('input:checked').map(el=>el.value).join('、'));
      if(variant==='radio-cards'){qa('.radio-card').forEach(el=>el.classList.toggle('selected',el.querySelector('input').checked));result('已选择：'+t.value);}
      if(variant==='switch'){q('.switch-preview').classList.toggle('on',t.checked);result(t.checked?'增强显示已开启。':'增强显示已关闭。');}
      if(variant==='combobox'){q('.combo-options').hidden=false;qa('[data-action="combo-choice"]').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(t.value.toLowerCase()));}
      if(variant==='stepper'){const value=Math.max(1,Math.min(9,Number(t.value)||1));q('.quantity-total').textContent='合计 ¥'+value*28;}
    }
    if(entry.demo==='content'&&variant==='table')result('已选择 '+qa('tbody input:checked').length+' 条。');
    if(entry.demo==='overlays'&&variant==='popover'){q('.popover-preview').style.fontSize=t.value+'px';result('预览字号：'+t.value+'px');}
    if(entry.demo==='media'&&variant==='compare'){q('.compare-after').style.clipPath='inset(0 '+(100-t.value)+'% 0 0)';q('.compare-line').style.left=t.value+'%';result('对比位置：'+t.value+'%');}
    if(entry.demo==='media'&&variant==='video-controls'){step=Number(t.value);q('.video-time').textContent='00:'+String(step).padStart(2,'0')+' / 00:60';}
    if(entry.demo==='motion'&&variant==='parallax')moveParallax(Number(t.value)/100-.5);
  });
  on(stage,'submit',e=>{e.preventDefault();const field=q('input[type=email]');const valid=field&&field.value.trim()&&field.validity.valid;if(field)field.setAttribute('aria-invalid',String(!valid));q('.validation-message').textContent=valid?'邮箱格式正确，本地提交成功。':'请输入有效邮箱，例如 hello@example.com。';q('.validation-message').classList.toggle('valid',Boolean(valid));result(valid?'本地表单演示完成。':'校验未通过，请检查邮箱。');});
  on(stage,'keydown',e=>{
    if(e.key==='Escape'){q('.overlay-panel')?.setAttribute('hidden','');q('.panel-shade')?.setAttribute('hidden','');q('.spec-dropdown')?.setAttribute('hidden','');q('.spec-popover')?.setAttribute('hidden','');q('.context-menu')?.setAttribute('hidden','');}
    if(entry.demo==='navigation'&&entry.variant==='tabs'&&['ArrowLeft','ArrowRight'].includes(e.key)){const tabs=qa('[data-action="nav"]');const i=tabs.indexOf(e.target);if(i>=0){e.preventDefault();const n=(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[n].click();tabs[n].focus();}}
  });
  const moveParallax=n=>qa('.parallax-layer').forEach((el,i)=>el.style.transform='translateX('+(n*(i+1)*38)+'px) translateY('+(n*(i+1)*-12)+'px)');
  const spawnTrail=(x,y)=>{const area=q('.trail-area');if(!area)return;const el=document.createElement('i');el.className='trail-particle';el.style.left=x+'px';el.style.top=y+'px';area.append(el);delay(()=>el.remove(),650);};
  if(entry.demo==='actions'&&entry.variant==='magnetic'){const target=q('[data-action="magnetic"]');on(target,'pointermove',e=>{const r=target.getBoundingClientRect();target.style.transform='translate('+(e.clientX-r.left-r.width/2)*.18+'px,'+(e.clientY-r.top-r.height/2)*.18+'px)';});on(target,'pointerleave',()=>target.style.transform='');}
  if(entry.demo==='overlays'&&entry.variant==='context')on(q('.context-target'),'contextmenu',e=>{e.preventDefault();q('.context-menu').hidden=false;result('上下文菜单已打开。');});
  if(entry.demo==='media'&&entry.variant==='zoom'){const target=q('.zoom-target');on(target,'pointermove',e=>{const r=target.getBoundingClientRect();q('.zoom-target .spec-art').style.transformOrigin=(e.clientX-r.left)/r.width*100+'% '+(e.clientY-r.top)/r.height*100+'%';});}
  if(entry.demo==='media'&&entry.variant==='video-controls'){const tick=()=>{if(playing){step=(step+1)%61;q('.video-range').value=step;q('.video-time').textContent='00:'+String(step).padStart(2,'0')+' / 00:60';}delay(tick,1000);};delay(tick,1000);}
  if(entry.demo==='motion'&&['parallax','tilt','trail'].includes(entry.variant)){
    const area=q('.motion-area');
    on(area,'pointermove',e=>{const r=area.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;if(entry.variant==='parallax')moveParallax(x/r.width-.5);if(entry.variant==='tilt')q('.tilt-target').style.transform='rotateX('+((.5-y/r.height)*25)+'deg) rotateY('+((x/r.width-.5)*30)+'deg)';if(entry.variant==='trail')spawnTrail(x,y);});
    on(area,'pointerleave',()=>{if(entry.variant==='tilt')q('.tilt-target').style.transform='';});
  }
  if(entry.demo==='motion'&&entry.variant==='spring'){
    const area=q('.spring-area'),dot=q('.spring-dot');let dragging=false,startX=0,startY=0;
    on(dot,'pointerdown',e=>{dragging=true;startX=e.clientX;startY=e.clientY;dot.setPointerCapture(e.pointerId);dot.classList.add('dragging');});
    on(dot,'pointermove',e=>{if(dragging)dot.style.transform='translate('+Math.max(-130,Math.min(130,e.clientX-startX))+'px,'+Math.max(-80,Math.min(80,e.clientY-startY))+'px)';});
    const finish=()=>{dragging=false;dot.classList.remove('dragging');dot.style.transform='translate(0,0)';};on(dot,'pointerup',finish);on(dot,'pointercancel',finish);
  }
  if(entry.demo==='motion'&&entry.variant==='reveal'){
    const observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting)x.target.classList.add('revealed');}),{root:q('.reveal-scroll'),threshold:.35});qa('.reveal-item').forEach(el=>observer.observe(el));releases.push(()=>observer.disconnect());
  }
  if(entry.demo==='motion'&&entry.variant==='stagger')delay(()=>qa('.stagger-cell').forEach(el=>el.classList.add('entered')),40);
  return ()=>{active=false;releases.forEach(fn=>fn());timers.forEach(clearTimeout);frames.forEach(cancelAnimationFrame);qa('dialog[open]').forEach(el=>el.close());container.replaceChildren();};
}

function emptyMarkup(){return '<div class="spec-empty"><span>◇</span><h3>还没有项目</h3><p>先创建一个本地演示项目。</p>'+btn('empty-add','创建项目 +')+'</div>';}
const templates = {
navigation(v){
  if(v==='sidebar')return shell('<div class="sidebar-shell"><nav class="spec-sidebar" aria-label="演示侧栏">'+btn('collapse','⇤','collapse-button')+items.slice(0,4).map((n,i)=>'<button data-action="nav" data-index="'+i+'"><span>'+['◈','▦','◉','◇'][i]+'</span><b>'+n+'</b></button>').join('')+'</nav><div class="spec-view">精选作品</div></div>');
  if(v==='mega')return shell('<div class="spec-topbar"><b>FRAME</b>'+btn('menu','产品 ▾')+'<span>关于我们</span></div><div class="spec-menu mega-menu" hidden>'+['设计','动效','开发'].map((name,j)=>'<div>'+heading(name)+[1,2,3].map(i=>btn('mega-item',name+'工具 '+i)).join('')+'</div>').join('')+'</div><div class="spec-view">点击产品，展开分组目录。</div>');
  if(v==='breadcrumbs')return shell('<nav class="spec-crumbs" aria-label="演示路径">'+['全部项目','作品目录','视觉设计','本次项目'].map((n,i)=>'<button data-action="crumb" data-index="'+i+'">'+n+(i<3?' /':'')+'</button>').join('')+'</nav><div class="spec-view">本次项目</div>'+btn('restore-crumb','恢复完整路径'));
  if(v==='command')return shell(input('搜索本地命令','search','placeholder="试试设计或颜色"')+'<div class="command-list">'+['打开设计项目','创建新画布','调整颜色','查看最近文件'].map(n=>btn('command',n+' ↵')).join('')+'</div><div class="spec-view">等待执行命令。</div>');
  const names=v==='tabs'?['概览','作品','设置']:v==='bottom'?['首页','发现','消息','我的']:v==='dock'?['设计','图库','工具','资料']:['作品','服务','项目'];
  const nav='<nav class="spec-navigation nav-'+v+'" '+(v==='tabs'?'role="tablist"':'aria-label="演示导航"')+'>'+names.map((n,i)=>'<button data-action="nav" data-index="'+i+'" '+(v==='tabs'?'role="tab" aria-selected="'+(i===0)+'"':'aria-pressed="'+(i===0)+'"')+' class="'+(i===0?'selected':'')+'" title="'+n+'">'+(v==='dock'?'<span>'+['◈','◉','▦','◇'][i]+'</span>':v==='bottom'?'<span>'+['⌂','◈','□','○'][i]+'</span>':'')+'<b>'+n+'</b></button>').join('')+'</nav>';
  return shell((v==='topbar'?'<div class="spec-topbar"><b>FRAME</b>'+nav+'</div>':v==='bottom'||v==='dock'?'':nav)+'<div class="spec-view">'+art(0)+'<span>精选作品</span></div>'+(v==='bottom'||v==='dock'?nav:''));
},
layout(v){
  if(v==='hero')return shell('<section class="spec-hero"><div class="hero-text"><span class="section-eyebrow">CREATE / TOGETHER</span><h3 class="hero-headline">为想法找到形态。</h3><p>从清晰的界面开始，建立有温度的数字体验。</p>'+btn('hero-start','开始了解 ↗')+'</div><div class="hero-visual">'+art(0)+'</div></section><div class="spec-toolbar">'+chips(['品牌','产品','体验'],'hero-topic')+'</div>');
  if(v==='footer')return shell('<footer class="spec-footer"><div class="footer-brand"><strong>FRAME.</strong><p>Design a clear next step.</p></div><div class="footer-columns">'+[['探索','作品','组件'],['支持','使用说明','联系入口'],['关于','团队','设计原则']].map(([h,...links])=>'<details open><summary>'+h+'</summary>'+links.map(n=>btn('footer-link',n)).join('')+'</details>').join('')+'</div><div class="footer-bottom"><small>© 2026 FRAME / 示例页脚</small><button class="spec-button" data-action="footer-theme" aria-pressed="false">切换底色 ◐</button></div></footer>');
  if(v==='cta')return shell('<section class="spec-cta"><span class="section-eyebrow">YOUR NEXT CHAPTER</span><h3>让下一个想法<br>变成可见的作品。</h3><p class="cta-copy">一个明确的方向，一次简单的开始。</p>'+btn('cta-action','加入演示清单 ↗')+'<span class="cta-arrow" aria-hidden="true">↗</span></section>');
  if(v==='features')return shell('<section class="spec-features"><div class="spec-toolbar">'+chips(['内容结构','交互反馈','响应布局'],'feature-tab')+'</div><div class="feature-body"><div><span class="section-eyebrow">FEATURE / 01</span><h3 class="feature-title">清晰组织每个模块</h3><p class="feature-copy">将内容分成有标题、有层级的可复用区域。</p><details><summary>展开能力说明</summary><p>示例包含清楚的标题、有限的主操作和可理解的状态反馈。</p></details></div><div class="feature-visual">'+art(0)+'</div></div></section>');
  if(v==='bento')return shell('<div class="spec-bento">'+['主视觉','指标 128','最新项目','创作工具'].map((n,i)=>'<button class="bento-tile '+(i===0?'featured':'')+'" data-action="bento">'+n+'<span>'+['◈','↗','01','▦'][i]+'</span></button>').join('')+'</div>');
  if(v==='split')return shell('<div class="spec-split"><div class="split-left"><h3>表达</h3><p>文字与视觉共享空间。</p></div><div class="split-right">'+art(1)+'</div></div><label class="spec-range">调整左侧比例<input type="range" min="25" max="75" value="50"></label>');
  if(v==='masonry')return shell('<div class="spec-masonry">'+[90,130,70,110,80,140].map((h,i)=>'<button class="masonry-tile" style="--tile-h:'+h+'px" data-action="masonry">作品 '+(i+1)+'</button>').join('')+'</div>'+btn('add-masonry','添加卡片 +'));
  if(v==='grid')return shell('<label class="spec-range">模拟容器宽度<input type="range" min="40" max="100" value="100"></label><div class="responsive-demo"><div class="responsive-grid">'+[1,2,3,4,5,6].map(n=>'<div>模块 '+n+'</div>').join('')+'</div></div>');
  if(v==='sticky')return shell('<div class="sticky-shell"><nav>'+chips(['概述','案例','总结'],'chapter')+'</nav><div class="sticky-content">'+['概述','案例','总结'].map((n,i)=>'<section>'+heading(n)+art(i)+'<p>滚动这一栏，左侧目录保持可见。</p></section>').join('')+'</div></div>');
  if(v==='horizontal')return shell('<div class="spec-horizontal">'+[0,1,2,3].map(i=>'<article>'+art(i)+heading('案例 / 0'+(i+1))+'</article>').join('')+'</div><div class="spec-toolbar">'+btn('panel-prev','← 上一项')+btn('panel-next','下一项 →')+'</div>');
  if(v==='stack')return shell('<div class="spec-stack">'+[0,1,2].map(i=>'<article class="stack-card" style="--stack-order:'+i+'">'+art(i)+heading('FRAME / 0'+(i+1))+'</article>').join('')+'</div>'+btn('next-stack','下一张 →'));
  return shell('<div class="master-shell"><nav>'+chips(['Atlas','Studio','Motion'],'master')+'</nav><div class="master-detail">'+heading('Atlas')+art(0)+'</div></div>');
},
actions(v){
  if(v==='primary')return shell('<div class="button-center">'+btn('primary','立即开始 ↗','primary-button')+'</div>');
  if(v==='outline')return shell('<div class="button-center">'+btn('outline','选择方案 ↗','outline-button')+'</div>');
  if(v==='icon')return shell('<div class="button-center"><button class="icon-button" data-action="favorite" aria-label="收藏演示" aria-pressed="false">♡</button><button class="icon-button" data-action="share" aria-label="分享演示">↗</button></div>');
  if(v==='split-button')return shell('<div class="split-button-wrap">'+btn('export','导出 PNG','split-main')+'<button data-action="split-open" class="split-arrow" aria-label="选择导出格式" aria-expanded="false">▾</button><div class="split-options" hidden>'+['PNG','SVG','PDF'].map(n=>btn('format',n)).join('')+'</div></div>');
  if(v==='toggle-button')return shell('<div class="button-center"><button class="spec-button" data-action="toggle" aria-pressed="false"><b>B</b> 加粗</button><p class="toggle-preview">Design follows purpose.</p></div>');
  if(v==='segmented')return shell('<div class="spec-segment">'+chips(['日','周','月'],'segment')+'</div><strong class="segment-value">128</strong><div class="spec-bars">'+[40,60,32,80,52,74].map(n=>'<i class="spec-bar" style="--bar:'+n+'%"></i>').join('')+'</div>');
  if(v==='fab')return shell('<div class="fab-workspace">'+art(1)+'<div class="fab-options" hidden>'+['新建文档','上传示例','创建画板'].map(n=>btn('fab-choice',n)).join('')+'</div><button class="spec-fab" data-action="fab" aria-label="展开快捷动作" aria-expanded="false">+</button></div>');
  return shell('<div class="button-center magnetic-area">'+btn('magnetic','一起创作 ↗','magnetic-button')+'</div>');
},
forms(v){
  if(v==='floating')return shell('<label class="floating-field"><input placeholder=" " autocomplete="off"><span>你的名字</span></label>');
  if(v==='search')return shell(input('搜索本地项目','search','placeholder="输入 Atlas 或 Motion"')+'<div class="spec-options">'+items.map(n=>btn('search-choice',n)).join('')+'</div><p class="search-summary">尚未选择项目。</p>');
  if(v==='checkbox')return shell('<div class="checkbox-list">'+['网页设计','交互动效','三维展示'].map((n,i)=>'<label><input type="checkbox" value="'+n+'" '+(i===0?'checked':'')+'><span>'+n+'</span></label>').join('')+'</div>');
  if(v==='radio-cards')return shell('<fieldset class="radio-grid"><legend>选择展示方案</legend>'+['基础','专业','团队'].map((n,i)=>'<label class="radio-card '+(i===0?'selected':'')+'"><input type="radio" name="spec-plan" value="'+n+'" '+(i===0?'checked':'')+'><strong>'+n+'</strong><span>'+['单个项目','完整工作台','多人协作'][i]+'</span></label>').join('')+'</fieldset>');
  if(v==='switch')return shell('<label class="switch-label"><input type="checkbox" role="switch"><span class="switch-track"></span><b>增强显示</b></label><div class="switch-preview">'+art(0)+'</div>');
  if(v==='combobox')return shell('<div class="combo-wrap">'+input('选择设计工具','text','class="combo-input" placeholder="输入关键词" autocomplete="off"')+btn('combo-open','查看选项 ▾')+'<div class="combo-options" hidden>'+['Figma','Illustrator','Photoshop','Blender','Three.js'].map(n=>btn('combo-choice',n)).join('')+'</div></div>');
  if(v==='stepper')return shell('<label class="spec-field"><span>商品数量（1–9）</span><div class="number-stepper"><button data-action="minus" aria-label="减少数量">−</button><input class="quantity-input" type="number" min="1" max="9" value="1"><button data-action="plus" aria-label="增加数量">+</button></div></label><strong class="quantity-total">合计 ¥28</strong>');
  return shell('<form novalidate>'+input('邮箱地址','email','required placeholder="hello@example.com" autocomplete="off"')+'<p class="validation-message">仅校验格式，不发送任何数据。</p><button class="spec-button" type="submit">提交本地演示 ↗</button></form>');
},
content(v){
  if(v==='testimonials')return shell('<section class="spec-testimonials"><span class="section-eyebrow">VOICES / 示例评价</span><span class="quote-mark" aria-hidden="true">“</span><blockquote class="testimonial-quote">模块之间的层级很清晰，我们能快速找到需要的信息。</blockquote><p class="testimonial-author">陈 / 设计师 · 示例评价</p><div class="spec-toolbar">'+btn('quote-prev','← 上一条')+'<span class="quote-counter">1 / 3</span>'+btn('quote-next','下一条 →')+'</div></section>');
  if(v==='pagination')return shell('<ol class="pagination-list">'+['结构研究','视觉设计','交互记录'].map((n,i)=>'<li><span>0'+(i+1)+'</span><strong>'+n+'</strong><small>第 1 页</small></li>').join('')+'</ol><nav class="spec-pagination" aria-label="演示列表分页"><button class="spec-button" data-action="page-prev" disabled>←</button>'+[0,1,2].map(i=>'<button class="spec-button '+(i===0?'selected':'')+'" data-action="page" data-index="'+i+'" '+(i===0?'aria-current="page"':'')+' aria-label="第 '+(i+1)+' 页">'+(i+1)+'</button>').join('')+'<button class="spec-button" data-action="page-next">→</button></nav>');
  if(v==='product')return shell('<article class="product-card">'+art(1)+'<div>'+heading('FORM / 桌面摆件')+'<p>¥128 <span>清单 <b class="cart-count">0</b></span></p><div class="spec-toolbar">'+btn('cart','加入清单 +')+'<button class="icon-button" data-action="favorite" aria-label="收藏商品示例" aria-pressed="false">♡</button></div></div></article>');
  if(v==='profile')return shell('<article class="profile-card"><div class="spec-avatar">F</div><h3>林 / 视觉设计师</h3><p>形态、文字与交互。</p><button class="spec-button" data-action="follow" aria-pressed="false">关注 +</button><details><summary>查看更多资料</summary><p>专注品牌网站与动态视觉，最近作品：FRAME。</p></details></article>');
  if(v==='stats')return shell('<div class="spec-segment">'+chips(['本周','本月','本年'],'stats')+'</div><article class="stats-card"><span>项目访问次数</span><strong class="stat-number">12,840</strong><small>↗ 12.8%</small><div class="spec-bars">'+[25,48,64,40,72,88].map(n=>'<i class="spec-bar" style="--bar:'+n+'%"></i>').join('')+'</div></article>');
  if(v==='pricing')return shell('<div class="spec-segment">'+chips(['月付','年付'],'billing')+'</div><div class="pricing-grid">'+['个人','专业','团队'].map((n,i)=>'<article class="pricing-card"><h3>'+n+'</h3><p>¥<strong class="price-number">'+29*(i+1)+'</strong><small>/ 月</small></p><ul><li>精选展示页面</li><li>'+['基础组件','高级组件','协作组件'][i]+'</li></ul><button class="spec-button" data-action="plan" data-plan="'+n+'">选择 '+n+'</button></article>').join('')+'</div>');
  if(v==='accordion')return shell('<div class="spec-accordion">'+['这个组件适合什么内容？','展开状态怎样表达？','是否可以键盘操作？'].map((n,i)=>'<details '+(i===0?'open':'')+'><summary>'+n+'</summary><p>'+['适合常见问题、设置分组与较长说明。','标题旁的符号与内容区域一起变化。','可以聚焦标题后按 Enter 或空格展开。'][i]+'</p></details>').join('')+'</div>');
  if(v==='tree')return shell('<div class="spec-tree"><details open><summary>▦ 作品目录</summary><details><summary>▦ 网页项目</summary>'+btn('tree-file','FRAME.html')+btn('tree-file','Studio.html')+'</details><details open><summary>▦ 视觉资源</summary>'+btn('tree-file','主视觉.svg')+btn('tree-file','封面.png')+'</details></details></div>');
  if(v==='timeline')return shell('<div class="spec-timeline">'+['01 / 研究','02 / 设计','03 / 发布'].map((n,i)=>'<button class="'+(i===0?'selected':'')+'" data-action="timeline" data-index="'+i+'"><i></i>'+n+'</button>').join('')+'</div><p class="timeline-info">研究方向与收集案例</p>');
  return shell('<div class="table-scroll"><table class="spec-table"><thead><tr><th>选择</th><th><button data-action="sort" data-key="name">名称 ↕</button></th><th><button data-action="sort" data-key="amount">金额 ↕</button></th></tr></thead><tbody>'+[['Atlas',128],['Motion',86],['Studio',215]].map(([n,p])=>'<tr data-name="'+n+'" data-amount="'+p+'"><td><input type="checkbox" aria-label="选择 '+n+'"></td><td>'+n+'</td><td>¥'+p+'</td></tr>').join('')+'</tbody></table></div>');
},
feedback(v){
  if(v==='toast')return shell('<div class="toast-workspace">'+art(0)+'<div class="spec-toast" role="status">✓ 本地保存成功</div></div>'+btn('toast','保存演示'));
  if(v==='banner')return shell('<div class="spec-banner" data-level="0"><span class="banner-copy">今天有新的设计内容。</span><button data-action="banner-close" aria-label="关闭演示消息">×</button></div><div class="spec-toolbar">'+chips(['信息','注意','错误'],'severity')+btn('banner-reset','恢复显示')+'</div>');
  if(v==='progress')return shell('<div class="progress-demo"><progress max="100" value="0" aria-label="本地模拟进度"></progress><strong class="progress-value">0%</strong></div>'+btn('progress','开始本地任务'));
  if(v==='steps')return shell('<div class="spec-steps">'+['填写','检查','完成'].map((n,i)=>'<div class="step-node '+(i===0?'current':'')+'"><i>'+ (i+1)+'</i><span>'+n+'</span></div>').join('')+'</div><p class="step-copy">填写基本信息</p><div class="spec-toolbar">'+btn('step-prev','← 上一步')+btn('step-next','下一步 →')+'</div>');
  if(v==='skeleton')return shell('<div class="skeleton-card loading"><div class="skeleton-art"></div><div class="skeleton-lines"><i></i><i></i><i></i></div><div class="loaded-copy" hidden><strong>FRAME / 内容加载完成</strong><p>真实内容与占位使用相同的布局。</p></div></div>'+btn('skeleton','加载内容'));
  if(v==='badge')return shell('<div class="button-center"><span class="spec-badge" data-state="0">● 准备就绪</span>'+btn('badge','切换状态 →')+'</div>');
  if(v==='empty')return shell('<div class="empty-content">'+emptyMarkup()+'</div>');
  return shell('<div class="button-center">'+btn('loading-button','提交本地任务 ↗','primary-button')+'</div>');
},
overlays(v){
  if(v==='modal'||v==='confirm')return shell((v==='confirm'?'<article class="deletable">演示项目 / 01</article>':'<div class="popover-preview">FORM / 控件预览</div>')+btn('open-dialog',v==='confirm'?'删除演示项目':'打开对话框')+(v==='confirm'?btn('restore-delete','恢复项目'):'')+'<dialog class="spec-dialog"><div class="spec-dialog-head"><h3>'+ (v==='confirm'?'删除这个演示项目？':'显示设置')+'</h3><button data-action="close-dialog" aria-label="关闭演示对话框">×</button></div><p>'+(v==='confirm'?'这只影响当前局部示例，可用恢复按钮重新创建。':'为这次本地示例选择一个主题。')+'</p>'+(v==='modal'?'<label><input type="radio" name="dialog-theme" checked> 明亮</label><label><input type="radio" name="dialog-theme"> 深色</label>':'')+'<div class="spec-toolbar">'+btn('close-dialog','取消')+btn('confirm-dialog',v==='confirm'?'确认删除':'确认设置','primary-button')+'</div></dialog>');
  if(v==='drawer'||v==='sheet')return shell('<div class="overlay-workspace">'+art(0)+btn('open-panel',v==='drawer'?'打开侧边清单':'打开分享面板')+'<button class="panel-shade" data-action="close-panel" aria-label="关闭面板" hidden></button><section class="overlay-panel '+(v==='sheet'?'bottom-sheet':'')+'" aria-label="演示面板" hidden><div class="spec-dialog-head"><h3>'+ (v==='drawer'?'我的清单':'分享示例')+'</h3><button data-action="close-panel" aria-label="关闭面板">×</button></div>'+(v==='drawer'?'<p>演示项目 × <b class="drawer-count">1</b></p>'+btn('drawer-add','增加一件 +'):'<div class="spec-options">'+['复制链接','生成图片','发送到设备'].map(n=>btn('overlay-choice',n)).join('')+'</div>')+'</section></div>');
  if(v==='popover')return shell('<div class="popover-preview">Design / purpose</div><div class="popover-anchor">'+btn('popover','文字设置 ▾')+'<div class="spec-popover" hidden><label class="spec-range">预览字号<input type="range" min="14" max="32" value="20"></label><p>设置仅在此示例中生效。</p></div></div>');
  if(v==='tooltip')return shell('<div class="tooltip-wrap"><button class="icon-button" data-action="tooltip-act" aria-describedby="spec-tooltip-description">ⓘ</button><span class="spec-tooltip" id="spec-tooltip-description" role="tooltip">查看这个控件的详细说明。</span></div>');
  if(v==='dropdown')return shell('<div class="dropdown-anchor">'+btn('drop-open','更多操作 ▾')+'<div class="spec-dropdown" hidden>'+['查看详情','复制项目','归档示例'].map(n=>btn('overlay-choice',n)).join('')+'</div></div>');
  return shell('<div class="context-target" tabindex="0">'+art(1)+'<p>右键这里，或使用下方按钮。</p>'+btn('context-open','打开上下文菜单')+'<div class="context-menu" hidden>'+['复制','重命名','移到收藏'].map(n=>btn('overlay-choice',n)).join('')+'</div></div>');
},
media(v){
  if(v==='carousel'||v==='thumbnails')return shell('<div class="spec-main-art">'+art(0)+'</div><div class="spec-toolbar">'+(v==='carousel'?btn('media-prev','←'):'')+chips(v==='carousel'?['01','02','03','04']:['封面','结构','细节','空间'],'media-index')+(v==='carousel'?btn('media-next','→'):'')+'</div>');
  if(v==='gallery')return shell('<div class="spec-gallery">'+[0,1,2,3].map(i=>'<button data-action="lightbox" data-index="'+i+'" aria-label="扩大查看示例 '+(i+1)+'">'+art(i)+'</button>').join('')+'</div><dialog class="spec-dialog lightbox-dialog"><div class="lightbox-art">'+art(0)+'</div><div class="spec-toolbar">'+btn('lightbox-prev','← 上一张')+btn('lightbox-next','下一张 →')+btn('lightbox-close','关闭 ×')+'</div></dialog>');
  if(v==='compare')return shell('<div class="spec-compare">'+art(0)+'<div class="compare-after">'+art(2)+'</div><div class="compare-line"></div><span class="compare-before-label">调整前</span><span class="compare-after-label">调整后</span></div><label class="spec-range">调整对比边界<input type="range" min="0" max="100" value="50"></label>');
  if(v==='zoom')return shell('<div class="zoom-target">'+art(1)+'</div><button class="spec-button" data-action="zoom" aria-pressed="false">切换放大 ↗</button>');
  if(v==='hotspots')return shell('<div class="hotspot-stage">'+art(3)+[0,1,2].map((i)=>'<button class="hotspot '+(i===0?'selected':'')+'" data-action="hotspot" data-index="'+i+'" aria-label="热点 '+(i+1)+'">'+(i+1)+'</button>').join('')+'</div><p class="hotspot-copy">外轮廓：定义整体结构。</p>');
  if(v==='video-controls')return shell('<div class="video-art">'+art(0)+'<span>LOCAL UI SIMULATION / 本地控件模拟</span></div><div class="video-toolbar">'+btn('video','播放模拟')+'<label class="sr-label">模拟进度<input class="video-range" type="range" min="0" max="60" value="0" aria-label="本地模拟播放进度"></label><span class="video-time">00:00 / 00:60</span>'+btn('mute','声音示意')+'</div>');
  return shell('<button class="flip-card" data-action="flip" aria-label="翻转媒体卡片"><span class="flip-front">'+art(1)+'<strong>点击翻转 ↗</strong></span><span class="flip-back"><b>FORM / 01</b><p>用两面组织视觉与说明。</p><strong>返回正面 ↩</strong></span></button>');
},
motion(v){
  if(v==='reveal')return shell('<div class="reveal-scroll">'+[1,2,3,4].map(n=>'<article class="reveal-item">'+heading('章节 / 0'+n)+art(n)+'<p>继续向下滚动，发现下一项。</p></article>').join('')+'</div>');
  if(v==='parallax')return shell('<div class="motion-area parallax-area"><div class="parallax-layer layer-0">BACKGROUND</div><div class="parallax-layer layer-1">FORM</div><div class="parallax-layer layer-2">01</div></div><label class="spec-range">调整视差<input type="range" min="0" max="100" value="50"></label>');
  if(v==='tilt')return shell('<div class="motion-area tilt-area"><div class="tilt-target">'+art(2)+'<strong>FORM / TILT</strong></div></div>'+btn('tilt','切换倾斜角度 →'));
  if(v==='marquee')return shell('<div class="marquee-window"><div class="marquee-track">'+Array(2).fill('<span>FORM ◇ MOTION ◇ INTERACTION ◇ DESIGN ◇ </span>').join('')+'</div></div><div class="spec-toolbar">'+btn('marquee-direction','切换方向 ↔')+btn('marquee-speed','切换速度 1× / 2×')+'</div>');
  if(v==='spring')return shell('<div class="spring-area"><button class="spring-dot" aria-label="拖动弹簧圆点">↔</button></div>'+btn('spring','触发一次回弹'));
  if(v==='stagger')return shell('<div class="stagger-grid">'+Array.from({length:9},(_,i)=>'<div class="stagger-cell" style="transition-delay:'+i*50+'ms">'+String(i+1).padStart(2,'0')+'</div>').join('')+'</div>'+btn('stagger','重新入场 / 切换顺序'));
  if(v==='morph')return shell('<div class="morph-area"><div class="morph-shape" data-shape="0"></div></div><div class="spec-toolbar">'+chips(['圆形','圆角块','菱形'],'morph')+'</div>');
  return shell('<div class="motion-area trail-area"><span>MOVE YOUR POINTER / 在这里移动指针</span></div>'+btn('trail-burst','生成一次轨迹'));
},
three(v){return '<div class="three-live-stage three-detail-host" data-three-variant="'+esc(v)+'" aria-label="真实 Three.js 交互示例"></div><p class="three-demo-note">实时 Three.js · 拖动旋转 · 滚轮缩放</p><a class="spec-button" href="#lab">进入完整 Three.js 实验室 ↗</a>'; }
};

