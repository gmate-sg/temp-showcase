import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (selector) => document.querySelector(selector);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const worlds = new Set();
const cleanups = new Set();
const palette = [0xffb954, 0xff553d, 0xd72257, 0x8351ff, 0x327bff];
const sceneCopy = {
  aurora: ['AURORA / 光之褶皱', '流动着色器 · 6 层空间光带 · 辉光', '金色、绯红与紫蓝交织成连续的空间丝带。拖动改变视角，观察表面褶皱、薄膜与光的层次。'],
  vortex: ['VORTEX / 星轨涡流', '螺旋流线 · GPU 粒子 · 光核拾取', '多条轨道围绕光核形成具有深度的流动结构。粒子位置由着色器计算，轨道与尘埃以不同速度运动。'],
  waves: ['FLUID / 流体光场', '程序化曲面 · 等高光纹 · 指针扰动', '波面随时间变形，金红与紫蓝的等高光纹沿表面传播。移动指针可以扰动光场，拖动可观察立体起伏。'],
};
let frameHandle = 0;
let previousFrame = 0;
let initialized = false;
let heroWorld = null;
let labWorld = null;
let introState = null;
let pendingLab = false;

const noiseGLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise21(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x),
    mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
}
float fractal(vec2 p) {
  return noise21(p) * .57 + noise21(p * 2.03 + 7.1) * .28
    + noise21(p * 4.07 - 3.8) * .15;
}
vec3 spectral(float x) {
  vec3 gold = vec3(1.0, .63, .19);
  vec3 red = vec3(1.0, .12, .16);
  vec3 purple = vec3(.46, .12, 1.0);
  vec3 blue = vec3(.11, .33, 1.0);
  x = fract(x);
  if (x < .30) return mix(gold, red, x / .30);
  if (x < .62) return mix(red, purple, (x - .30) / .32);
  if (x < .84) return mix(purple, blue, (x - .62) / .22);
  return mix(blue, gold, (x - .84) / .16);
}
`;

const ribbonVertex = `
uniform float uTime, uPhase, uEnergy, uMorph, uMode;
uniform vec2 uPointer;
varying vec2 vUv;
varying float vFold;
varying vec3 vPosition;
const float TAU = 6.28318530718;
void main() {
  vUv = uv;
  float u = uv.x, across = uv.y * 2.0 - 1.0;
  float a, r, width;
  vec3 p;
  if (uMode < .5) {
    a = u * TAU + uPhase * .34;
    r = 2.0 + .18 * uPhase
      + .32 * sin(a * 3.0 + uTime * .42 + uPhase)
      + .15 * sin(a * 5.0 - uTime * .22 + uMorph);
    width = (.18 + .10 * sin(a * 2.0 + uPhase)) * (1.0 + .18 * uEnergy);
    float twist = a * 2.0 + uTime * .16 + uPhase * .63 + uMorph * .8;
    r += across * width * cos(twist);
    p = vec3(cos(a) * r, sin(a) * r * .86,
      .48 * sin(a * 2.0 + uPhase * .8 + uTime * .24)
      + across * width * 2.4 * sin(twist));
    p.x += .13 * sin(a * 4.0 + uTime * .5 + uPhase) * uEnergy;
    p.z += .22 * cos(a * 3.0 - uMorph) * sin(uMorph * .4);
  } else {
    a = u * TAU * 2.7 + uPhase + uTime * .16;
    r = .32 + u * 3.3;
    width = (.025 + .15 * u) * (.8 + uEnergy * .35);
    float twist = a * 1.4 - uTime * .35;
    r += across * width * cos(twist);
    p = vec3(cos(a) * r, sin(a) * r * .73,
      .48 * sin(a * .68 + uPhase) * u + across * width * 2.2 * sin(twist));
    p.z += .36 * sin(u * TAU * 2.0 - uTime * .5 + uPhase);
  }
  p.z += uPointer.x * p.x * .04 + uPointer.y * p.y * .04;
  vFold = sin(a * 3.0 + uTime * .2 + uPhase);
  vPosition = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const ribbonFragment = `
uniform float uTime, uPhase, uEnergy, uMode, uSelected;
varying vec2 vUv;
varying float vFold;
varying vec3 vPosition;
` + noiseGLSL + `
void main() {
  float edge = pow(abs(vUv.y * 2.0 - 1.0), 9.0);
  float grain = fractal(vec2(vUv.x * 12.0 - uTime * .2, vUv.y * 3.5 + uPhase));
  float hair = pow(.5 + .5 * sin(vUv.y * 98.0 + grain * 8.0), 10.0);
  float stream = .5 + .5 * sin(vUv.x * 31.0 - uTime * 1.1 + grain * 3.0 + uPhase);
  vec3 color = spectral(vUv.x * .67 + uPhase * .113 + vFold * .07 + uTime * .007);
  float light = .12 + edge * .80 + hair * .16 + stream * .14;
  color *= light * (.55 + uEnergy * .30);
  color += vec3(1.0, .48, .12) * edge * .12;
  color += vec3(.45, .18, .04) * uSelected;
  float fade = uMode > .5 ? smoothstep(0., .07, vUv.x) * (1.0 - smoothstep(.91, 1.0, vUv.x)) : 1.;
  float alpha = (.12 + edge * .45 + hair * .06) * fade;
  gl_FragColor = vec4(color, alpha);
}
`;

const waveVertex = `
uniform float uTime, uEnergy, uMorph;
uniform vec2 uPointer;
varying vec2 vUv;
varying float vHeight;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vec2 q = (uv - .5) * vec2(10.0, 7.2);
  float radial = length(q - uPointer * vec2(4.0, 3.0));
  float h = sin(q.x * .8 + uTime * .55) * cos(q.y * .7 - uTime * .29) * .60
    + sin(q.x * 1.55 + q.y * .9 - uTime * .6) * .22
    + cos(q.x * .55 - q.y * 1.7 + uTime * .33) * .20;
  h += sin(radial * 3.0 - uTime * 1.5) * .13 * exp(-radial * .32) * uEnergy;
  h *= .65 + .45 * uEnergy;
  h += sin(q.x * .9 + uMorph) * sin(uMorph * .4) * .28;
  vec3 p = vec3(q.x, h - .8, q.y);
  vPosition = p;
  vHeight = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const waveFragment = `
uniform float uTime, uEnergy, uPhase;
varying vec2 vUv;
varying float vHeight;
varying vec3 vPosition;
` + noiseGLSL + `
void main() {
  float n = fractal(vUv * 5.0 + vec2(uTime * .025, -uTime * .04));
  float contour = abs(sin(vHeight * 12.0 + n * 3.0 - uTime * .16));
  float fine = 1.0 - smoothstep(.03, .15, contour);
  float gridX = pow(.5 + .5 * sin(vUv.x * 310.0), 25.0);
  float gridY = pow(.5 + .5 * sin(vUv.y * 260.0), 25.0);
  float edge = smoothstep(.0, .13, vUv.x) * (1.0 - smoothstep(.87, 1.0, vUv.x))
    * smoothstep(0., .12, vUv.y) * (1.0 - smoothstep(.85, 1., vUv.y));
  vec3 color = spectral(vUv.x * .72 + vHeight * .17 + uTime * .006 + uPhase);
  color *= .045 + fine * .85 + (gridX + gridY) * .05;
  color += vec3(.52, .22, .06) * pow(max(vHeight, 0.), 2.0) * .35;
  color *= .5 + uEnergy * .30;
  gl_FragColor = vec4(color, edge * (.58 + fine * .18));
}
`;

const particleVertex = `
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime, uEnergy, uMode, uPointScale;
uniform vec2 uPointer;
varying vec3 vColor;
varying float vOpacity;
void main() {
  float theta = position.x, radius = position.y, depth = position.z;
  float t = uTime * (.04 + aSeed * .035);
  vec3 p;
  if (uMode < .5) {
    float a = theta + t;
    float r = radius + .13 * sin(theta * 5.0 + uTime * .3);
    p = vec3(cos(a) * r, sin(a) * r * .88, depth + sin(a * 2.0 + uTime * .17) * .4);
  } else if (uMode < 1.5) {
    float a = theta - t * 2.2 - radius * 1.9;
    float r = radius + sin(a * 2.0 + uTime * .7) * .10;
    p = vec3(cos(a) * r, sin(a) * r * .73, depth * .55 + sin(a + radius) * .45);
  } else {
    float x = (theta / 6.2831853 - .5) * 10.;
    float z = (radius / 5.8 - .5) * 7.2;
    float h = sin(x * .8 + uTime * .55) * cos(z * .7 - uTime * .29) * .60
      + sin(x * 1.55 + z * .9 - uTime * .6) * .22
      + cos(x * .55 - z * 1.7 + uTime * .33) * .2;
    p = vec3(x, h * (.65 + .45 * uEnergy) - .71 + aSeed * .09, z);
  }
  p.z += uPointer.x * .05;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(12.0, uPointScale * (.7 + aSeed * 1.1) / max(-mv.z, 1.));
  vColor = aColor * (.70 + uEnergy * .20);
  vOpacity = .4 + .5 * sin(aSeed * 20. + uTime * .5) * sin(aSeed * 20. + uTime * .5);
}
`;
const particleFragment = `
varying vec3 vColor;
varying float vOpacity;
void main() {
  vec2 q = gl_PointCoord - .5;
  float d = length(q);
  if (d > .5) discard;
  float core = exp(-d * d * 58.0);
  float halo = exp(-d * d * 15.0) * .12;
  gl_FragColor = vec4(vColor * (core * .90 + halo), vOpacity * (core + halo));
}
`;
const coreVertex = `
varying vec3 vNormal, vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;
const coreFragment = `
uniform float uTime, uPhase, uEnergy, uSelected;
varying vec3 vNormal, vPosition;
` + noiseGLSL + `
void main() {
  float fresnel = pow(1.0 - abs(vNormal.z), 2.7);
  float cracks = pow(.5 + .5 * sin(vPosition.y * 14.0 + fractal(vPosition.xy * 4.0 + uTime * .08) * 11.0), 12.0);
  vec3 color = spectral(uPhase + vPosition.y * .25);
  color *= .08 + fresnel * 1.65 + cracks * .38;
  color += vec3(1., .64, .19) * uSelected * .9;
  gl_FragColor = vec4(color * (.55 + uEnergy * .35), 1.);
}
`;

function shaderMaterial(vertexShader, fragmentShader, overrides = {}) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: {
      uTime: { value: 0 }, uPhase: { value: 0 }, uEnergy: { value: 1 },
      uMorph: { value: 0 }, uMode: { value: 0 }, uSelected: { value: 0 },
      uPointer: { value: new THREE.Vector2() }, uPointScale: { value: 27 },
    },
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending, ...overrides,
  });
}

