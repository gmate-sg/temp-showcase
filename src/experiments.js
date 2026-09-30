/* NEBULA local experiments. All calculations stay in this page. */
const TAU=Math.PI*2, DEG=Math.PI/180, W=480, H=200;
const GOLD='#dfb879', RED='#ed7568', BLUE='#8eabef', PURPLE='#b198e7', WHITE='#eee7db';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number.isInteger(v)?String(v):Number(v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
const dot=(c,x,y,r=3,col=GOLD)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
const line=(c,x,y,a,b,col=GOLD,width=1)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();};
const label=(c,s,x,y,col=WHITE,size=11)=>{c.fillStyle=col;c.font=size+'px "Segoe UI","Microsoft YaHei",sans-serif';c.fillText(s,x,y);};
const path=(c,points,col=GOLD,width=1.3)=>{if(!points.length)return;c.strokeStyle=col;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
const grid=c=>{c.strokeStyle='#ffffff09';c.lineWidth=1;for(let x=0;x<W;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=0;y<H;y+=25){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}};
const softmax=a=>{const m=Math.max(...a),v=a.map(x=>Math.exp(x-m)),s=v.reduce((x,y)=>x+y,0);return v.map(x=>x/s);};
function rng(seed=1){let state=seed>>>0;return()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);}
const ACTIONS={
'attention':[['next','下一词元'],['mask','切换因果遮罩']],
'embedding':[['query','旋转查询'],['perturb','扰动候选']],
'agents':[['step','执行一步'],['run','完成回路']],
'multimodal':[['align','恢复对齐'],['shuffle','交换候选']],
'rollout':[['step','推进一步'],['predict','推演轨迹']],
'pathfinding':[['solve','运行 A*'],['maze','重新布障']],
'ik':[['elbow','切换肘向'],['target','随机目标']],
'mapping':[['scan','扫描一次'],['move','移动传感器']],
'gaussian':[['seed','重新布核'],['clear','清空软核']],
'sdf':[['mode','切换形体组合'],['contour','切换等值线']],
'encoding':[['basis','显示分频'],['phase','移动相位']],
'reconstruction':[['sample','重新采样'],['smooth','重建轮廓']],
'particles':[['burst','释放冲击'],['reset','重新释放']],
'fluid':[['inject','注入流束'],['reverse','反转旋涡']],
'boids':[['target','设置吸引点'],['scatter','散开群集']],
'gravity':[['launch','重新入轨'],['kick','施加推力']],
'bloch':[['measure','测量 100 次'],['prepare','重新制备']],
'interference':[['phase','反转相位'],['sample','探测 200 次']],
'bell':[['sample','抽样 200 对'],['clear','清空统计']],
'gates':[['apply-h','应用 H 门'],['apply-x','应用 X 门']],
'molecule':[['rotate','转动构型'],['measure','测量原子间距']],
'growth':[['grow','释放粒子'],['seed','重新播种']],
'reaction':[['pulse','注入扰动'],['seed','重置浓度']],
'folding':[['relax','降低能量'],['scramble','扰动珠链']],
'refraction':[['swap','交换介质'],['record','记录角度']],
'dispersion':[['white','切换单色光'],['spread','放大色散']],
'brdf':[['material','切换材质'],['light','移动光源']],
'polarization':[['insert','插入中间片'],['cross','正交偏振']],
'attractor':[['perturb','微扰初值'],['reset','重置轨迹']],
'lsystem':[['rule','切换规则'],['grow','增加一代']],
'waves':[['phase','翻转相位'],['pulse','注入扰动']],
'harmonograph':[['phase','切换相位'],['redraw','重新绘图']]
};
export function mountExperiment(container,entry,{onParameter,onAction}={}){
  let disposed=false,raf=0,last=0,elapsed=0;
  const releases=[],defs=entry.controls||[],params=Object.fromEntries(defs.map(d=>[d.key,d.value]));
  const variant=entry.experiment.replace(/^[^-]+-/,'');
  const actions=ACTIONS[variant];
  if(!actions)throw new Error('Unknown experiment '+entry.experiment);
  container.innerHTML='<div class="experiment-lab"><div class="experiment-view"><canvas role="img" tabindex="0" aria-label="'+esc(entry.name)+'本地实验画布"></canvas><span class="experiment-kind">'+(entry.kind==='runtime'?'浏览器计算':entry.kind==='research'?'研究原理示例':'本地模拟')+'</span><output class="experiment-metric"></output></div><div class="experiment-controls">'+defs.map(d=>'<label><span>'+esc(d.label)+' <output data-value="'+esc(d.key)+'">'+fmt(d.value)+esc(d.unit)+'</output></span><input type="range" data-key="'+esc(d.key)+'" min="'+d.min+'" max="'+d.max+'" step="'+d.step+'" value="'+d.value+'"></label>').join('')+'</div><div class="experiment-actions">'+actions.map(([key,text])=>'<button type="button" data-action="'+key+'">'+text+'</button>').join('')+'</div><p class="experiment-status" role="status" aria-live="polite"></p></div>';
  const lab=container.querySelector('.experiment-lab'),canvas=lab.querySelector('canvas'),ctx=canvas.getContext('2d');
  const status=lab.querySelector('.experiment-status'),metric=lab.querySelector('.experiment-metric');
  const on=(el,event,fn,opt)=>{el.addEventListener(event,fn,opt);releases.push(()=>el.removeEventListener(event,fn,opt));};
  const emit=text=>{if(!disposed)status.textContent=text;};
  let engine;
  const set=(key,value,notify=false)=>{
    const d=defs.find(d=>d.key===key);if(!d||!Number.isFinite(Number(value)))return;
    params[key]=Number(clamp(d.min+Math.round((Number(value)-d.min)/d.step)*d.step,d.min,d.max).toFixed(6));
    lab.querySelector('[data-key="'+key+'"]').value=params[key];
    lab.querySelector('[data-value="'+key+'"]').textContent=fmt(params[key])+(d.unit||'');
    engine?.parameter?.(key,params[key]);
    if(notify)onParameter?.(key,params[key]);
    emit(d.label+'：'+fmt(params[key])+(d.unit||'')+'。');
  };
  engine=createEngine(entry,params,emit,(key,value)=>set(key,value,true));
  emit(engine.hint);
  on(lab,'input',e=>{if(e.target.dataset.key)set(e.target.dataset.key,e.target.value,true);});
  on(lab,'click',e=>{const b=e.target.closest('[data-action]');if(b){engine.action(b.dataset.action);onAction?.(b.dataset.action,elapsed);}});
  on(canvas,'pointerdown',e=>{const r=canvas.getBoundingClientRect();engine.pointer?.((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H);onAction?.('pointer',elapsed);});
  on(canvas,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();engine.pointer?.(W/2+(['ArrowLeft','ArrowRight'].includes(e.key)?(e.key==='ArrowLeft'?-90:90):0),H/2+(['ArrowUp','ArrowDown'].includes(e.key)?(e.key==='ArrowUp'?-50:50):0));emit('已通过方向键改变实验目标。');}if(e.key==='Enter'){e.preventDefault();engine.action(actions[0][0]);onAction?.(actions[0][0],elapsed);}});
  let drawScale=1;
  const resize=()=>{if(disposed)return;const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));drawScale=canvas.width/W;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const loop=time=>{if(disposed)return;const dt=last?Math.min((time-last)/1000,.04):.016;last=time;elapsed+=dt;
    if(!document.hidden){ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.fillStyle='#09090f';ctx.fillRect(0,0,W,H);grid(ctx);engine.draw(ctx,elapsed,dt);metric.textContent=engine.metric?.()||'';}
    raf=requestAnimationFrame(loop);
  };raf=requestAnimationFrame(loop);
  return {setParameter:(key,value)=>set(key,value),dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();releases.forEach(f=>f());engine.dispose?.();container.replaceChildren();}};
}
function createEngine(entry,p,emit,set){
  const family=entry.id.split('-')[0],v=entry.id.slice(family.length+1);
  const makers={ai:makeAI,world:makeWorld,spatial:makeSpatial,compute:makeCompute,quantum:makeQuantum,life:makeLife,optics:makeOptics,art:makeArt};
  return makers[family](v,p,emit,set);
}
function makeAI(v,p,emit,set){
  const words=['星','河','映','照','未','来'];let masked=false,angles=[10,42,70,132,193,246,302],query=40,phase=0,current=p.rate||3,cycle=0,tool='';
  const vectors=()=>words.map((_,i)=>[Math.cos(i*.92),Math.sin(i*.92)]);
  const weights=()=>{const a=vectors(),q=a[Math.round(p.amount)%6];return softmax(a.map((k,i)=>masked&&i>p.amount?-1e4:(q[0]*k[0]+q[1]*k[1])/p.rate));};
  const step=()=>{if(current>=p.amount){current=p.amount;emit('目标已完成：'+current+'。这是本地算术工具回路。');return;}cycle=(cycle+1)%4;phase=cycle?cycle-1:3;if(cycle===1)emit('观察：当前 '+current+'，目标 '+p.amount+'。');if(cycle===2){tool=current*2<=p.amount?'× 2':'+ 1';emit('计划：选择工具 '+tool+'。');}if(cycle===3){current=tool==='× 2'?current*2:current+1;emit('工具执行：得到 '+current+'。');}if(cycle===0)emit('检查：'+(current===p.amount?'目标完成。':'继续观察。'));};
  return {hint:({attention:'点击词元可选择查询；遮罩会排除后续位置。',embedding:'点击画布改变查询方向，查看最相似候选。',agents:'逐步观察、计划、执行与检查；这里没有模型推理。',multimodal:'人工向量的旋转与候选交换会改变匹配矩阵。'})[v],
    action(a){if(v==='attention'){if(a==='next')set('amount',(p.amount+1)%6);if(a==='mask'){masked=!masked;emit(masked?'因果遮罩已开启，后续词元权重为零。':'显示所有词元的注意力权重。');}}
      if(v==='embedding'){if(a==='query')set('amount',(p.amount+48)%360);else{angles=angles.map(x=>(x+Math.random()*35-17.5+360)%360);emit('候选向量已扰动，重新计算余弦相似度。');}}
      if(v==='agents'){if(a==='step')step();else{for(let i=0;i<400&&current<p.amount;i++)step();emit('回路完成：'+current+' / '+p.amount+'，所有工具在本地执行。');}}
      if(v==='multimodal'){if(a==='align'){set('amount',0);phase=0;emit('人工图像和文字向量恢复一一对齐。');}else{phase=(phase+1)%3;emit('文字候选顺序已交换，匹配仍按相似度计算。');}}},
    parameter(){if(v==='agents'){current=p.rate;cycle=0;}},
    pointer(x,y){if(v==='attention')set('amount',clamp(Math.floor((x-35)/70),0,5));if(v==='embedding')set('amount',(Math.atan2(H/2-y,x-W/2)/DEG+360)%360);},
    metric(){if(v==='attention'){const w=weights();return '权重和 '+w.reduce((a,b)=>a+b,0).toFixed(3)+' · 最大 '+Math.max(...w).toFixed(3);}if(v==='embedding'){const scores=angles.map(a=>Math.cos((a-p.amount)*DEG));return '最高余弦 '+Math.max(...scores).toFixed(3)+' · Top '+p.spread;}if(v==='agents')return '当前 '+current+' / 目标 '+p.amount;if(v==='multimodal')return '相位 '+p.amount+'° · 候选位移 '+phase;},
    draw(c,t){if(v==='attention'){const w=weights();words.forEach((s,i)=>{const x=35+i*70;c.fillStyle=i===p.amount?RED:'#44354e';c.fillRect(x,130-w[i]*105,42,w[i]*105);label(c,s,x+14,153);label(c,w[i].toFixed(2),x+4,175,GOLD);if(i===p.amount){c.strokeStyle=RED;c.strokeRect(x-5,138,52,25);}});label(c,'softmax(Q·K / 温度)',25,25,PURPLE);}
      if(v==='embedding'){const cx=240,cy=100,r=72;c.strokeStyle='#a9956c55';c.beginPath();c.arc(cx,cy,r,0,TAU);c.stroke();const sorted=angles.map((a,i)=>({i,s:Math.cos((a-p.amount)*DEG)})).sort((a,b)=>b.s-a.s).slice(0,p.spread).map(a=>a.i);angles.forEach((a,i)=>{const x=cx+r*Math.cos(a*DEG),y=cy-r*Math.sin(a*DEG);dot(c,x,y,sorted.includes(i)?5:3,sorted.includes(i)?GOLD:PURPLE);label(c,'V'+(i+1),x+7,y,WHITE,10);});const x=cx+r*Math.cos(p.amount*DEG),y=cy-r*Math.sin(p.amount*DEG);line(c,cx,cy,x,y,RED,2);dot(c,x,y,5,RED);label(c,'查询',x+5,y+15,RED);}
      if(v==='agents'){['观察','计划','工具','检查'].forEach((s,i)=>{const x=25+i*115;c.fillStyle=phase===i?RED:'#2e263c';c.fillRect(x,63,88,50);label(c,s,x+30,92);if(i<3)label(c,'→',x+96,92,GOLD,15);});label(c,'本地算术任务：'+current+' → '+p.amount,30,150,GOLD,15);}
      if(v==='multimodal'){for(let i=0;i<3;i++){label(c,'图 '+(i+1),55,65+i*40);const scores=softmax([0,1,2].map(j=>Math.cos(((j+phase)%3*100+p.amount-i*100)*DEG)/p.spread));for(let j=0;j<3;j++){const z=scores[j];c.fillStyle='rgba(177,152,231,'+(.12+z*.85)+')';c.fillRect(135+j*75,40+i*40,67,33);label(c,z.toFixed(2),150+j*75,62+i*40);}label(c,'文字候选 '+(i+1),130+i*75,185,GOLD,10);}}
    }};
}
function makeWorld(v,p,emit,set){
  const C=18,R=8,cell=23,ox=32,oy=10;let walls=new Set(),visited=[],route=[],pos=[1,4],target=[14,3],elbow=1,known=new Map(),heading=0,prediction=[];
  const at=(x,y)=>y*C+x,valid=(x,y)=>x>=0&&x<C&&y>=0&&y<R;
  const maze=()=>{walls=new Set();for(let y=0;y<R;y++)for(let x=0;x<C;x++)if(Math.random()<(v==='pathfinding'?p.amount/100:.18)&&!(x===1&&y===4)&&!(x===16&&y===3))walls.add(at(x,y));};
  maze();
  const solve=()=>{const start=at(1,4),goal=at(16,3),open=[start],came=new Map(),g=new Map([[start,0]]),closed=new Set();visited=[];route=[];
    while(open.length){open.sort((a,b)=>(g.get(a)+p.spread*(Math.abs(a%C-16)+Math.abs(Math.floor(a/C)-3)))-(g.get(b)+p.spread*(Math.abs(b%C-16)+Math.abs(Math.floor(b/C)-3))));const n=open.shift();if(closed.has(n))continue;closed.add(n);visited.push(n);if(n===goal){let k=n;while(k!==undefined){route.unshift(k);k=came.get(k);}break;}const x=n%C,y=Math.floor(n/C);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=at(a,b);if(!valid(a,b)||walls.has(k))continue;const z=g.get(n)+p.spread;if(z<(g.get(k)??Infinity)){g.set(k,z);came.set(k,n);open.push(k);}}}emit(route.length?'找到路径：'+(route.length-1)+' 步，探索 '+visited.length+' 格。':'目前无可达路径，请移除一些障碍。');};
  const predict=()=>{const dirs=[[1,0],[0,-1],[-1,0],[0,1]],d=dirs[p.rate],q=[...pos];prediction=[];for(let i=0;i<p.amount;i++){const x=q[0]+d[0],y=q[1]+d[1];if(!valid(x,y)||walls.has(at(x,y)))break;q[0]=x;q[1]=y;prediction.push(at(x,y));}emit('本地规则预测 '+prediction.length+' 个可达后续位置。');};
  const scan=()=>{for(let i=0;i<p.amount;i++){const a=(heading-p.spread/2+i*p.spread/Math.max(1,p.amount-1))*DEG;for(let d=0;d<25;d+=.3){const x=Math.round(pos[0]+Math.cos(a)*d),y=Math.round(pos[1]+Math.sin(a)*d);if(!valid(x,y))break;const k=at(x,y);known.set(k,walls.has(k));if(walls.has(k))break;}}heading=(heading+30)%360;emit('扫描完成：已知 '+known.size+' / '+C*R+' 格。');};
  return {hint:v==='ik'?'点击设置目标，双连杆解析逆解显示末端误差。':'点击栅格修改障碍；动作会计算路径、预测或扫描结果。',
    action(a){if(v==='rollout'){if(a==='step'){predict();if(prediction.length){const k=prediction[0];pos=[k%C,Math.floor(k/C)];}prediction=[];emit('移动到栅格 '+pos.join(',')+'。');}else predict();}
      if(v==='pathfinding'){if(a==='maze'){maze();visited=[];route=[];emit('障碍已更新，请运行 A*。');}else solve();}
      if(v==='ik'){if(a==='elbow')elbow*=-1;else target=[140+Math.random()*220,35+Math.random()*110];emit(elbow>0?'使用上肘解。':'使用下肘解。');}
      if(v==='mapping'){if(a==='scan')scan();else{pos=[2+Math.floor(Math.random()*13),1+Math.floor(Math.random()*6)];walls.delete(at(...pos));scan();}}},
    parameter(key){if(v==='pathfinding'&&key==='amount'){maze();visited=[];route=[];}},
    pointer(x,y){if(v==='ik'){target=[x,y];emit('目标坐标 '+x.toFixed(0)+', '+y.toFixed(0)+'。');}else{const a=Math.floor((x-ox)/cell),b=Math.floor((y-oy)/cell);if(valid(a,b)&&!(a===1&&b===4)&&!(a===16&&b===3)){const k=at(a,b);walls.has(k)?walls.delete(k):walls.add(k);route=[];visited=[];prediction=[];emit('障碍已修改。');}}},
    metric(){if(v==='ik'){const d=Math.hypot(target[0]-190,target[1]-130),err=Math.max(0,d-p.amount-p.spread,Math.abs(p.amount-p.spread)-d);return '末端误差 '+err.toFixed(2)+' · '+(err<.01?'目标可达':'目标超出工作空间');}if(v==='mapping')return '已知区域 '+Math.round(known.size/(C*R)*100)+'%';if(v==='pathfinding')return '路径 '+Math.max(0,route.length-1)+' 步 · 成本 '+(Math.max(0,route.length-1)*p.spread).toFixed(0);return '位置 '+pos.join(',')+' · 预测 '+prediction.length+' 步';},
    draw(c){if(v==='ik'){const bx=190,by=130,dx=target[0]-bx,dy=target[1]-by,l1=p.amount,l2=p.spread;const b=elbow*Math.acos(clamp((dx*dx+dy*dy-l1*l1-l2*l2)/(2*l1*l2),-1,1));const a=Math.atan2(dy,dx)-Math.atan2(l2*Math.sin(b),l1+l2*Math.cos(b));const x=bx+l1*Math.cos(a),y=by+l1*Math.sin(a),ex=x+l2*Math.cos(a+b),ey=y+l2*Math.sin(a+b);c.strokeStyle='#dfb87922';c.beginPath();c.arc(bx,by,l1+l2,0,TAU);c.stroke();line(c,bx,by,x,y,GOLD,8);line(c,x,y,ex,ey,PURPLE,6);dot(c,bx,by,9,WHITE);dot(c,x,y,7,RED);dot(c,ex,ey,5,WHITE);dot(c,...target,5,RED);line(c,ex,ey,...target,RED);label(c,'目标',target[0]+8,target[1],RED);return;}
      for(let y=0;y<R;y++)for(let x=0;x<C;x++){const k=at(x,y);c.fillStyle=v==='mapping'?(known.has(k)?known.get(k)?RED:'#796145':'#1a1725'):walls.has(k)?'#755670':'#1e1b28';if(visited.includes(k))c.fillStyle='#574133';if(route.includes(k)||prediction.includes(k))c.fillStyle=GOLD;c.fillRect(ox+x*cell,oy+y*cell,cell-2,cell-2);}dot(c,ox+pos[0]*cell+10,oy+pos[1]*cell+10,6,RED);if(v==='pathfinding')dot(c,ox+16*cell+10,oy+3*cell+10,6,WHITE);
    }};
}
function makeSpatial(v,p,emit,set){
  let kernels=[],mode=0,contours=true,bases=false,points=[],reconstructed=false;
  const seed=()=>{kernels=Array.from({length:9},()=>[80+Math.random()*320,30+Math.random()*140]);};
  const sample=()=>{points=Array.from({length:p.amount},(_,i)=>{const a=i/p.amount*TAU;const r=60+12*Math.sin(5*a)+(Math.random()-.5)*p.spread;return [240+Math.cos(a)*r*1.5,100+Math.sin(a)*r,a];});reconstructed=false;};
  seed();sample();
  const sdf=(x,y)=>{x-=240;y-=100;const circle=Math.hypot(x+p.spread/2,y)-43;let b;if(mode===0){const qx=Math.abs(x-p.spread/2)-37,qy=Math.abs(y)-38;b=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);}else b=Math.hypot(x-p.spread/2,y)-35;const h=clamp(.5+.5*(b-circle)/p.amount,0,1);return b*(1-h)+circle*h-p.amount*h*(1-h);};
  return {hint:({gaussian:'点击添加高斯核；调整参数会改变叠加图像。',sdf:'解析距离场以零等值线定义形体边界。',encoding:'分频按钮展示基函数；相位改变每个位置的编码。',reconstruction:'采样点会含噪声；重建按钮进行角度排序和邻域平滑。'})[v],
    action(a){if(v==='gaussian'){if(a==='seed')seed();else kernels=[];emit('当前有 '+kernels.length+' 个软核；可点击继续添加。');}
      if(v==='sdf'){if(a==='mode')mode=1-mode;else contours=!contours;emit(mode?'两个圆形平滑并集。':'圆形与方形平滑并集。');}
      if(v==='encoding'){if(a==='basis')bases=!bases;else set('rate',(p.rate+.8)%6.28);emit(bases?'显示各频率基函数。':'显示叠加信号。');}
      if(v==='reconstruction'){if(a==='sample')sample();else reconstructed=true;emit(reconstructed?'已完成角度排序与三点邻域平滑。':'采样已更新。');}},
    parameter(){if(v==='reconstruction')sample();},
    pointer(x,y){if(v==='gaussian'){kernels.push([x,y]);if(kernels.length>30)kernels.shift();emit('添加软核，共 '+kernels.length+' 个。');}if(v==='sdf')set('spread',clamp(Math.abs(x-240),15,95));},
    metric(){if(v==='gaussian')return '核 '+kernels.length+' · σ '+p.amount;if(v==='sdf')return '平滑半径 '+p.amount+' · 零面边界';if(v==='encoding')return '正弦基 '+p.amount+' 层 · 最高频率 '+2**(p.amount-1);return '采样 '+points.length+' 点 · '+(reconstructed?'已重建':'等待重建');},
    draw(c){if(v==='gaussian'){for(const [x,y]of kernels){const r=p.amount*3,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(220,150,141,'+p.spread+')');g.addColorStop(.45,'rgba(177,152,231,'+p.spread*.35+')');g.addColorStop(1,'rgba(177,152,231,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);dot(c,x,y,1.5,GOLD);}label(c,'二维高斯核叠加',15,22);}
      if(v==='sdf'){for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){const d=sdf(x,y),edge=Math.abs(d)<2;const z=contours&&Math.abs((Math.abs(d)%12)-6)<1.5;c.fillStyle=edge?GOLD:d<0?'#66454f':z?'#65568e':'#171421';c.fillRect(x,y,4,4);}label(c,'d < 0 内部 / d = 0 边界',15,22,WHITE);}
      if(v==='encoding'){line(c,20,100,460,100,'#ffffff33');for(let f=0;f<(bases?p.amount:1);f++){const pts=[];for(let i=0;i<440;i+=2){const x=i/440*TAU;let z=0;if(bases)z=Math.sin(2**f*x+p.rate);else for(let j=0;j<p.amount;j++)z+=Math.sin(2**j*x+p.rate)/2**j;pts.push([20+i,100-z*(bases?40:38)]);}path(c,pts,[GOLD,PURPLE,BLUE,RED][f%4],1.4);}label(c,bases?'独立正弦基':'多频率叠加',20,25);}
      if(v==='reconstruction'){points.forEach(a=>dot(c,a[0],a[1],2.5,PURPLE));if(reconstructed){const a=[...points].sort((a,b)=>a[2]-b[2]),b=a.map((p,i)=>[0,1].map(k=>(a[(i+a.length-1)%a.length][k]+p[k]+a[(i+1)%a.length][k])/3));path(c,[...b,b[0]],GOLD,2);}label(c,reconstructed?'平滑闭合轮廓':'有噪声的轮廓采样',15,22);}
    }};
}
function makeCompute(v,p,emit,set){
  let bodies=[],target=null,direction=1;
  const reset=()=>{const n=Math.round(v==='fluid'?p.spread:v==='gravity'?9:p.amount);bodies=Array.from({length:n},(_,i)=>{const a=i/n*TAU,r=40+(i%3)*16;return {x:v==='gravity'?240+Math.cos(a)*r:30+Math.random()*420,y:v==='gravity'?100+Math.sin(a)*r:20+Math.random()*150,vx:v==='gravity'?-Math.sin(a)*p.rate*55:(Math.random()-.5)*35,vy:v==='gravity'?Math.cos(a)*p.rate*55:(Math.random()-.5)*35,trail:[]};});};
  reset();
  const burst=(x=240,y=100)=>{for(const b of bodies){const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy)||1;b.vx+=dx/d*65;b.vy+=dy/d*65;}emit('冲击已改变 '+bodies.length+' 个粒子的速度。');};
  return {hint:({particles:'点击任意位置释放冲击；粒子会积分重力并在边界反弹。',fluid:'点击注入示踪束；这里对解析速度场做平流。',boids:'点击设置吸引点；个体按分离、对齐与聚合规则移动。',gravity:'中心引力积分产生轨道；推力会改变轨道能量。'})[v],
    action(a){if(v==='particles'){if(a==='burst')burst();else{reset();emit('重新设置粒子位置与速度。');}}
      if(v==='fluid'){if(a==='reverse'){direction*=-1;emit('旋涡方向已经反转。');}else{for(let i=0;i<12;i++)bodies.push({x:30,y:60+i*4,vx:0,vy:0,trail:[]});if(bodies.length>220)bodies.splice(0,12);emit('已注入 12 个示踪点。');}}
      if(v==='boids'){if(a==='scatter'){reset();target=null;emit('群集位置已散开。');}else{target=[70+Math.random()*340,35+Math.random()*130];emit('已加入新的群集吸引点。');}}
      if(v==='gravity'){if(a==='launch'){reset();emit('已按当前速度重新入轨。');}else{bodies.forEach(b=>b.vx+=18);emit('全部轨道获得水平推力。');}}},
    parameter(key){if((v==='particles'||v==='boids')&&key==='amount'||v==='fluid'&&key==='spread'||v==='gravity'&&key==='rate')reset();},
    pointer(x,y){if(v==='particles')burst(x,y);if(v==='boids'){target=[x,y];emit('吸引点已更新。');}if(v==='fluid'){for(let i=0;i<10;i++)bodies.push({x:x+(Math.random()-.5)*10,y:y+(Math.random()-.5)*10,vx:0,vy:0,trail:[]});if(bodies.length>220)bodies.splice(0,10);emit('在点击位置注入示踪点。');}if(v==='gravity')burst(x,y);},
    metric(){return '个体 '+bodies.length+' · 平均速率 '+(bodies.reduce((s,b)=>s+Math.hypot(b.vx,b.vy),0)/Math.max(1,bodies.length)).toFixed(1);},
    draw(c,t,dt){const old=bodies.map(b=>({...b}));bodies.forEach((b,i)=>{
      if(v==='particles'){b.vy+=p.rate*dt;b.vx*=.999;b.vy*=.999;}
      if(v==='fluid'){const dx=(b.x-240)/140,dy=(b.y-100)/100;b.vx=direction*(-dy*40+Math.sin(dy*3+t*.3)*18)*p.amount;b.vy=direction*(dx*25+Math.cos(dx*3+t*.3)*12)*p.amount;}
      if(v==='boids'){let ax=0,ay=0,sx=0,sy=0,cx=0,cy=0,n=0;old.forEach((a,j)=>{if(i===j)return;const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<p.spread){ax+=a.vx;ay+=a.vy;cx+=a.x;cy+=a.y;n++;if(d<16){sx-=dx/(d*d+1);sy-=dy/(d*d+1);}}});if(n){b.vx+=((ax/n-b.vx)*.5+(cx/n-b.x)*.2+sx*150)*dt;b.vy+=((ay/n-b.vy)*.5+(cy/n-b.y)*.2+sy*150)*dt;}if(target){b.vx+=(target[0]-b.x)*dt*.12;b.vy+=(target[1]-b.y)*dt*.12;}const speed=Math.hypot(b.vx,b.vy)||1;if(speed>48){b.vx*=48/speed;b.vy*=48/speed;}}
      if(v==='gravity'){const dx=240-b.x,dy=100-b.y,d2=dx*dx+dy*dy+120,force=p.amount*900/Math.pow(d2,1.5);b.vx+=dx*force*dt;b.vy+=dy*force*dt;}
      b.x+=b.vx*dt;b.y+=b.vy*dt;if(v==='particles'){if(b.x<4||b.x>476){b.vx*=-.85;b.x=clamp(b.x,4,476);}if(b.y<4||b.y>196){b.vy*=-.85;b.y=clamp(b.y,4,196);}}else if(v!=='gravity'){b.x=(b.x+W)%W;b.y=(b.y+H)%H;}
      if(v==='fluid'||v==='gravity'){b.trail.push([b.x,b.y]);if(b.trail.length>35)b.trail.shift();path(c,b.trail,i%2?PURPLE:GOLD,.8);}
      dot(c,b.x,b.y,v==='boids'?2:2.3,[GOLD,PURPLE,RED,BLUE][i%4]);
      if(v==='boids')line(c,b.x,b.y,b.x-b.vx*.12,b.y-b.vy*.12,PURPLE);
    });if(v==='gravity')dot(c,240,100,8,RED);if(target)dot(c,...target,6,RED);}
  };
}
function makeQuantum(v,p,emit,set){
  let counts=[0,0,0,0],samples=0,gateCount=0,state=[];
  const prepare=()=>{const a=p.amount*DEG/2,f=p.spread*DEG;state=[[Math.cos(a),0],[Math.sin(a)*Math.cos(f),Math.sin(a)*Math.sin(f)]];counts=[0,0,0,0];samples=0;gateCount=0;};
  prepare();
  const probability=()=>v==='bloch'?Math.cos(p.amount*DEG/2)**2:v==='interference'?(1+p.spread*Math.cos(p.amount*DEG))/2:v==='gates'?state[0][0]**2+state[0][1]**2:Math.cos(p.amount*DEG)**2*(1-p.spread)+p.spread*.5;
  const sample=n=>{for(let i=0;i<n;i++){if(v==='bell'){const a=Math.random()<.5?0:1,same=Math.random()<probability(),b=same?a:1-a;counts[a*2+b]++;}else counts[Math.random()<probability()?0:1]++;}samples+=n;emit('本地抽样 '+n+' 次；累计 '+samples+' 次。'+(v==='bell'?'统计不是真实物理 Bell 检验。':''));};
  return {hint:v==='gates'?'应用 H 或 X 门会真正更新复数振幅，参数变化重新制备初态。':'概率按数学公式计算；抽样来自本地伪随机数，不连接量子硬件。',
    action(a){if(v==='bloch'){if(a==='measure')sample(100);else{counts=[0,0,0,0];samples=0;emit('已重新制备参数指定的纯态。');}}
      if(v==='interference'){if(a==='phase')set('amount',(p.amount+180)%360);else sample(200);}
      if(v==='bell'){if(a==='sample')sample(200);else{counts=[0,0,0,0];samples=0;emit('关联统计已清空。');}}
      if(v==='gates'){if(a==='apply-x')state=[state[1],state[0]];else{const [a,b]=state;state=[[ (a[0]+b[0])/Math.SQRT2,(a[1]+b[1])/Math.SQRT2],[(a[0]-b[0])/Math.SQRT2,(a[1]-b[1])/Math.SQRT2]];}gateCount++;emit('已应用 '+(a==='apply-x'?'X':'H')+' 门；P(0)='+probability().toFixed(3)+'。');}},
    parameter(){prepare();},
    pointer(x,y){if(v==='bloch')set('amount',clamp((y-20)/160*180,0,180));if(v==='interference')set('amount',clamp(x/W*360,0,360));},
    metric(){return v==='bell'?'同基关联概率 '+probability().toFixed(3)+' · 样本 '+samples:v==='gates'?'P(0) '+probability().toFixed(3)+' · 门数量 '+gateCount:'P(0) '+probability().toFixed(3)+' · 样本 '+samples;},
    draw(c){const pr=clamp(probability(),0,1);
      if(v==='bloch'){const cx=150,cy=100,r=70;c.strokeStyle='#b198e788';c.beginPath();c.arc(cx,cy,r,0,TAU);c.stroke();c.beginPath();c.ellipse(cx,cy,r,r*.28,0,0,TAU);c.stroke();line(c,cx,cy-r,cx,cy+r,'#ffffff44');const a=p.amount*DEG,f=p.spread*DEG;const x=cx+r*Math.sin(a)*Math.cos(f),y=cy-r*Math.cos(a)+r*.25*Math.sin(a)*Math.sin(f);line(c,cx,cy,x,y,RED,2);dot(c,x,y,5,RED);label(c,'|0⟩',cx-10,20);label(c,'|1⟩',cx-10,190);c.fillStyle=GOLD;c.fillRect(300,150-pr*110,45,pr*110);c.fillStyle=PURPLE;c.fillRect(360,150-(1-pr)*110,45,(1-pr)*110);label(c,'P(0)',303,173);label(c,'P(1)',363,173);}
      if(v==='interference'){const pts=[];for(let i=0;i<420;i+=2)pts.push([30+i,100-Math.cos(i/30+p.amount*DEG)*40*p.spread]);path(c,pts,PURPLE,1.7);line(c,30,100,450,100,'#ffffff22');label(c,'探测端 0：'+(pr*100).toFixed(1)+'%',25,25,GOLD,13);label(c,'探测端 1：'+((1-pr)*100).toFixed(1)+'%',265,25,RED,13);c.fillStyle=GOLD;c.fillRect(30,172,420*pr,7);}
      if(v==='bell'){const labels=['00','01','10','11'];labels.forEach((s,i)=>{const x=85+i*90,z=samples?counts[i]/samples:(i===0||i===3?pr/2:(1-pr)/2);c.fillStyle=i===0||i===3?GOLD:PURPLE;c.fillRect(x,150-z*180,50,z*180);label(c,s,x+16,173);label(c,(z*100).toFixed(1)+'%',x+6,190,WHITE,10);});label(c,'理想关联公式 + 本地抽样',25,22);}
      if(v==='gates'){label(c,'|ψ⟩ = α|0⟩ + β|1⟩',30,35,PURPLE,15);state.forEach((a,i)=>{label(c,(i?'β':'α')+' = '+a[0].toFixed(3)+(a[1]<0?' − ':' + ')+Math.abs(a[1]).toFixed(3)+'i',35,78+i*30,GOLD,13);});c.fillStyle=GOLD;c.fillRect(280,145-pr*105,45,pr*105);c.fillStyle=PURPLE;c.fillRect(350,145-(1-pr)*105,45,(1-pr)*105);label(c,'P(0)',283,172);label(c,'P(1)',353,172);label(c,'归一化 '+(state.flat().reduce((s,x)=>s+x*x,0)).toFixed(3),30,165);}
    }
  };
}

