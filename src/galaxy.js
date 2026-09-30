import * as THREE from 'three';
/* Astronomy-inspired procedural disk, not measured reconstruction.
References: https://science.nasa.gov/asset/hubble/the-two-faced-whirlpool-galaxy/
https://www.eso.org/public/images/MW_central_part_bardon18-CC/
No external textures, DOM, timers or render loop. */
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
function hash(x,z){return fract(Math.sin(x*127.1+z*311.7)*43758.5453123);}
function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;}
function fbm(x,z){return .57*noise(x,z)+.28*noise(x*2.03+4.1,z*2.03-2.7)+.15*noise(x*4.11-7.4,z*4.11+8.2);}
function armAngle(r,arm=0){return 2.65*Math.log(r+.075)+(arm?Math.PI+.19:.25)+.13*Math.sin(r*11+arm*2)+.045*Math.sin(r*31);}
function angleDistance(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function dustAt(x,z){const r=Math.hypot(x,z),a=Math.atan2(z,x),bend=(fbm(x*7.4+3,z*7.4-4)-.5)*.38;let dust=0;for(let arm=0;arm<2;arm++){const delta=angleDistance(a,armAngle(r,arm)+.20+bend);const width=.025+.045*r;dust=Math.max(dust,Math.exp(-delta*delta/(width*width)));}
const grain=fbm(x*23.1+5,z*23.1+2),filament=smooth(.43,.72,grain);
return clamp(dust*(.48+.52*filament)*smooth(.08,.2,r)*(1-smooth(.86,1.08,r)),0,1);}
const COMMON=`
uniform float uTime;uniform float uRatio;uniform float uReveal;uniform vec3 uGravity;
uniform float uPull;uniform float uWave;uniform float uWarp;uniform float uDim;uniform float uGalaxyRadius;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.53;mat2 m=mat2(1.61,1.21,-1.21,1.61);for(int i=0;i<4;i++){s+=a*noise21(p);p=m*p+vec2(4.3,-2.8);a*=.48;}return s;}
float spiral(float r,float arm){return 2.65*log(r+.075)+mix(.25,3.33159265,arm)+.13*sin(r*11.+arm*2.)+.045*sin(r*31.);}
float angularDistance(float a,float b){return atan(sin(a-b),cos(a-b));}
vec2 rotate2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
float drift(float r){return uTime*.00055/(.45+r);}
`;
const STAR_VERTEX=`
attribute vec3 aColor;attribute float aSize;attribute float aPhase;attribute float aOpacity;attribute float aDust;
varying vec3 vColor;varying float vOpacity;
${COMMON}
void main(){
vec3 p=position;float r=length(p.xz),rn=r/uGalaxyRadius;
p.xz=rotate2(p.xz,drift(rn));p.y+=sin(uTime*.045+aPhase)*uGalaxyRadius*.0008;
vec3 world=(modelMatrix*vec4(p,1.)).xyz;vec3 attraction=uGravity-world;float dist=length(attraction);
vec3 localAttraction=(vec4(attraction,0.)*modelMatrix).xyz;
p+=localAttraction*uPull*exp(-dist/max(1.,uGalaxyRadius*.35))*.12;
float wave=exp(-pow((r-uWave)/max(.35,uGalaxyRadius*.034),2.));
p.y+=wave*sin(aPhase)*uGalaxyRadius*.017;p.xz*=1.+wave*.018;
p*=.10+.90*uReveal;p.z+=uWarp*sin(aPhase)*uGalaxyRadius*.025;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
gl_PointSize=clamp(aSize*uRatio*205./max(.5,-mv.z),.65,5.2);
vec3 cameraLocal=(vec4(cameraPosition-modelMatrix[3].xyz,0.)*modelMatrix).xyz;
float side=cameraLocal.y<0.?-1.:1.;
float behind=1.-smoothstep(-uGalaxyRadius*.013,uGalaxyRadius*.013,side*position.y);
float extinction=1.-aDust*(.32+.60*behind);
float rare=step(6.11,aPhase),flicker=1.+rare*.11*sin(uTime*.14+aPhase*2.);
vColor=aColor*(1.+wave*.16);vOpacity=aOpacity*extinction*flicker*uDim*smoothstep(0.,.15,uReveal);}
`;
const STAR_FRAGMENT=`
varying vec3 vColor;varying float vOpacity;
void main(){vec2 p=gl_PointCoord*2.-1.;float d=dot(p,p);if(d>1.)discard;
float core=exp(-d*7.5),halo=exp(-d*3.8)*.13;float alpha=(core+halo)*vOpacity;
if(alpha<.006)discard;gl_FragColor=vec4(vColor,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function shaderUniforms(uniforms,radius,extra={}){
const fallbacks={uTime:{value:0},uRatio:{value:1},uReveal:{value:1},uGravity:{value:new THREE.Vector3()},uPull:{value:0},uWave:{value:-30},uWarp:{value:0},uDim:{value:1}};
return {...fallbacks,...uniforms,uGalaxyRadius:{value:radius},...extra};}
export function createGalacticCloud(count,radius,random=Math.random,uniforms={}){
count=Math.max(1,Math.floor(count));radius=Math.max(.01,Number(radius)||29);
const rand=()=>clamp(Number(random()),.0000001,.9999999);
const normal=()=>Math.sqrt(-2*Math.log(rand()))*Math.cos(TAU*rand());
const positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count),opacities=new Float32Array(count),dust=new Float32Array(count);
const clusters=Array.from({length:48},(_,i)=>{const arm=i%2,r=.19+.77*rand(),a=armAngle(r,arm)+(rand()-.5)*.08;return {x:Math.cos(a)*r,z:Math.sin(a)*r,width:.005+rand()*.013,red:rand()<.20};});
for(let i=0;i<count;i++){
const population=rand();let x=0,y=0,z=0,r=0,young=false,nebula=false,bulge=false,halo=false;
if(population<.255){bulge=true;const spread=.022+.055*Math.pow(rand(),.6);x=normal()*spread;z=normal()*spread*.87;y=normal()*spread*.63;}
else if(population<.695){r=.10+.91*Math.pow(rand(),.78);const arm=rand()<.55?0:1;const a=armAngle(r,arm)+normal()*(.045+.14*r)+.028*Math.sin(r*54+arm*3);x=Math.cos(a)*r;z=Math.sin(a)*r;y=normal()*(.005+.009*r);young=rand()<.44;nebula=young&&rand()<.075;}
else if(population<.805){const c=clusters[Math.floor(rand()*clusters.length)];x=c.x+normal()*c.width;z=c.z+normal()*c.width;y=normal()*.006;young=!c.red;nebula=c.red;}
else if(population<.978){r=Math.min(1.02,-Math.log(rand()*rand())*.18);const a=TAU*rand();x=Math.cos(a)*r;z=Math.sin(a)*r;y=normal()*(.006+.007*r);}
else{halo=true;const a=TAU*rand(),q=rand()*2-1,s=Math.sqrt(1-q*q);r=.08+.97*Math.pow(rand(),.7);x=Math.cos(a)*s*r;z=Math.sin(a)*s*r;y=q*r*.32;}
const radial=Math.hypot(x,z);if(radial>1.04){x*=1.04/radial;z*=1.04/radial;}
positions.set([x*radius,y*radius,z*radius],i*3);
const brightness=.46+Math.pow(rand(),5)*.78,rare=rand()<.004;
let color=bulge?[1.04,.84,.60]:nebula?[.72,.29,.36]:young?[.72,.83,1.01]:[.88,.79,.66];
if(halo)color=[.60,.57,.54];if(!bulge&&!young&&!nebula&&rand()<.08)color=[.89,.59,.43];
dust[i]=dustAt(x,z);const b=brightness*(rare?1.85:1);colors.set(color.map(v=>v*b),i*3);
sizes[i]=(.27+Math.pow(rand(),9)*1.03+(rare?.50:0))*Math.pow(radius/29,.72);
phases[i]=rare?6.12+rand()*.15:rand()*6.10;opacities[i]=(bulge?.25:halo?.09:young?.42:nebula?.26:.22)*(rare?1.35:1);
}
const geometry=new THREE.BufferGeometry();
for(const [name,array,itemSize]of [['position',positions,3],['aColor',colors,3],['aSize',sizes,1],['aPhase',phases,1],['aOpacity',opacities,1],['aDust',dust,1]])geometry.setAttribute(name,new THREE.BufferAttribute(array,itemSize));
geometry.computeBoundingSphere();
const material=new THREE.ShaderMaterial({vertexShader:STAR_VERTEX,fragmentShader:STAR_FRAGMENT,uniforms:shaderUniforms(uniforms,radius),transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,toneMapped:true});
const points=new THREE.Points(geometry,material);points.name='Galactic stellar populations';points.frustumCulled=false;points.renderOrder=0;
points.userData={stellarCount:count,radius,populations:'bulge / spiral / young clusters / disk / halo',procedural:true};return points;
}
const HAZE_VERTEX=`
varying vec2 vUv;varying vec3 vWorld;varying vec3 vPlaneNormal;
${COMMON}
void main(){vUv=uv;vPlaneNormal=normalize(mat3(modelMatrix)*vec3(0.,0.,1.));vec3 p=position;p.xy*=.10+.90*uReveal;
p.z+=sin(length(p.xy)/uGalaxyRadius*13.+uTime*.04)*uWarp*uGalaxyRadius*.004;
vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
`;
const HAZE_FRAGMENT=`
varying vec2 vUv;varying vec3 vWorld;varying vec3 vPlaneNormal;uniform float uLayer;uniform float uDustLayer;
${COMMON}
void main(){
vec2 q=(vUv-.5)*2.16;float r=length(q);if(r>1.08)discard;
q=rotate2(q,-drift(r));float a=atan(q.y,q.x);
vec2 warp=vec2(fbm(q*6.7+2.),fbm(q*6.7-4.));vec2 p=q+(warp-.5)*.055;
float n=fbm(p*12.8+uLayer*2.31),fine=fbm(p*35.7-uLayer*.73),arms=0.,dust=0.;
for(int i=0;i<2;i++){float arm=float(i),delta=angularDistance(a,spiral(r,arm));arms=max(arms,exp(-pow(delta/(.055+.15*r),2.)));
float lane=angularDistance(a,spiral(r,arm)+.20+(fbm(p*7.4+vec2(3.,-4.))-.5)*.38);dust=max(dust,exp(-pow(lane/(.025+.045*r),2.)));}
float edge=1.-smoothstep(.80,1.07,r),inner=smoothstep(.035,.15,r),clump=smoothstep(.29,.74,n)*(.4+.6*fine);
float disc=exp(-r*2.9)*(.45+.55*n),armCloud=arms*clump*inner*edge,bulge=exp(-r*r/0.014)*(.8+.2*fine);
vec3 viewDir=normalize(cameraPosition-vWorld);float facing=abs(dot(vPlaneNormal,viewDir));
float edgeFade=.25+.75*smoothstep(.015,.13,facing),reveal=smoothstep(0.,.20,uReveal),alpha;vec3 color;
if(uDustLayer>.5){float filament=smoothstep(.39,.75,fbm(p*23.1+vec2(5.,2.)));
float extinction=dust*(.48+.52*filament)*smoothstep(.08,.2,r)*edge;alpha=extinction*.22*uDim*reveal*edgeFade;color=vec3(.018,.012,.016);}
else{float redPatch=smoothstep(.66,.81,fbm(p*18.5+vec2(13.,7.)))*armCloud;
vec3 oldStars=vec3(.58,.43,.27),youngStars=vec3(.29,.37,.47),wine=vec3(.34,.10,.15);
color=mix(oldStars,youngStars,clamp(arms*inner*.70,0.,1.));color=mix(color,wine,redPatch*.78);color=mix(color,vec3(.76,.60,.38),bulge*.62);
alpha=(disc*.070+armCloud*.11+bulge*.10)*edge*uDim*reveal*edgeFade;alpha*=1.-dust*.58*inner;}
if(alpha<.0008)discard;gl_FragColor=vec4(color,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function createGalacticHaze(radius,uniforms={}){
radius=Math.max(.01,Number(radius)||29);const group=new THREE.Group();group.name='Galactic gas and dust depth layers';
const offsets=[-.017,-.006,.008,.017,.024];
for(let i=0;i<offsets.length;i++){const dust=i===2||i===4;
const material=new THREE.ShaderMaterial({vertexShader:HAZE_VERTEX,fragmentShader:HAZE_FRAGMENT,uniforms:shaderUniforms(uniforms,radius,{uLayer:{value:i*.47},uDustLayer:{value:dust?1:0}}),transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,toneMapped:true,side:THREE.DoubleSide});
const mesh=new THREE.Mesh(new THREE.PlaneGeometry(radius*2.16,radius*2.16),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=offsets[i]*radius;mesh.renderOrder=dust?2:1;mesh.frustumCulled=false;mesh.name=dust?'Irregular dust extinction':'Diffuse stellar and nebular haze';group.add(mesh);}
group.userData={radius,depthLayers:5,procedural:true};return group;
}