function seededRandom(seed = 9137) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function addParticles(world, count) {
  const random = seededRandom(world.mode === 'waves' ? 1721 : 8137);
  const position = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    position[i * 3] = random() * Math.PI * 2;
    const r = random();
    position[i * 3 + 1] = world.mode === 'aurora' ? 2.0 + r * 3.8 : .22 + Math.pow(r, .6) * 5.4;
    position[i * 3 + 2] = (random() - .5) * (world.mode === 'aurora' ? 2.5 : 1.8);
    seeds[i] = random();
    color.setHex(palette[Math.floor(random() * palette.length)]).multiplyScalar(.7 + random() * .6);
    color.toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = shaderMaterial(particleVertex, particleFragment);
  material.uniforms.uMode.value = world.mode === 'aurora' ? 0 : world.mode === 'vortex' ? 1 : 2;
  material.uniforms.uPointScale.value = world.role === 'detail' ? 23 : 30;
  const cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  world.group.add(cloud);
  world.materials.push(material);
}
function addCore(world, radius, phase, position) {
  const material = shaderMaterial(coreVertex, coreFragment, { transparent: false, depthWrite: true, blending: THREE.NormalBlending });
  material.uniforms.uPhase.value = phase;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 24), material);
  mesh.position.copy(position);
  mesh.userData.basePosition = position.clone();
  mesh.userData.phase = phase;
  mesh.userData.pickable = true;
  world.group.add(mesh);
  world.cores.push(mesh);
  world.materials.push(material);
}

