import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sceneCopy = {
  geometry: ['PARAMETRIC KNOT', '连续曲面 / MeshStandardMaterial', '几何体怎样变成可见的物体？', '顶点决定形状，材质决定光的响应，相机决定你看见的视角。试试线框模式，看看曲面背后的结构。'],
  particles: ['PARTICLE ORBIT', '3,200 个顶点 / BufferGeometry + Points', '很多点，也可以组成一个世界。', '每个点都有位置与颜色。这里用同一份顶点缓冲绘制粒子星环；轮廓模式能帮你看清粒子围绕的空间形状。'],
  instances: ['INSTANCED FIELD', '169 个立方体 / InstancedMesh', '重复的形状，如何高效绘制？', '实例化让一份几何体与材质在多个位置重复使用。每个立方体有独立变换，排列成随时间起伏的矩阵。'],
};

function createWorld(canvas, hero = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(hero ? 32 : 38, 1, .1, 100);
  const initial = hero ? new THREE.Vector3(5, 3, 8) : new THREE.Vector3(7, 4.2, 9);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.enablePan = false; controls.minDistance = hero ? 5 : 4; controls.maxDistance = hero ? 16 : 22;
  controls.maxPolarAngle = Math.PI * .85;
  scene.add(new THREE.HemisphereLight(0xe9f0dc, 0x294b35, 2.2));
  const key = new THREE.DirectionalLight(0xfff6df, 3.6); key.position.set(5, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb0d9be, 3.8); rim.position.set(-5, 1, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x86a47f, 1.1); fill.position.set(1, -4, 3); scene.add(fill);
  const group = new THREE.Group(); scene.add(group);
  const world = { renderer, scene, camera, controls, group, visible: true, needsDraw: true, paused: reducedMotion.matches, speed: .5, mode: 'geometry', material: 'solid', time: 0, lastTime: 0, initial, hero, disposed: false };
  controls.addEventListener('change', () => { world.needsDraw = true; });
  function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); world.needsDraw = true; }
  new ResizeObserver(resize).observe(canvas.parentElement); resize();
  new IntersectionObserver(([entry]) => { world.visible = entry.isIntersecting; if (world.visible) world.needsDraw = true; }, { threshold: 0 }).observe(canvas);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); world.disposed = true; $(`#${hero ? 'hero' : 'lab'}-fallback`).hidden = false; });
  world.reset = () => { camera.position.copy(initial); controls.target.set(0, 0, 0); controls.update(); world.needsDraw = true; };
  canvas.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .12;
    if (event.key === 'ArrowDown') spherical.phi += .12;
    if (event.key === '+' || event.key === '=') spherical.radius *= .9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, .1, controls.maxPolarAngle);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target)); controls.update(); world.needsDraw = true;
  });
  let last = 0;
  function tick(ms) {
    if (world.disposed) return;
    requestAnimationFrame(tick);
    const dt = Math.min((ms - last) / 1000, .05); last = ms;
    if (!world.visible || document.hidden) return;
    const moving = !world.paused && world.speed > 0;
    if (moving) { world.time += dt * world.speed; world.needsDraw = true; }
    if (world.hero || world.mode === 'geometry') { if (moving) { group.rotation.y += dt * world.speed * .23; group.rotation.x = Math.sin(world.time * .23) * .12; } }
    else if (world.mode === 'particles' && moving) { group.rotation.y += dt * world.speed * .13; group.rotation.z = Math.sin(world.time * .22) * .07; }
    else if (world.mode === 'instances' && moving) animateInstances(world);
    controls.update();
    if (world.needsDraw) { renderer.render(scene, camera); world.needsDraw = false; canvas.dataset.ready = 'true'; canvas.dataset.scene = world.mode; canvas.dataset.material = world.material; }
  }
  requestAnimationFrame(tick);
  return world;
}