function makeLife(v,p,emit,set){
  let rotation=0,measured=false,cluster=new Set(),pending=0,walker=null,chain=[],steps=0,energy=0;
  const N=64,M=28;let a=new Float32Array(N*M),b=new Float32Array(N*M),na=new Float32Array(N*M),nb=new Float32Array(N*M);
  const buffer=document.createElement('canvas');buffer.width=N;buffer.height=M;const bc=buffer.getContext('2d'),image=bc.createImageData(N,M);
  const seed=()=>{cluster=new Set(['60,25']);pending=0;walker=null;};
  const reactionSeed=()=>{a.fill(1);b.fill(0);for(let y=11;y<17;y++)for(let x=29;x<35;x++){const k=y*N+x;a[k]=.5;b[k]=.25+Math.random()*.2;}steps=0;};
  const pulse=(x=240,y=100)=>{const gx=Math.round(x/W*N),gy=Math.round(y/H*M);for(let y=gy-2;y<=gy+2;y++)for(let x=gx-2;x<=gx+2;x++){const k=((y+M)%M)*N+(x+N)%N;b[k]=.8;a[k]=.3;}emit('在局部网格注入 B 组分扰动。');};
  const scramble=()=>{chain=Array.from({length:p.amount},(_,i)=>[110+i*17,80+Math.sin(i*1.5)*30+(Math.random()-.5)*15]);energy=chainEnergy();};
  const chainEnergy=()=>{let e=0;for(let i=1;i<chain.length;i++)e+=(Math.hypot(chain[i][0]-chain[i-1][0],chain[i][1]-chain[i-1][1])-18)**2;for(const [x,y]of chain)e+=.002*((x-240)**2+(y-100)**2);return e;};
  const relax=()=>{const old=chainEnergy();for(let iter=0;iter<25;iter++){for(let i=0;i<chain.length;i++){let gx=.004*(chain[i][0]-240),gy=.004*(chain[i][1]-100);for(const j of [i-1,i+1])if(j>=0&&j<chain.length){const dx=chain[i][0]-chain[j][0],dy=chain[i][1]-chain[j][1],d=Math.hypot(dx,dy)||1;gx+=2*(d-18)*dx/d;gy+=2*(d-18)*dy/d;}chain[i][0]-=p.rate*gx;chain[i][1]-=p.rate*gy;}}energy=chainEnergy();emit('简化珠链能量 '+old.toFixed(1)+' → '+energy.toFixed(1)+'。不是蛋白质预测。');};
  seed();reactionSeed();scramble();
  const growStep=()=>{if(!pending)return;if(!walker){const angle=Math.random()*TAU,radius=Math.min(20,5+Math.sqrt(cluster.size)*1.4);walker=[Math.round(60+Math.cos(angle)*radius),Math.round(25+Math.sin(angle)*radius)];}for(let i=0;i<500&&walker;i++){const d=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)];walker[0]+=d[0];walker[1]+=d[1];const [x,y]=walker;if(x<2||x>117||y<2||y>47){walker=null;break;}const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>cluster.has((x+dx)+','+(y+dy)));if(adjacent&&Math.random()<p.rate){cluster.add(x+','+y);pending--;walker=null;}}};
  return {hint:({molecule:'键角与键长改变三原子示意几何；测量显示外侧原子间距。',growth:'释放粒子后，随机游走与邻接黏附会逐步形成聚集体。',reaction:'实时积分 Gray–Scott 方程；点击画布加入局部扰动。',folding:'降低简化珠链能量，比较优化前后；不运行 AlphaFold。'})[v],
    action(action){if(v==='molecule'){if(action==='rotate'){rotation+=Math.PI/4;emit('几何构型旋转 45°。');}else{measured=!measured;emit('外侧原子距离 = 2L·sin(θ/2) = '+(2*p.spread*Math.sin(p.amount*DEG/2)).toFixed(3)+'。');}}
      if(v==='growth'){if(action==='grow'){pending+=p.amount;emit('排队释放 '+p.amount+' 个随机游走粒子。');}else{seed();emit('聚集体已重新播种。');}}
      if(v==='reaction'){if(action==='pulse')pulse();else{reactionSeed();emit('浓度场已经重置。');}}
      if(v==='folding'){if(action==='relax')relax();else{scramble();emit('珠链构型已扰动，能量 '+energy.toFixed(1)+'。');}}},
    parameter(key){if(v==='folding'&&key==='amount')scramble();},
    pointer(x,y){if(v==='reaction')pulse(x,y);if(v==='growth'){cluster.add(clamp(Math.round(x/4),2,117)+','+clamp(Math.round(y/4),2,47));emit('添加一个新的附着种子。');}if(v==='molecule'){rotation=Math.atan2(y-100,x-240);emit('构型朝向已更新。');}if(v==='folding'){chain[Math.floor(chain.length/2)]=[x,y];energy=chainEnergy();emit('中部珠点已移动。');}},
    metric(){if(v==='molecule')return '键角 '+p.amount+'° · 键长 '+p.spread;if(v==='growth')return '聚集 '+cluster.size+' · 等待 '+pending;if(v==='reaction')return 'F '+p.amount.toFixed(3)+' · k '+p.rate.toFixed(3)+' · 迭代 '+steps;return '简化能量 '+energy.toFixed(2)+' · 珠点 '+chain.length;},
    draw(c,t){if(v==='molecule'){const cx=240,cy=95,r=65*p.spread,angle=p.amount*DEG/2;const pts=[rotation-angle,rotation+angle].map(a=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r]);pts.forEach(pt=>{line(c,cx,cy,...pt,GOLD,6);dot(c,...pt,13,WHITE);});dot(c,cx,cy,20,RED);if(measured){line(c,...pts[0],...pts[1],PURPLE,1.5);label(c,'d = '+(2*p.spread*Math.sin(angle)).toFixed(3),25,25,PURPLE);}label(c,'三原子球棍几何示意',20,185,GOLD);}
      if(v==='growth'){for(let i=0;i<3;i++)growStep();for(const key of cluster){const [x,y]=key.split(',').map(Number);dot(c,x*4,y*4,2.4,(x+y)%2?GOLD:PURPLE);}if(walker)dot(c,walker[0]*4,walker[1]*4,2,RED);}
      if(v==='reaction'){for(let s=0;s<3;s++){for(let y=0;y<M;y++)for(let x=0;x<N;x++){const k=y*N+x,l=y*N+(x+N-1)%N,r=y*N+(x+1)%N,u=((y+M-1)%M)*N+x,d=((y+1)%M)*N+x,ab=a[k]*b[k]*b[k];na[k]=clamp(a[k]+.16*(a[l]+a[r]+a[u]+a[d]-4*a[k])-ab+p.amount*(1-a[k]),0,1);nb[k]=clamp(b[k]+.08*(b[l]+b[r]+b[u]+b[d]-4*b[k])+ab-(p.rate+p.amount)*b[k],0,1);}let q=a;a=na;na=q;q=b;b=nb;nb=q;steps++;}for(let k=0;k<N*M;k++){const z=clamp(b[k]*3.5,0,1);image.data[k*4]=Math.round(24+z*195);image.data[k*4+1]=Math.round(20+z*110);image.data[k*4+2]=Math.round(43+z*105);image.data[k*4+3]=255;}bc.putImageData(image,0,0);c.imageSmoothingEnabled=true;c.drawImage(buffer,0,0,W,H);}
      if(v==='folding'){path(c,chain,PURPLE,3);chain.forEach((pt,i)=>dot(c,...pt,5,i%3?GOLD:RED));label(c,'简化二维珠链 · 参数不代表真实蛋白质',20,185,WHITE,10);}
    },dispose(){buffer.width=0;buffer.height=0;}
  };
}
function makeOptics(v,p,emit,set){
  let n1=1,mono=false,material=0,lightAngle=35,middle=false,records=[];
  const refract=()=>{const theta=p.amount*DEG,s=n1/p.spread*Math.sin(theta);return {theta,angle:Math.abs(s)<=1?Math.asin(s):null};};
  return {hint:({refraction:'入射角与介质决定折射角；交换介质可观察全反射。',dispersion:'不同波长使用不同简化折射率，光束会展开。',brdf:'粗糙度会改变高光瓣宽度，金属权重改变两类反射的比例。',polarization:'透过率按 cos² 计算，插入中间偏振片形成两次透射。'})[v],
    action(a){if(v==='refraction'){if(a==='swap'){n1=n1===1?1.5:1;set('spread',n1===1?1.5:1);emit('介质已交换：n₁='+n1+'，n₂='+p.spread+'。');}else{const r=refract();records.push(r.angle===null?'全反射':(r.angle/DEG).toFixed(1)+'°');if(records.length>4)records.shift();emit('记录：'+records.join(' / ')+'。');}}
      if(v==='dispersion'){if(a==='white')mono=!mono;else set('spread',p.spread<.18?.24:.08);emit(mono?'只显示中间波长光束。':'显示五种波长的简化光路。');}
      if(v==='brdf'){if(a==='material'){material=1-material;set('spread',material?1:.1);emit(material?'更偏向金属高光的示意材质。':'更偏向漫反射的示意材质。');}else{lightAngle=lightAngle===35?-35:35;emit('光源切换到另一侧。');}}
      if(v==='polarization'){if(a==='insert'){middle=!middle;emit(middle?'加入中间偏振片，计算两次透射。':'移除中间偏振片。');}else{set('amount',90);emit('两端偏振器设为正交。');}}},
    pointer(x,y){if(v==='refraction')set('amount',clamp((x-30)/420*85,0,85));if(v==='brdf'){lightAngle=clamp((x-W/2)/W*140,-70,70);emit('光源角度 '+lightAngle.toFixed(0)+'°。');}if(v==='polarization')set('amount',clamp(x/W*180,0,180));},
    metric(){if(v==='refraction'){const r=refract();return r.angle===null?'全反射 · 无透射光':'折射角 '+(r.angle/DEG).toFixed(2)+'°';}if(v==='dispersion')return '简化色散 Δn '+p.spread.toFixed(2)+' · '+(mono?'单色':'五色');if(v==='brdf')return '粗糙度 '+p.amount.toFixed(2)+' · 金属 '+p.spread.toFixed(2);const z=middle?Math.cos(p.spread*DEG)**2*Math.cos((p.amount-p.spread)*DEG)**2:Math.cos(p.amount*DEG)**2;return '相对透过率 '+(z*100).toFixed(2)+'%';},
    draw(c){if(v==='refraction'){const r=refract(),x=240,y=95,L=95;c.fillStyle='#b198e721';c.fillRect(0,y,W,H-y);line(c,0,y,W,y,PURPLE);line(c,x,5,x,195,'#ffffff66');const ix=x-Math.sin(r.theta)*L,iy=y-Math.cos(r.theta)*L;line(c,ix,iy,x,y,GOLD,2.5);if(r.angle!==null)line(c,x,y,x+Math.sin(r.angle)*L,y+Math.cos(r.angle)*L,RED,2.5);else line(c,x,y,x+Math.sin(r.theta)*L,y-Math.cos(r.theta)*L,RED,2.5);label(c,'n₁ = '+n1,25,35,GOLD);label(c,'n₂ = '+p.spread,25,165,PURPLE);label(c,r.angle===null?'全反射':'斯涅尔定律 n₁sinθ₁ = n₂sinθ₂',280,170,WHITE,10);}
      if(v==='dispersion'){const x=220,y=95;c.fillStyle='#b198e733';c.beginPath();c.moveTo(210,25);c.lineTo(300,165);c.lineTo(135,165);c.closePath();c.fill();line(c,25,95,x,y,WHITE,2.5);const colors=[PURPLE,BLUE,GOLD,'#eaa567',RED];colors.forEach((col,i)=>{if(mono&&i!==2)return;const n=1.45+(4-i)*p.spread*.2,ang=Math.asin(Math.sin(p.amount*DEG)/n);line(c,x,y,455,y+(ang-.25)*270,col,2);label(c,String([420,470,590,620,680][i])+' nm',395,25+i*17,col,9);});}
      if(v==='brdf'){const cx=240,cy=175;line(c,30,cy,450,cy,'#ffffff66');line(c,cx,cy,cx,20,'#ffffff22');const pts=[];for(let i=-90;i<=90;i++){const a=i*DEG,diff=Math.max(0,Math.cos(a))*.45,spec=Math.exp(-(((i+lightAngle)/(4+p.amount*45))**2));const z=((1-p.spread)*diff+p.spread*spec)*125;pts.push([cx+Math.sin(a)*z,cy-Math.cos(a)*z]);}path(c,pts,GOLD,2);line(c,cx-Math.sin(lightAngle*DEG)*130,cy-Math.cos(lightAngle*DEG)*130,cx,cy,RED,2);label(c,'简化反射分布',25,25,PURPLE);dot(c,cx,cy,5,WHITE);}
      if(v==='polarization'){const axes=middle?[0,p.spread,p.amount]:[0,p.amount],x0=middle?100:155,gap=middle?140:180;let intensity=1;axes.forEach((a,i)=>{const x=x0+i*gap;if(i)intensity*=Math.cos((a-axes[i-1])*DEG)**2;c.strokeStyle='#b198e777';c.beginPath();c.ellipse(x,100,34,68,0,0,TAU);c.stroke();for(let j=-3;j<=3;j++){const dx=Math.sin(a*DEG)*50,dy=Math.cos(a*DEG)*50;line(c,x+j*6-dx,100-dy,x+j*6+dx,100+dy,PURPLE,.9);}label(c,a.toFixed(0)+'°',x-10,182);if(i<axes.length-1)line(c,x+35,100,x+gap-35,100,'rgba(223,184,121,'+Math.max(.05,intensity)+')',3);});label(c,'输入',25,100,GOLD);label(c,'输出 '+(intensity*100).toFixed(1)+'%',370,25,GOLD);}
    }
  };
}
function makeArt(v,p,emit,set){
  let lorenz=[.1,0,0],other=[.10001,0,0],trace=[],trace2=[],mode=0,phase=0,time=0,curve=[],pulse=0;
  const reset=()=>{lorenz=[.1,0,0];other=[.10001,0,0];trace=[];trace2=[];time=0;curve=[];};
  const integrate=s=>{const [x,y,z]=s,h=.005;return [x+h*p.rate*(y-x),y+h*(x*(p.amount-z)-y),z+h*(x*y-8/3*z)];};
  const lsystem=()=>{let text='F';for(let i=0;i<p.amount;i++)text=text.replace(/F/g,mode?'F[+F]F[-F]F':'F[+F][-F]');const stack=[],pts=[];let x=240,y=188,a=-Math.PI/2,length=mode?100/3**p.amount:110/1.7**p.amount;for(const s of text){if(s==='F'){const nx=x+Math.cos(a)*length,ny=y+Math.sin(a)*length;pts.push([[x,y],[nx,ny]]);x=nx;y=ny;}if(s==='+')a+=p.spread*DEG;if(s==='-')a-=p.spread*DEG;if(s==='[')stack.push([x,y,a]);if(s===']')[x,y,a]=stack.pop();}return pts;};
  const segments=()=>lsystem().length;
  return {hint:({attractor:'微扰后比较两条数值轨迹；参数不同会改变吸引子结构。',lsystem:'重写字符串并逐段绘制分枝，可切换规则与迭代代数。',waves:'显示两组二维波函数叠加；亮线表示接近零的节点。',harmonograph:'两个阻尼摆动叠加为轨迹；频率比、相位和阻尼决定形态。'})[v],
    action(a){if(v==='attractor'){if(a==='reset'){reset();emit('Lorenz 初值与轨迹已重置。');}else{other=[...lorenz];other[0]+=.0001;trace2=[];emit('第二条轨迹的 x 初值增加 0.0001。');}}
      if(v==='lsystem'){if(a==='rule'){mode=1-mode;emit('重写规则：'+(mode?'F → F[+F]F[-F]F':'F → F[+F][-F]')+'。');}else{set('amount',p.amount<5?p.amount+1:1);emit('迭代深度 '+p.amount+'，生成 '+segments()+' 条线段。');}}
      if(v==='waves'){if(a==='phase'){phase+=Math.PI;emit('第二组波的相位翻转 π。');}else{pulse=1;emit('局部圆形波扰动已加入。');}}
      if(v==='harmonograph'){if(a==='phase')phase+=Math.PI/3;time=0;curve=[];emit('按当前参数重新绘制阻尼谐振轨迹。');}},
    parameter(){if(v==='attractor'||v==='harmonograph')reset();},
    pointer(x,y){if(v==='attractor'){lorenz=[(x-240)/20,(y-100)/10,20];trace=[];emit('第一条轨迹已设置新的初值。');}if(v==='waves'){pulse=1;phase=x/W*TAU;emit('扰动与相位已更新。');}if(v==='harmonograph'){phase=x/W*TAU;curve=[];time=0;emit('初始相位已更新。');}},
    metric(){if(v==='attractor')return '轨迹 '+trace.length+' · 间距 '+Math.hypot(...lorenz.map((x,i)=>x-other[i])).toFixed(4);if(v==='lsystem')return '第 '+p.amount+' 代 · 线段 '+segments();if(v==='waves')return '模态 '+p.amount+' × '+p.spread+' · 相位 '+(phase/Math.PI).toFixed(1)+'π';return '轨迹 '+curve.length+' · 时间 '+time.toFixed(1);},
    draw(c,t,dt){if(v==='attractor'){for(let i=0;i<5;i++){lorenz=integrate(lorenz);other=integrate(other);if(!lorenz.every(Number.isFinite)){reset();break;}trace.push([240+lorenz[0]*5,190-lorenz[2]*3.4]);trace2.push([240+other[0]*5,190-other[2]*3.4]);}if(trace.length>1600)trace.splice(0,5);if(trace2.length>1600)trace2.splice(0,5);path(c,trace,GOLD,1);path(c,trace2,PURPLE,.7);}
      if(v==='lsystem'){const seg=lsystem();seg.forEach(([a,b],i)=>line(c,...a,...b,i%3?GOLD:PURPLE,1.2));label(c,mode?'F[+F]F[-F]F':'F[+F][-F]',15,22,PURPLE);}
      if(v==='waves'){pulse=Math.max(0,pulse-dt*.2);for(let y=0;y<H;y+=5)for(let x=0;x<W;x+=5){const a=Math.cos(p.amount*Math.PI*x/W)*Math.cos(p.spread*Math.PI*y/H),b=Math.cos(p.spread*Math.PI*x/W)*Math.cos(p.amount*Math.PI*y/H+phase),r=Math.hypot(x-240,y-100);const z=a-b+pulse*Math.cos(r*.08-t*4)*Math.exp(-r/100);c.fillStyle=Math.abs(z)<.1?GOLD:z>0?'#654354':'#30274c';c.fillRect(x,y,5,5);}}
      if(v==='harmonograph'){for(let i=0;i<14;i++){time+=.015;const amp=Math.exp(-p.rate*time),x=240+180*amp*Math.sin(time*2+phase),y=100+80*amp*Math.sin(time*2*p.amount+Math.PI/3);curve.push([x,y]);}if(curve.length>2200)curve.splice(0,14);path(c,curve,GOLD,.8);}
    }
  };
}