function populate(world, mode = 'aurora') {
  clearSculpture(world);
  world.mode = Object.hasOwn(sceneCopy, mode) ? mode : 'aurora';
  const compact = world.role === 'detail';
  const segments = compact ? 160 : 256;
  if (world.mode === 'aurora' || world.mode === 'vortex') {
    const geometry = new THREE.PlaneGeometry(1, 1, segments, compact ? 9 : 15);
    const count = world.mode === 'aurora' ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const material = shaderMaterial(ribbonVertex, ribbonFragment);
      material.uniforms.uPhase.value = world.mode === 'aurora' ? i : i * Math.PI * .4;
      material.uniforms.uMode.value = world.mode === 'aurora' ? 0 : 1;
      const ribbon = new THREE.Mesh(geometry, material);
      ribbon.frustumCulled = false;
      world.group.add(ribbon);
      world.materials.push(material);
    }
    if (world.mode === 'vortex') {
      addCore(world, .40, .04, new THREE.Vector3());
      addCore(world, .12, .42, new THREE.Vector3(1.7, -.65, .45));
      addCore(world, .15, .76, new THREE.Vector3(-1.45, .8, .35));
    }
    addParticles(world, compact ? 1900 : world.mode === 'aurora' ? 3800 : 5600);
  } else {
    const geometry = new THREE.PlaneGeometry(1, 1, compact ? 94 : 150, compact ? 70 : 110);
    const material = shaderMaterial(waveVertex, waveFragment);
    const surface = new THREE.Mesh(geometry, material);
    surface.frustumCulled = false;
    world.group.add(surface);
    world.materials.push(material);
    addParticles(world, compact ? 1500 : 3400);
  }
  if (world.variant === 'instances') addInstances(world);
  world.group.rotation.set(world.mode === 'waves' ? .03 : -.12, 0, world.mode === 'waves' ? 0 : -.15);
  world.canvas.dataset.scene = world.mode;
  world.canvas.dataset.variant = world.variant || world.mode;
  world.canvas.dataset.ready = 'false';
  world.ready = false;
  setCamera(world);
}
function clearSculpture(world) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  world.group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  world.group.clear();
  world.materials = [];
  world.cores = [];
  world.instances = null;
}
function addInstances(world) {
  const count = 640;
  const material = new THREE.MeshStandardMaterial({
    color: 0xff9254, emissive: 0xa51c37, emissiveIntensity: .45, metalness: .6, roughness: .24,
  });
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.055, 0), material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) { color.setHex(palette[i % palette.length]); mesh.setColorAt(i, color); }
  mesh.frustumCulled = false;
  world.group.add(mesh);
  world.instances = mesh;
}
const instanceDummy = new THREE.Object3D();
function updateInstances(world) {
  if (!world.instances) return;
  for (let i = 0; i < world.instances.count; i++) {
    const a = i * .13 + world.time * .16;
    const r = 1.1 + (i % 80) / 80 * 2.8;
    instanceDummy.position.set(Math.cos(a) * r, Math.sin(a) * r * .73, Math.sin(a * 1.6 + world.time * .25) * .62);
    instanceDummy.rotation.set(a * .3, a, world.time * .2 + i * .05);
    const scale = .55 + (Math.sin(i * .19 + world.time * .7) + 1) * .35;
    instanceDummy.scale.set(scale, scale * 2.4, scale);
    instanceDummy.updateMatrix();
    world.instances.setMatrixAt(i, instanceDummy.matrix);
  }
  world.instances.instanceMatrix.needsUpdate = true;
}
function setCamera(world) {
  const waves = world.mode === 'waves';
  const distance = world.role === 'detail' ? 8.8 : world.role === 'hero' ? 9.3 : 9.7;
  world.initial.set(waves ? 5.3 : .65, waves ? 4.0 : .38, waves ? 7.2 : distance);
  world.camera.position.copy(world.initial);
  world.controls?.target.set(0, waves ? -.4 : 0, 0);
  world.camera.lookAt(0, waves ? -.4 : 0, 0);
  world.controls?.update();
}