function clearGroup(world) {
  const geometries = new Set(), materials = new Set();
  world.group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
  });
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => { m.map?.dispose(); m.dispose(); });
  world.group.clear(); world.group.rotation.set(0, 0, 0); world.instanced = null;
}
function meshMaterial(mode) {
  return new THREE.MeshStandardMaterial({ color: mode === 'wire' ? 0xc8dda8 : 0xc2d4aa, metalness: .42, roughness: .32, wireframe: mode === 'wire', transparent: mode === 'ghost', opacity: mode === 'ghost' ? .26 : 1, depthWrite: mode !== 'ghost', side: THREE.DoubleSide });
}
function makeGeometry(world) {
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.55, .43, world.material === 'wire' ? 110 : 200, world.material === 'wire' ? 14 : 36, 2, 3), meshMaterial(world.material));
  knot.rotation.z = Math.PI / 8; world.group.add(knot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, .009, 4, 150), new THREE.MeshBasicMaterial({ color: 0xa5bb8b, transparent: true, opacity: .25 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -2.15; world.group.add(ring);
}
function particleTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.35, '#ffffffee'); gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient; context.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
function makeParticles(world) {
  const count = 3200, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  // Deterministic Fibonacci distribution gives a reproducible sculptural ring.
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963229728653, b = i * .61803398875 * Math.PI * 2;
    const minor = .35 + ((i * 13 % 101) / 101) * .85;
    const radius = 2.45 + Math.cos(b) * minor;
    positions[i * 3] = Math.cos(a) * radius; positions[i * 3 + 1] = Math.sin(b) * minor * .85; positions[i * 3 + 2] = Math.sin(a) * radius;
    color.setHSL(.25 + (i % 10) * .008, .2, .5 + (i % 17) * .022); color.toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  world.group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size: world.material === 'ghost' ? .035 : .052, map: particleTexture(), vertexColors: true, transparent: true, opacity: world.material === 'ghost' ? .36 : .9, depthWrite: false, blending: THREE.AdditiveBlending })));
  world.group.rotation.z = .3;
  if (world.material === 'wire') for (let j = 0; j < 5; j++) {
    const points = []; for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; const r = 1.55 + j * .44; points.push(new THREE.Vector3(Math.cos(a) * r, (j - 2) * .16, Math.sin(a) * r)); }
    world.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xc5d9ac, transparent: true, opacity: .35 })));
  }
}
function makeInstances(world) {
  const geometry = new THREE.BoxGeometry(.29, .29, .29), material = meshMaterial(world.material);
  const mesh = new THREE.InstancedMesh(geometry, material, 169);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color(); for (let i = 0; i < 169; i++) { color.setHSL(.25, .18, .38 + (i % 13) / 36); mesh.setColorAt(i, color); }
  world.group.add(mesh); world.instanced = mesh; animateInstances(world);
}
const dummy = new THREE.Object3D();
function animateInstances(world) {
  let i = 0;
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
    const wave = Math.sin(Math.hypot(x, z) * .8 - world.time * 1.5);
    dummy.position.set(x * .44, wave * .75, z * .44);
    dummy.scale.set(1, 1.1 + (wave + 1) * 1.6, 1);
    dummy.rotation.set(0, world.time * .05, 0); dummy.updateMatrix(); world.instanced.setMatrixAt(i++, dummy.matrix);
  }
  world.instanced.instanceMatrix.needsUpdate = true;
  world.instanced.computeBoundingSphere();
}
function populate(world) {
  clearGroup(world);
  if (world.mode === 'particles') makeParticles(world);
  else if (world.mode === 'instances') makeInstances(world);
  else makeGeometry(world);
  world.needsDraw = true;
}
function unavailable(hero) {
  $(`#${hero ? 'hero' : 'lab'}-fallback`).hidden = false;
  if (hero) $('#hero-pause').disabled = true;
  else document.querySelectorAll('.lab-controls button,.lab-controls select,.lab-controls input,#lab-reset').forEach((control) => { if (control.id !== 'three-details') control.disabled = true; });
}
export function initGraphics() {
  let hero;
  try { hero = createWorld($('#hero-canvas'), true); populate(hero); }
  catch { unavailable(true); }
  if (hero) {
    const button = $('#hero-pause');
    function label() { button.textContent = hero.paused ? '▶' : 'Ⅱ'; button.setAttribute('aria-label', hero.paused ? '播放首页 3D 旋转' : '暂停首页 3D 旋转'); button.title = hero.paused ? '播放旋转' : '暂停旋转'; }
    label(); button.addEventListener('click', () => { hero.paused = !hero.paused; label(); });
    reducedMotion.addEventListener('change', () => { hero.paused = reducedMotion.matches; label(); });
  }
  let lab;
  function initLab() {
    try { lab = createWorld($('#lab-canvas')); populate(lab); }
    catch { unavailable(false); return; }
    const pause = $('#lab-pause');
    function pauseLabel() { pause.innerHTML = lab.paused ? '播放运动 <span>▶</span>' : '暂停运动 <span>Ⅱ</span>'; pause.setAttribute('aria-pressed', String(lab.paused)); }
    pauseLabel();
    pause.addEventListener('click', () => { lab.paused = !lab.paused; pauseLabel(); });
    reducedMotion.addEventListener('change', () => { lab.paused = reducedMotion.matches; pauseLabel(); });
    $('#lab-reset').addEventListener('click', lab.reset);
    $('#material-select').addEventListener('change', (event) => { lab.material = event.target.value; populate(lab); });
    $('#speed-range').addEventListener('input', (event) => { lab.speed = Number(event.target.value); $('#speed-output').textContent = `${lab.speed.toFixed(1)}×`; });
    document.querySelectorAll('[data-scene]').forEach((button) => button.addEventListener('click', () => {
      lab.mode = button.dataset.scene;
      document.querySelectorAll('[data-scene]').forEach((b) => { const selected = b === button; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected)); });
      const [name, note, title, description] = sceneCopy[lab.mode];
      $('#lab-object-name').textContent = name; $('#lab-object-note').textContent = note;
      $('#lab-explanation strong').textContent = title; $('#lab-explanation p').textContent = description;
      const options = $('#material-select').options;
      options[0].text = lab.mode === 'particles' ? '粒子 · 柔光' : '实体 · 光照材质';
      options[1].text = lab.mode === 'particles' ? '轮廓 · 环线' : '线框 · 结构视图';
      options[2].text = lab.mode === 'particles' ? '通透 · 淡色' : '透明 · 空间层次';
      populate(lab); lab.reset();
    }));
  }
  const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { observer.disconnect(); initLab(); } }, { rootMargin: '250px' });
  observer.observe($('#lab-stage'));
}