function createWorld(canvas, options = {}) {
  if (!canvas) return null;
  let renderer, composer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, options.role === 'intro' ? 1.3 : options.role === 'detail' ? 1.15 : 1.4));
    renderer.setClearColor(0x080709, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .68;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 60);
    const group = new THREE.Group();
    scene.add(group);
    const light = new THREE.DirectionalLight(0xffd7a4, 3.5);
    light.position.set(4, 5, 5); scene.add(light);
    const rim = new THREE.DirectionalLight(0x7857ff, 2.6);
    rim.position.set(-4, -1, 3); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xa13451, .65));
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(new THREE.Vector2(400, 300), .24, .35, .80);
    const output = new OutputPass();
    composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output);
    const world = {
      canvas, renderer, composer, renderPass, bloom, output, scene, camera, group,
      role: options.role || 'lab', mode: options.mode || 'aurora', variant: options.variant || '',
      time: options.time || 0, speed: .75, energy: 1, targetEnergy: 1, morph: 0, targetMorph: 0,
      pointer: new THREE.Vector2(), targetPointer: new THREE.Vector2(),
      initial: new THREE.Vector3(), materials: [], cores: [], instances: null,
      controls: null, visible: options.role === 'intro', disposed: false, listeners: [],
      ready: false, fallback: options.fallback || null, raycaster: new THREE.Raycaster(),
      selected: null, note: options.note || null, pulse: 0, observedWidth: 0, observedHeight: 0,
    };
    if (world.role !== 'intro') {
      world.controls = new OrbitControls(camera, canvas);
      world.controls.enableDamping = true;
      world.controls.dampingFactor = .075;
      world.controls.enablePan = false;
      world.controls.minDistance = 4;
      world.controls.maxDistance = 18;
      world.controls.minPolarAngle = .25;
      world.controls.maxPolarAngle = Math.PI * .87;
      world.controls.enableZoom = world.role !== 'hero';
      world.controls.rotateSpeed = .55;
    }
    const listen = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      world.listeners.push(() => target.removeEventListener(type, fn, opts));
    };
    listen(canvas, 'pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      world.targetPointer.set(x, y);
      if (world.variant === 'picking') {
        world.raycaster.setFromCamera(world.targetPointer, camera);
        const hit = world.raycaster.intersectObjects(world.cores)[0];
        world.selected = hit?.object || null;
        canvas.style.cursor = hit ? 'pointer' : 'grab';
        canvas.dataset.picked = hit ? String(world.cores.indexOf(hit.object) + 1) : '0';
      }
    }, { passive: true });
    listen(canvas, 'pointerleave', () => { world.targetPointer.set(0, 0); world.selected = null; });
    if (world.role === 'detail') {
      listen(canvas, 'click', () => {
        world.pulse = 1;
        if (world.variant === 'morph') world.targetMorph += 1.4;
        if (world.variant === 'bloom') world.targetEnergy = world.targetEnergy > 1.2 ? .65 : 1.7;
        if (world.variant === 'picking' && world.selected) {
          world.targetEnergy = .8 + (world.cores.indexOf(world.selected) + 1) * .3;
          if (world.note) world.note.textContent = '已选择光核 ' + (world.cores.indexOf(world.selected) + 1) + ' · 拖动旋转 · 滚轮缩放';
        }
      });
      listen(canvas, 'dblclick', () => { setCamera(world); world.targetMorph = 0; world.targetEnergy = 1; });
    }
    listen(canvas, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
      event.preventDefault();
      if (!world.controls) return;
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(world.controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= .12;
      if (event.key === 'ArrowRight') spherical.theta += .12;
      if (event.key === 'ArrowUp') spherical.phi -= .10;
      if (event.key === 'ArrowDown') spherical.phi += .10;
      if (event.key === '+' || event.key === '=') spherical.radius *= .9;
      if (event.key === '-') spherical.radius *= 1.1;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, .25, Math.PI * .87);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, 4, 18);
      camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(world.controls.target));
      world.controls.update();
    });
    listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      canvas.dataset.ready = 'false';
      showFallback(world, '当前图形环境暂时无法渲染，页面内容仍可正常使用。');
      world.onRenderFailure?.();
      disposeWorld(world);
    });
    world.resize = () => {
      if (world.disposed) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (world.observedWidth === width && world.observedHeight === height) return;
      world.observedWidth = width; world.observedHeight = height;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    world.resizeObserver = new ResizeObserver(world.resize);
    world.resizeObserver.observe(canvas.parentElement || canvas);
    if (world.role !== 'intro') {
      world.intersectionObserver = new IntersectionObserver(([entry]) => { world.visible = entry.isIntersecting; }, { rootMargin: '80px' });
      world.intersectionObserver.observe(canvas);
    }
    populate(world, world.mode);
    if (world.role === 'intro') {
      world.group.scale.setScalar(.68);
      world.camera.position.set(0, .25, 11.5);
      world.camera.lookAt(0, 0, 0);
    }
    world.resize();
    worlds.add(world);
    ensureScheduler();
    return world;
  } catch (error) {
    composer?.passes?.forEach((pass) => pass.dispose?.());
    composer?.dispose();
    renderer?.dispose();
    if (options.fallback) { options.fallback.hidden = false; options.fallback.textContent = '当前浏览器未能启动三维渲染，请尝试支持 WebGL 2 的浏览器。'; }
    canvas.dataset.ready = 'false';
    canvas.dataset.error = error.name || 'WebGLUnavailable';
    return null;
  }
}

function showFallback(world, message) {
  if (!world.fallback) return;
  world.fallback.hidden = false;
  if (message) world.fallback.textContent = message;
}
function disposeWorld(world) {
  if (!world || world.disposed) return;
  world.disposed = true;
  worlds.delete(world);
  world.resizeObserver?.disconnect();
  world.intersectionObserver?.disconnect();
  world.listeners.forEach((off) => off());
  world.controls?.dispose();
  clearSculpture(world);
  world.composer.passes.forEach((pass) => pass.dispose?.());
  world.composer.dispose();
  world.renderer.dispose();
  if (world.role === 'detail' || world.role === 'intro') world.renderer.forceContextLoss();
  world.scene.clear();
  if (!worlds.size) { cancelAnimationFrame(frameHandle); frameHandle = 0; previousFrame = 0; }
}
function renderWorld(world, delta, now) {
  if (world.disposed || !world.visible || document.hidden) return;
  const calmer = motionPreference.matches;
  world.time += delta * Math.max(.25, world.speed) * (calmer ? .19 : 1);
  world.pointer.lerp(world.targetPointer, 1 - Math.exp(-delta * 5));
  world.energy += (world.targetEnergy - world.energy) * (1 - Math.exp(-delta * 4));
  world.morph += (world.targetMorph - world.morph) * (1 - Math.exp(-delta * 2));
  world.pulse *= Math.exp(-delta * 2);
  const energy = world.energy + world.pulse * .3;
  for (const material of world.materials) {
    material.uniforms.uTime.value = world.time;
    material.uniforms.uEnergy.value = energy;
    material.uniforms.uPointer.value.copy(world.pointer);
    material.uniforms.uMorph.value = world.morph;
    material.uniforms.uSelected.value = world.cores.some((core) => core.material === material && core === world.selected) ? 1 : 0;
  }
  world.bloom.strength = (.13 + energy * .11) * (world.variant === 'bloom' ? 1.35 : 1);
  world.bloom.radius = .35;
  if (world.mode !== 'waves') {
    world.group.rotation.y = Math.sin(world.time * .13) * .22;
    world.group.rotation.x = -.12 + Math.sin(world.time * .10) * .055;
    world.group.rotation.z = -.15 + world.time * .025;
  } else world.group.rotation.y = Math.sin(world.time * .08) * .10;
  world.cores.forEach((core, index) => {
    if (!index) return;
    const angle = world.time * (.14 + index * .025) + index * 2.8;
    const radius = 1.6 + index * .24;
    core.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .67, Math.sin(angle * 1.7) * .6);
  });
  updateInstances(world);
  if (world.role === 'intro' && introState?.startedAt) {
    const elapsed = now - introState.startedAt;
    const t = THREE.MathUtils.clamp(elapsed / 5000, 0, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    world.group.scale.setScalar(.68 + ease * .34);
    world.camera.position.z = 11.5 - ease * 2.0;
    world.camera.position.x = Math.sin(t * Math.PI) * .35;
    world.camera.position.y = .25 + Math.sin(t * Math.PI) * .25;
    world.camera.lookAt(0, 0, 0);
    world.bloom.strength = .22 + Math.sin(t * Math.PI) * .07;
  }
  world.controls?.update();
  world.composer.render(delta);
  if (!world.ready) {
    world.ready = true;
    world.canvas.dataset.ready = 'true';
    if (world.fallback) world.fallback.hidden = true;
    world.onFirstFrame?.();
    world.onFirstFrame = null;
  }
  world.canvas.dataset.time = world.time.toFixed(2);
}
function ensureScheduler() {
  if (frameHandle) return;
  previousFrame = 0;
  frameHandle = requestAnimationFrame(tick);
}
function tick(now) {
  frameHandle = 0;
  const delta = previousFrame ? Math.min((now - previousFrame) / 1000, .05) : .016;
  previousFrame = now;
  for (const world of worlds) {
    try { renderWorld(world, delta, now); }
    catch (error) {
      world.canvas.dataset.error = error.name || 'RenderError';
      showFallback(world, '图形渲染暂不可用，仍可浏览索引与演示说明。');
      world.onRenderFailure?.();
      disposeWorld(world);
    }
  }
  if (worlds.size) frameHandle = requestAnimationFrame(tick);
}

function initHero() {
  if (heroWorld || !$('#hero-canvas')) return;
  heroWorld = createWorld($('#hero-canvas'), { role: 'hero', mode: 'aurora', fallback: $('#hero-fallback'), time: 1.4 });
}
function initLab() {
  if (labWorld || !$('#lab-canvas')) return;
  if (introState && !introState.finished) { pendingLab = true; return; }
  labWorld = createWorld($('#lab-canvas'), { role: 'lab', mode: 'aurora', fallback: $('#lab-fallback') });
  if (!labWorld) return;
  const speed = $('#speed-range'), energy = $('#energy-range');
  const updateSpeed = () => {
    labWorld.speed = Math.max(.25, Number(speed?.value) || .75);
    if ($('#speed-output')) $('#speed-output').textContent = labWorld.speed.toFixed(2) + '×';
  };
  const updateEnergy = () => {
    const raw = Number(energy?.value) || 1;
    const value = Number(energy?.max) > 10 ? raw / 100 : raw;
    labWorld.targetEnergy = THREE.MathUtils.clamp(value, .35, 2);
    if ($('#energy-output')) $('#energy-output').textContent = labWorld.targetEnergy.toFixed(2) + '×';
  };
  updateSpeed(); updateEnergy();
  const listen = (element, type, handler) => {
    if (!element) return;
    element.addEventListener(type, handler);
    cleanups.add(() => element.removeEventListener(type, handler));
  };
  listen(speed, 'input', updateSpeed);
  listen(energy, 'input', updateEnergy);
  listen($('#lab-reset'), 'click', () => { setCamera(labWorld); labWorld.targetPointer.set(0, 0); });
  document.querySelectorAll('button[data-scene]').forEach((button) => listen(button, 'click', () => selectLabScene(button.dataset.scene)));
  selectLabScene('aurora');
}
function selectLabScene(mode) {
  if (!labWorld || !Object.hasOwn(sceneCopy, mode)) return;
  if (labWorld.mode !== mode) populate(labWorld, mode);
  document.querySelectorAll('button[data-scene]').forEach((button) => {
    const active = button.dataset.scene === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const [name, note, description] = sceneCopy[mode];
  if ($('#lab-object-name')) $('#lab-object-name').textContent = name;
  if ($('#lab-object-note')) $('#lab-object-note').textContent = note;
  const explanation = $('#lab-explanation');
  if (explanation?.querySelector('strong')) explanation.querySelector('strong').textContent = name;
  if (explanation?.querySelector('p')) explanation.querySelector('p').textContent = description;
}

function startIntro() {
  const overlay = $('#intro'), site = $('#site-content');
  if (!overlay) { initHero(); return; }
  overlay.hidden = false;
  overlay.classList.remove('is-exiting');
  document.body.classList.remove('intro-reveal');
  document.body.classList.add('intro-active');
  if (site) site.inert = true;
  const progress = $('#intro-progress');
  const caption = $('#intro-caption');
  introState = { finished: false, startedAt: 0, world: null, progressFrame: 0, timers: [] };
  const state = introState;
  document.documentElement.style.setProperty('--intro-progress', '0');
  if (progress) { progress.textContent = '0%'; progress.setAttribute('aria-valuenow', '0'); }
  if (caption) caption.textContent = '光与结构正在汇聚';
  state.progressFrame = requestAnimationFrame(() => {
    const enterDissolve = () => {
      if (state.finished) return;
      overlay.classList.add('is-exiting');
      document.body.classList.add('intro-reveal');
      if (caption) caption.textContent = '进入 FRAME';
      if (site) site.classList.add('intro-revealed');
      overlay.dataset.transitionAt = performance.now().toFixed(2);
    };
    const finish = () => {
      if (state.finished) return;
      const remaining = 5000 - (performance.now() - state.startedAt);
      if (remaining > 0) { state.timers.push(setTimeout(finish, remaining)); return; }
      state.finished = true;
      state.timers.forEach(clearTimeout);
      cancelAnimationFrame(state.progressFrame);
      const finishedAt = performance.now();
      overlay.dataset.finishedAt = finishedAt.toFixed(2);
      overlay.dataset.elapsed = (finishedAt - state.startedAt).toFixed(2);
      document.documentElement.style.setProperty('--intro-progress', '1');
      if (progress) { progress.textContent = '100%'; progress.setAttribute('aria-valuenow', '100'); }
      overlay.hidden = true;
      overlay.classList.remove('is-exiting');
      document.body.classList.remove('intro-active', 'intro-reveal');
      if (site) { site.inert = false; site.classList.add('intro-revealed'); }
      disposeWorld(state.world);
      state.world = null;
      initHero();
      if (pendingLab) initLab();
      dispatchEvent(new CustomEvent('frame:intro-finished', { detail: { elapsed: finishedAt - state.startedAt } }));
    };
    const updateProgress = () => {
      if (state.finished) return;
      const elapsed = performance.now() - state.startedAt;
      const percent = Math.min(100, elapsed / 50);
      if (progress) {
        progress.textContent = Math.round(percent) + '%';
        document.documentElement.style.setProperty('--intro-progress', String(percent / 100));
        progress.setAttribute('aria-valuenow', String(Math.round(percent)));
        if (progress.tagName === 'PROGRESS') progress.value = percent;
      }
      if (caption && elapsed > 2100 && elapsed < 4250) caption.textContent = '从光场，进入界面的无限可能';
      if (elapsed >= 4300 && !overlay.classList.contains('is-exiting')) enterDissolve();
      if (elapsed >= 5000) { finish(); return; }
      state.progressFrame = requestAnimationFrame(updateProgress);
    };
    const armClock = (fallback = false) => {
      if (state.startedAt || state.finished) return;
      clearTimeout(state.startWatchdog);
      // Start only after the first real rendered frame, not while the bundle loads.
      state.startedAt = performance.now();
      overlay.dataset.startedAt = state.startedAt.toFixed(2);
      overlay.dataset.duration = '5000';
      overlay.dataset.clockSource = fallback ? 'fallback-first-frame' : 'three-first-render';
      state.timers.push(setTimeout(initHero, 3450));
      state.timers.push(setTimeout(enterDissolve, 4300));
      state.timers.push(setTimeout(finish, 5000));
      updateProgress();
    };
    state.world = createWorld($('#intro-canvas'), { role: 'intro', mode: 'aurora' });
    if (!state.world) {
      overlay.dataset.fallback = 'true';
      overlay.classList.add('intro-fallback');
      if (caption) caption.textContent = 'FRAME · 界面与交互的无限可能';
      armClock(true);
    } else {
      state.world.onFirstFrame = () => armClock(false);
      state.world.onRenderFailure = () => {
        overlay.dataset.fallback = 'true';
        overlay.classList.add('intro-fallback');
        armClock(true);
      };
      state.startWatchdog = setTimeout(() => {
        if (state.startedAt || state.finished) return;
        overlay.dataset.fallback = 'true';
        overlay.classList.add('intro-fallback');
        armClock(true);
      }, 700);
      state.timers.push(state.startWatchdog);
    }
  });
}

export function initGraphics() {
  if (initialized) return;
  initialized = true;
  startIntro();
  const labCanvas = $('#lab-canvas');
  if (labCanvas) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { observer.disconnect(); initLab(); }
    }, { rootMargin: '280px' });
    observer.observe(labCanvas);
    cleanups.add(() => observer.disconnect());
  }
  const onScene = (event) => {
    const mode = event.detail?.scene || event.detail?.mode || event.detail;
    if (typeof mode !== 'string') return;
    initLab(); selectLabScene(mode);
  };
  addEventListener('frame:scene', onScene);
  cleanups.add(() => removeEventListener('frame:scene', onScene));
}

export function mountThreeDemo(container, entry = {}) {
  if (!container) return () => {};
  const existing = container.matches?.('.three-live-stage') ? container : container.querySelector('.three-live-stage');
  const stage = existing || document.createElement('div');
  if (!existing) { stage.className = 'three-live-stage three-detail-host'; container.prepend(stage); }
  stage.style.position = 'relative';
  stage.style.minHeight = '280px';
  stage.style.height = '320px';
  stage.style.overflow = 'hidden';
  stage.style.background = '#080709';
  stage.style.borderRadius = '16px';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '实时 Three.js 演示。拖动旋转，滚轮缩放，方向键旋转，加减键缩放，双击复位。');
  const note = document.createElement('span');
  note.className = 'three-live-note';
  note.style.cssText = 'position:absolute;left:14px;right:14px;bottom:12px;color:#d6c5b6;font-size:11px;letter-spacing:.03em;pointer-events:none;text-shadow:0 2px 10px #000';
  const fallback = document.createElement('div');
  fallback.hidden = true;
  fallback.style.cssText = 'position:absolute;inset:0;place-content:center;padding:24px;color:#dec8af;text-align:center;background:radial-gradient(ellipse,#371922,#080709)';
  const variant = entry.variant || 'orbit';
  const mode = ['fluid', 'bloom'].includes(variant) ? 'waves' : ['particles', 'instances', 'picking'].includes(variant) ? 'vortex' : 'aurora';
  const hints = {
    orbit: '轨道视角 · 拖动旋转 · 滚轮缩放',
    particles: 'GPU 粒子流 · 拖动观察空间层次 · 滚轮缩放',
    fluid: '移动指针扰动波场 · 拖动旋转 · 滚轮缩放',
    instances: '640 个实例沿轨道运动 · 拖动旋转',
    picking: '悬停并点击小光核 · 拖动旋转 · 滚轮缩放',
    morph: '点击改变光带形变 · 拖动旋转 · 双击复位',
    bloom: '点击切换辉光强度 · 拖动观察波面 · 双击复位',
    camera: '拖动观察透视与空间 · 滚轮改变距离 · 双击复位',
  };
  note.textContent = hints[variant] || hints.orbit;
  stage.append(canvas, fallback, note);
  const world = createWorld(canvas, { role: 'detail', mode, variant, fallback, note });
  if (world) { world.visible = true; world.speed = .85; }
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    disposeWorld(world);
    canvas.remove(); note.remove(); fallback.remove();
    if (!existing) stage.remove();
  };
}

function disposeAll() {
  if (introState && !introState.finished) {
    introState.timers.forEach(clearTimeout);
    cancelAnimationFrame(introState.progressFrame);
    if ($('#site-content')) $('#site-content').inert = false;
  }
  [...worlds].forEach(disposeWorld);
  cleanups.forEach((cleanup) => cleanup());
  cleanups.clear();
}
addEventListener('pagehide', (event) => {
  // A persisted page keeps its rendering resources; the browser suspends rAF.
  if (!event.persisted) disposeAll();
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGraphics, { once: true });
else initGraphics();
