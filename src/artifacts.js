import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Art objects only: the universe owns lighting, camera, rendering and timing.
const TAU = Math.PI * 2;
const FAMILY_KEYS = ['ai', 'world', 'spatial', 'compute', 'quantum', 'life', 'optics', 'art'];
const COLORS = [0xd5a65d, 0xb83148, 0x7750b4, 0x426ea5, 0xc77548];
const IDS = {
  ai: ['ai-attention', 'ai-embedding', 'ai-agents', 'ai-multimodal'],
  world: ['world-rollout', 'world-pathfinding', 'world-ik', 'world-mapping'],
  spatial: ['spatial-gaussian', 'spatial-sdf', 'spatial-encoding', 'spatial-reconstruction'],
  compute: ['compute-particles', 'compute-fluid', 'compute-boids', 'compute-gravity'],
  quantum: ['quantum-bloch', 'quantum-interference', 'quantum-bell', 'quantum-gates'],
  life: ['life-molecule', 'life-growth', 'life-reaction', 'life-folding'],
  optics: ['optics-refraction', 'optics-dispersion', 'optics-brdf', 'optics-polarization'],
  art: ['art-attractor', 'art-lsystem', 'art-waves', 'art-harmonograph'],
};
const clamp = THREE.MathUtils.clamp;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function hashSeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function randomFrom(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
class FunctionCurve extends THREE.Curve {
  constructor(fn) { super(); this.fn = fn; }
  getPoint(t, target = new THREE.Vector3()) { return target.copy(this.fn(t)); }
}
function familyFor(entry) {
  const key = String(entry.model || entry.theme || entry.category || '').toLowerCase();
  return FAMILY_KEYS.find((family) => key === family || key.startsWith(family + '-') || key.startsWith(family + ':'))
    || FAMILY_KEYS.find((family) => String(entry.id || '').startsWith(family + '-')) || 'art';
}
function variantFor(entry, family, seed) {
  if (Number.isInteger(entry.variant)) return ((entry.variant % 4) + 4) % 4;
  const known = IDS[family].indexOf(entry.id);
  return known >= 0 ? known : hashSeed(entry.experiment || entry.id || seed) % 4;
}

export function createArtifact(entry = {}, { quality = 1 } = {}) {
  const family = familyFor(entry);
  const seed = Number.isFinite(entry.seed) ? entry.seed >>> 0 : hashSeed(entry.id || entry.experiment || family);
  const variant = variantFor(entry, family, seed);
  const q = clamp(Number(quality) || 1, .35, 1.4);
  const random = randomFrom(seed);
  const group = new THREE.Group();
  group.name = 'artifact:' + (entry.id || family);
  const display = new THREE.Group(), sculpture = new THREE.Group();
  group.add(display); display.add(sculpture);
  const geometries = new Set(), materials = new Set(), compiledShaders = new Set();
  const parts = [], animations = [], instanceSets = [];
  const controls = new Map((entry.controls || []).map((control) => [control.key, control]));
  const state = {
    phase: random() * TAU, speed: .7, spread: 1, morph: .35, density: 1,
    scale: 1, emission: 1, blast: 0, blastVelocity: 0, spin: 0, spinVelocity: 0,
    gravity: 0, wave: 0, fit: 1, disposed: false,
  };
  const geo = (geometry) => { geometries.add(geometry); return geometry; };
  const mat = (material) => { materials.add(material); return material; };
  const shade = (index = 0, options = {}) => {
    const color = COLORS[((index % COLORS.length) + COLORS.length) % COLORS.length];
    const material = mat(new THREE.MeshPhysicalMaterial({
      color, metalness: .76, roughness: .26, clearcoat: .85, clearcoatRoughness: .20,
      envMapIntensity: .9, emissive: color, emissiveIntensity: .035,
      side: THREE.DoubleSide, ...options,
    }));
    material.userData.artifactBaseColor = material.color.clone();
    material.userData.artifactBaseEmission = material.emissiveIntensity;
    return material;
  };
  const graphite = () => shade(0, { color: 0x171621, metalness: .72, roughness: .34, emissiveIntensity: .008 });
  const glow = (index = 0, options = {}) => shade(index, { metalness: .35, roughness: .24, emissiveIntensity: .28, ...options });
  const glass = (index = 3, transmission = .16) => shade(index, {
    metalness: .03, roughness: .10, transmission, thickness: .55, ior: 1.47,
    transparent: true, opacity: transmission ? .92 : .42, depthWrite: false,
    attenuationDistance: 1.5, attenuationColor: new THREE.Color(COLORS[index % COLORS.length]),
    clearcoat: 1, emissiveIntensity: .018, envMapIntensity: 1.05,
  });
  function mesh(geometry, material, position = null, parent = sculpture) {
    const object = new THREE.Mesh(geometry, material);
    if (position) object.position.copy(position);
    parent.add(object);
    return object;
  }
  function part(object, animate = null, weight = 1) {
    if (!object.parent) sculpture.add(object);
    const axis = object.position.clone();
    if (axis.lengthSq() < .02) axis.set(random() - .5, random() - .5, random() - .5);
    parts.push({
      object, position: object.position.clone(), quaternion: object.quaternion.clone(),
      scale: object.scale.clone(), axis: axis.normalize(), animate, weight,
      phase: random() * TAU,
    });
    return object;
  }
  function fuse(list) {
    if (!list.length) return geo(new THREE.BufferGeometry());
    const merged = mergeGeometries(list, false);
    list.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Artifact geometry attributes could not be combined.');
    return geo(merged);
  }
  function tube(fn, radius = .045, segments = 100, sides = 7) {
    return geo(new THREE.TubeGeometry(new FunctionCurve(fn), Math.max(12, Math.round(segments * q)), radius, sides, false));
  }
  function tubeRaw(fn, radius = .03, segments = 40, sides = 6) {
    return new THREE.TubeGeometry(new FunctionCurve(fn), Math.max(8, Math.round(segments * q)), radius, sides, false);
  }
  function edgeRaw(a, b, radius = .028, bend = .05) {
    const midpoint = a.clone().lerp(b, .5).add(vec(0, bend, bend * .6));
    return tubeRaw((t) => a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(midpoint, 2 * t * (1 - t)).addScaledVector(b, t * t), radius, 9);
  }
  function ring(radius, thickness = .055, index = 0, squash = 1, phase = 0) {
    return mesh(tube((t) => vec(Math.cos(t * TAU + phase) * radius, Math.sin(t * TAU + phase) * radius * squash, 0), thickness, 120, 8), shade(index));
  }
  function gear(outer = 2, inner = 1.65, teeth = 24, depth = .12) {
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth * 4; i++) {
      const a = i / (teeth * 4) * TAU;
      const radius = outer * (i % 4 === 1 || i % 4 === 2 ? 1 : .952);
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
      if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, -TAU, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 2, steps: 1,
      bevelSize: Math.min(.025, depth * .2), bevelThickness: Math.min(.025, depth * .2), curveSegments: 48,
    });
    geometry.translate(0, 0, -depth / 2);
    return geo(geometry);
  }
  function roundedFrame(width, height, thickness = .13, depth = .12) {
    const r = Math.min(width, height) * .16;
    const path = new THREE.Shape();
    path.moveTo(-width / 2 + r, -height / 2);
    path.lineTo(width / 2 - r, -height / 2); path.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
    path.lineTo(width / 2, height / 2 - r); path.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
    path.lineTo(-width / 2 + r, height / 2); path.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
    path.lineTo(-width / 2, -height / 2 + r); path.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);
    const hole = new THREE.Path();
    const w = width / 2 - thickness, h = height / 2 - thickness;
    hole.moveTo(-w, -h); hole.lineTo(-w, h); hole.lineTo(w, h); hole.lineTo(w, -h); hole.closePath();
    path.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(path, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: .025, bevelThickness: .025, curveSegments: 12 });
    geometry.translate(0, 0, -depth / 2);
    return geo(geometry);
  }
  function prism(radius = .8, height = 2, facets = 6, taper = .65) {
    const points = [
      new THREE.Vector2(0, -height * .5), new THREE.Vector2(radius * taper, -height * .5 + .13),
      new THREE.Vector2(radius, -height * .24), new THREE.Vector2(radius, height * .28),
      new THREE.Vector2(radius * .6, height * .43), new THREE.Vector2(0, height * .5),
    ];
    return geo(new THREE.LatheGeometry(points, facets));
  }
  function instances(geometry, material, count, pose, colorize = true) {
    const object = new THREE.InstancedMesh(geometry, material, count);
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.frustumCulled = false;
    if (colorize) {
      // Instance colors should not be multiplied by a gold base material.
      material.color.setHex(0xd9d9d9);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) { color.setHex(COLORS[(i + variant) % COLORS.length]); object.setColorAt(i, color); }
    }
    sculpture.add(object);
    instanceSets.push({ object, maximum: count, pose });
    return object;
  }
  function deform(material, amplitude = .1, frequency = 3) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uArtifactTime = { value: 0 };
      shader.uniforms.uArtifactMorph = { value: .35 };
      shader.uniforms.uArtifactWave = { value: 0 };
      shader.vertexShader = 'uniform float uArtifactTime, uArtifactMorph, uArtifactWave;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * (sin(position.x * ' + frequency.toFixed(2) + ' + uArtifactTime * .45) + cos(position.y * 2.7 - uArtifactTime * .32) + sin(position.z * 3.1 + uArtifactTime * .26)) * ' + amplitude.toFixed(3) + ' * (uArtifactMorph + uArtifactWave * .5);');
      compiledShaders.add(shader);
    };
    material.customProgramCacheKey = () => 'nebula-deform-' + amplitude + '-' + frequency;
    material.needsUpdate = true;
    return material;
  }
  function ribbon(fn, width = .25, segments = 200, crossSegments = 8) {
    const positions = [], uvs = [], indices = [];
    const samples = Math.round(segments * q);
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = fn(t);
      const before = fn(Math.max(0, t - .0005)), after = fn(Math.min(1, t + .0005));
      const tangent = after.clone().sub(before).normalize();
      const radial = p.clone().normalize();
      let normal = new THREE.Vector3().crossVectors(tangent, radial).normalize();
      if (normal.lengthSq() < .2) normal = new THREE.Vector3().crossVectors(tangent, vec(0, 1, 0)).normalize();
      const twist = t * TAU * (1 + variant * .25);
      normal.applyAxisAngle(tangent, twist);
      for (let j = 0; j <= crossSegments; j++) {
        const v = (j / crossSegments - .5) * 2;
        const point = p.clone().addScaledVector(normal, v * width * (.75 + .25 * Math.sin(t * TAU * 3)));
        positions.push(point.x, point.y, point.z); uvs.push(t, j / crossSegments);
        if (i < samples && j < crossSegments) {
          const a = i * (crossSegments + 1) + j, b = a + crossSegments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geo(geometry);
  }

  function buildAI() {
    const nodes = [], links = [];
    if (variant === 0) {
      for (let level = 0; level < 5; level++) for (let j = 0; j < 12; j++) {
        const a = j / 12 * TAU + level * .14;
        const r = 1.05 + .55 * Math.sin(level / 4 * Math.PI);
        nodes.push(vec(Math.cos(a) * r, (level - 2) * .65, Math.sin(a) * r));
      }
      for (let level = 0; level < 4; level++) for (let j = 0; j < 12; j++) {
        links.push(edgeRaw(nodes[level * 12 + j], nodes[(level + 1) * 12 + j], .018));
        links.push(edgeRaw(nodes[level * 12 + j], nodes[(level + 1) * 12 + (j + 2) % 12], .012, .09));
      }
      for (let i = 0; i < 3; i++) {
        const hoop = ring(1.8 + i * .13, .028, i);
        hoop.rotation.x = Math.PI / 2; hoop.position.y = (i - 1) * .7;
        part(hoop, (t, s, node) => { node.rotation.z += t * .035 * (i % 2 ? -1 : 1); }, .45);
      }
    } else if (variant === 1) {
      for (let i = 0; i < 84; i++) {
        const a = i * .29, y = (i / 83 - .5) * 3.4;
        const r = .65 + .8 * Math.pow(Math.sin(i / 83 * Math.PI), 2);
        nodes.push(vec(Math.cos(a) * r, y, Math.sin(a) * r));
        if (i > 1) links.push(edgeRaw(nodes[i - 2], nodes[i], .02, .08));
        if (i > 13) links.push(edgeRaw(nodes[i - 13], nodes[i], .013, .06));
      }
      const outer = mesh(ribbon((t) => vec(Math.cos(t * TAU * 2) * 1.85, (t - .5) * 3.7, Math.sin(t * TAU * 2) * 1.85), .11, 160), deform(shade(0), .035));
      part(outer, (t, s, node) => { node.rotation.y += t * .05; }, .6);
    } else if (variant === 2) {
      for (let cluster = 0; cluster < 6; cluster++) {
        const a = cluster / 6 * TAU;
        const center = vec(Math.cos(a) * 1.8, Math.sin(a) * 1.2, Math.sin(a * 2) * .7);
        const crown = mesh(prism(.23, .65, 6), shade(cluster), center);
        crown.rotation.z = a - Math.PI / 2;
        part(crown, (t, s, node) => { node.rotation.y += t * .25; }, .9);
        for (let j = 0; j < 5; j++) nodes.push(center.clone().add(vec(Math.cos(j / 5 * TAU) * .38, Math.sin(j / 5 * TAU) * .38, .15)));
        links.push(edgeRaw(center, vec(0, 0, 0), .045, .25));
        const next = vec(Math.cos(a + TAU / 6) * 1.8, Math.sin(a + TAU / 6) * 1.2, Math.sin((a + TAU / 6) * 2) * .7);
        links.push(edgeRaw(center, next, .025, -.12));
      }
      const center = mesh(prism(.36, 1.1, 8), graphite());
      part(center, (t, s, node) => { node.rotation.y += t * .13; });
    } else {
      for (let fan = 0; fan < 3; fan++) {
        const section = new THREE.Group();
        section.rotation.y = fan / 3 * TAU;
        section.rotation.z = .45;
        sculpture.add(section);
        const fanLinks = [];
        for (let row = 0; row < 5; row++) for (let col = 0; col <= row + 2; col++) {
          const p = vec((col - (row + 2) / 2) * .4, row * .38 - .9, .55 + Math.sin(col) * .08);
          const transformed = p.clone().applyEuler(section.rotation);
          nodes.push(transformed);
          if (col) fanLinks.push(edgeRaw(p.clone().add(vec(-.4, 0, 0)), p, .018));
          if (row) fanLinks.push(edgeRaw(p, p.clone().add(vec(.15, -.38, 0)), .014));
        }
        mesh(fuse(fanLinks), shade(fan), null, section);
        part(section, (t, s, node) => { node.rotation.y += Math.sin(t * .24 + fan) * .09; }, .65);
      }
    }
    if (links.length) part(mesh(fuse(links), shade(0, { roughness: .31, emissiveIntensity: .055 })), null, .15);
    instances(geo(new THREE.OctahedronGeometry(.115, 1)), glow(0, { emissiveIntensity: .13 }), nodes.length, (i, t, s) => {
      const p = nodes[i].clone().multiplyScalar(s.spread + s.blast * .12);
      return { position: p, scale: vec(1, 1.4 + .25 * Math.sin(i + t), 1), rotation: vec(t * .15, i * .4, 0) };
    });
  }

  function buildWorld() {
    if (variant === 0) {
      for (let i = 0; i < 4; i++) {
        const hoop = mesh(gear(2.15 - i * .27, 1.93 - i * .27, 28 + i * 4, .12), shade(i === 3 ? 1 : i % 2 ? 4 : 0));
        hoop.rotation.set(i * .54, i * .74, i * .21);
        part(hoop, (t, s, node) => { node.rotation.x += Math.sin(t * .21 + i) * .17; node.rotation.y += t * (.08 + i * .015); }, .6 + i * .16);
      }
      const axle = mesh(prism(.38, 1.55, 8), graphite());
      axle.rotation.x = Math.PI / 2; part(axle, (t, s, node) => { node.rotation.y += t * .18; }, .3);
      const cap = mesh(geo(new THREE.IcosahedronGeometry(.48, 0)), shade(0)); part(cap, (t, s, node) => { node.rotation.y += t * .14; }, .4);
    } else if (variant === 1) {
      const honey = [], route = [];
      for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) {
        const center = vec(x * .54, y * .55 + (x % 2) * .25, Math.sin(x * .8) * .35);
        const points = [];
        for (let j = 0; j <= 6; j++) points.push(center.clone().add(vec(Math.cos(j / 6 * TAU) * .27, Math.sin(j / 6 * TAU) * .27, 0)));
        for (let j = 0; j < 6; j++) honey.push(edgeRaw(points[j], points[j + 1], .018, 0));
      }
      part(mesh(fuse(honey), graphite()), null, .25);
      for (let i = 0; i < 13; i++) route.push(vec((i - 6) * .28, Math.sin(i * .48) * .65, .3 + Math.sin(i * .3) * .35));
      const path = new THREE.CatmullRomCurve3(route);
      part(mesh(geo(new THREE.TubeGeometry(path, 140, .06, 8)), shade(0)), null, .2);
      instances(prism(.07, .23, 5), glow(1, { emissiveIntensity: .24 }), 18, (i, t, s) => ({
        position: path.getPointAt((i / 18 + t * .03) % 1).multiplyScalar(s.spread),
        scale: vec(1, 1, 1), rotation: vec(0, t + i, Math.PI / 2),
      }));
    } else if (variant === 2) {
      const arm = new THREE.Group(); sculpture.add(arm);
      const base = mesh(gear(.9, .54, 32, .2), graphite(), vec(0, -1.65, 0)); base.rotation.x = Math.PI / 2; part(base, null, .3);
      const joints = [vec(-.48, -1.3, 0), vec(-.8, -.25, .15), vec(.1, .65, .0), vec(1.2, .75, .25)];
      const linkGeo = prism(.16, 1, 6, .8);
      const links = [];
      joints.forEach((p, i) => {
        const joint = mesh(gear(.24, .12, 16, .18), shade(i % 2 ? 1 : 0), p, arm);
        joint.rotation.y = Math.PI / 2;
        links.push(joint);
        if (i) {
          const start = joints[i - 1], end = p;
          const link = mesh(linkGeo, shade(i % 2 ? 0 : 4), start.clone().lerp(end, .5), arm);
          link.scale.y = start.distanceTo(end);
          link.quaternion.setFromUnitVectors(vec(0, 1, 0), end.clone().sub(start).normalize());
        }
      });
      const gripper = mesh(roundedFrame(.55, .38, .10, .12), shade(0), joints[3].clone().add(vec(.23, 0, 0)), arm);
      gripper.rotation.y = Math.PI / 2;
      part(arm, (t, s, node) => { node.rotation.y += Math.sin(t * .24) * .25 * s.morph; node.rotation.z += Math.sin(t * .18) * .15; }, .65);
      const target = mesh(geo(new THREE.OctahedronGeometry(.19, 0)), glow(2), vec(1.65, 1.2, .2));
      part(target, (t, s, node) => { node.position.y += Math.sin(t * .35) * .35; node.rotation.y += t * .35; }, 1);
    } else {
      for (let i = 0; i < 5; i++) {
        const frame = mesh(roundedFrame(3.4 - i * .32, 3.0 - i * .24, .11, .11), shade(i % 3), vec(0, 0, (i - 2) * .42));
        frame.rotation.z = i * .15;
        part(frame, (t, s, node) => { node.rotation.z += Math.sin(t * .2 + i) * .08; node.position.z *= s.spread; }, .7);
      }
      const dish = mesh(prism(.62, .28, 24, .35), graphite(), vec(0, -.25, 0));
      dish.rotation.x = Math.PI / 2; part(dish, (t, s, node) => { node.rotation.z += t * .3; }, .4);
      const sweep = ring(1.2, .035, 1, .25);
      sweep.rotation.x = Math.PI / 2; part(sweep, (t, s, node) => { node.rotation.z += t * .45; }, .4);
    }
  }

  function gyroidGeometry() {
    const n = Math.max(14, Math.round(22 * q)), length = 4.2;
    const field = new Float32Array((n + 1) ** 3);
    const stride = n + 1;
    const index = (x, y, z) => x + y * stride + z * stride * stride;
    for (let z = 0; z <= n; z++) for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
      const p = vec((x / n - .5) * length, (y / n - .5) * length, (z / n - .5) * length);
      const a = p.clone().multiplyScalar(2.45);
      const value = Math.sin(a.x) * Math.cos(a.y) + Math.sin(a.y) * Math.cos(a.z) + Math.sin(a.z) * Math.cos(a.x);
      field[index(x, y, z)] = Math.max(Math.abs(value) - .26, p.length() - 1.98);
    }
    const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tetrahedra = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const tetraEdges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const positions = [];
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const ps = corners.map(([dx,dy,dz]) => vec(((x + dx) / n - .5) * length, ((y + dy) / n - .5) * length, ((z + dz) / n - .5) * length));
      const fs = corners.map(([dx,dy,dz]) => field[index(x + dx, y + dy, z + dz)]);
      for (const tetra of tetrahedra) {
        const intersections = [];
        for (const [ea, eb] of tetraEdges) {
          const a = tetra[ea], b = tetra[eb];
          if ((fs[a] < 0) === (fs[b] < 0)) continue;
          intersections.push(ps[a].clone().lerp(ps[b], fs[a] / (fs[a] - fs[b])));
        }
        if (intersections.length < 3) continue;
        if (intersections.length === 4) {
          const center = intersections.reduce((sum, p) => sum.add(p), vec()).multiplyScalar(.25);
          const normal = intersections[1].clone().sub(intersections[0]).cross(intersections[2].clone().sub(intersections[0])).normalize();
          const axis = intersections[0].clone().sub(center).normalize(), perpendicular = normal.clone().cross(axis);
          intersections.sort((a,b) => Math.atan2(a.clone().sub(center).dot(perpendicular),a.clone().sub(center).dot(axis)) - Math.atan2(b.clone().sub(center).dot(perpendicular),b.clone().sub(center).dot(axis)));
        }
        const push = (a,b,c) => { for (const p of [a,b,c]) positions.push(p.x,p.y,p.z); };
        push(intersections[0], intersections[1], intersections[2]);
        if (intersections.length === 4) push(intersections[0], intersections[2], intersections[3]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geo(geometry);
  }
  function buildSpatial() {
    if (variant === 0) {
      const count = Math.round(840 * q);
      const seeds = Array.from({ length: count }, () => [random(),random(),random()]);
      instances(geo(new THREE.IcosahedronGeometry(.10, 0)), shade(3, { roughness: .34, emissiveIntensity: .06 }), count, (i,t,s) => {
        const [u,v,w] = seeds[i], a = u * TAU * 2, r = .4 + v * 1.5;
        const p = vec(Math.cos(a) * r, Math.sin(a * 1.5) * .9 + (w-.5) * .6, Math.sin(a) * r);
        p.multiplyScalar(s.spread * (1 + s.blast * .10));
        return { position:p, scale:vec(.7 + v, .16 + w*.2, 1.1 + v*1.3), rotation:vec(a*.6,t*.05+a,a*.3) };
      });
      for (let i = 0; i < 3; i++) {
        const guide = ring(1.75 + i*.16,.015,i);
        guide.rotation.x = i*.6; guide.rotation.y = i*.8;
        part(guide,(t,s,node)=>{node.rotation.z += t*.045;},.3);
      }
    } else if (variant === 1) {
      const shell = mesh(gyroidGeometry(), deform(shade(0,{roughness:.3,clearcoat:.95}),.012,4));
      part(shell,(t,s,node)=>{node.rotation.y += t*.045;},.25);
      const center = mesh(geo(new THREE.OctahedronGeometry(.35,1)),glass(2,.10)); part(center,null,.6);
    } else if (variant === 2) {
      const count = 13 * 13;
      instances(prism(.115,.4,6,.92),shade(0),count,(i,t,s)=>{
        const x=i%13-6,z=Math.floor(i/13)-6,rad=Math.hypot(x,z);
        const h=.35+(.5+.5*Math.sin(x*.5+z*.7+t*.5))*1.4*(.35+s.morph);
        return {position:vec(x*.28*s.spread,h*.45-.45,z*.28*s.spread),scale:vec(1,h,1),rotation:vec(0,Math.PI/6,0)};
      });
      const rim = ring(2.05,.025,3); rim.rotation.x=Math.PI/2; rim.position.y=-.65; part(rim,null,.35);
    } else {
      for(let i=0;i<14;i++){
        const y=(i/13-.5)*3.0,r=.45+Math.sin(i/13*Math.PI)*1.3;
        const layer=mesh(tube(t=>{const a=t*TAU;const radius=r*(1+.14*Math.cos(a*5+i*.3));return vec(Math.cos(a)*radius,y,Math.sin(a)*radius);},.035,90),shade(i%4));
        part(layer,(t,s,node)=>{node.rotation.y += Math.sin(t*.22+i*.23)*.16;node.position.y += Math.sin(t*.28+i)*.035;},.55);
      }
      const spine=mesh(tube(t=>vec(.15*Math.sin(t*TAU*2),(t-.5)*3.4,.15*Math.cos(t*TAU*2)),.06,130),graphite());part(spine,null,.25);
    }
  }

  function buildCompute(){
    if(variant===0||variant===3){
      const streams=variant===0?5:3;
      const paths=[];
      for(let i=0;i<streams;i++){
        const fn=t=>{const a=t*TAU*(variant===0?2:1)+i/streams*TAU;const r=variant===0?.7+t*1.4:1.3+.55*Math.sin(a*2+i);return vec(Math.cos(a)*r,Math.sin(a)*r*.65,(t-.5)*1.7+Math.sin(a*2)*.32);};
        paths.push(fn);
        const band=mesh(ribbon(fn,variant===0?.055:.15,170,5),deform(shade(i),.045,4));
        part(band,(t,s,node)=>{node.rotation.z+=t*.03*(i%2?-1:1);},.45);
      }
      const count=Math.round((variant===0?620:460)*q);
      instances(geo(new THREE.OctahedronGeometry(.055,0)),glow(0,{emissiveIntensity:.19}),count,(i,t,s)=>{
        const u=(i/count+t*.032*(1+i%5*.07))%1;
        const p=paths[i%streams](u).multiplyScalar(s.spread*(1-s.gravity*.24+s.blast*.12));
        return{position:p,scale:vec(.55,.8,.55),rotation:vec(t*.2,i*.3,t*.15)};
      });
      if(variant===3){const heart=mesh(prism(.48,1.3,7),graphite());part(heart,(t,s,node)=>{node.rotation.y+=t*.09;},.2);}
    }else if(variant===1){
      for(let layer=0;layer<3;layer++){
        const fn=t=>{const a=t*TAU;const r=1.4+.28*Math.sin(a*3+layer);return vec(Math.cos(a)*r,Math.sin(a*2)*.65+(layer-1)*.36,Math.sin(a)*r);};
        const band=mesh(ribbon(fn,.43,200,12),deform(shade(layer?3:4,{metalness:.46,roughness:.19,clearcoat:1}),.16,2.5));
        band.rotation.z=layer*.24;part(band,(t,s,node)=>{node.rotation.y+=Math.sin(t*.21+layer)*.12;node.scale.y*=.8+s.morph*.5;},.6);
      }
      instances(geo(new THREE.OctahedronGeometry(.055,1)),glow(1,{emissiveIntensity:.15}),180,(i,t,s)=>{const a=i/180*TAU;return{position:vec(Math.cos(a)*1.95,Math.sin(a*3+t*.6)*.7,Math.sin(a)*1.95),scale:vec(.5,.7,.5),rotation:vec(a,0,t*.1)};});
    }else{
      const count=Math.round(420*q);
      const cone=geo(new THREE.ConeGeometry(.065,.24,3));
      instances(cone,shade(0,{roughness:.22}),count,(i,t,s)=>{
        const a=i*.23+t*.18,r=.5+(i%90)/90*1.5;
        const p=vec(Math.cos(a)*r,Math.sin(a*1.4+t*.12)*.75,Math.sin(a)*r);
        p.multiplyScalar(s.spread*(1+s.blast*.14));
        return{position:p,scale:vec(.6,.6,.6),rotation:vec(Math.PI/2,a+.5,Math.sin(a)*.3)};
      });
      for(let i=0;i<3;i++){const rail=mesh(tube(t=>{const a=t*TAU;return vec(Math.cos(a)*1.9,Math.sin(a*1.4+i)*.7,Math.sin(a)*1.9);},.022,160),shade(i));part(rail,(t,s,node)=>{node.rotation.y+=t*.03;},.3);}
    }
  }

  function buildQuantum(){
    if(variant===0){
      for(let i=0;i<5;i++){const hoop=ring(1.65+i*.08,.026,i%2?3:0);hoop.rotation.y=i/5*Math.PI;part(hoop,(t,s,node)=>{node.rotation.z+=t*.018;},.35);}
      const axis=mesh(tube(t=>vec(0,(t-.5)*3.8,0),.035,20),graphite());part(axis,null,.2);
      const arrow=new THREE.Group();sculpture.add(arrow);
      mesh(geo(new THREE.CylinderGeometry(.043,.043,1.65,8)),shade(1),vec(0,.6,0),arrow);
      mesh(geo(new THREE.ConeGeometry(.16,.35,6)),shade(0),vec(0,1.54,0),arrow);
      part(arrow,(t,s,node)=>{node.rotation.set(Math.sin(t*.15)*.7,0,t*.12);},.75);
      const gem=mesh(geo(new THREE.OctahedronGeometry(.36,0)),glass(2,.12));part(gem,(t,s,node)=>{node.rotation.y+=t*.14;},.4);
    }else if(variant===1){
      for(let i=0;i<7;i++){
        const fn=t=>{const a=t*TAU;const radius=1.35+.28*Math.sin(a*4+i*.6);return vec(Math.cos(a)*radius,Math.sin(a)*radius*.75,Math.sin(a*3+i*.4)*.3+(i-3)*.12);};
        const hoop=mesh(tube(fn,.039,160),shade(i%4));
        part(hoop,(t,s,node)=>{node.rotation.y+=Math.sin(t*.2+i*.35)*.17;node.scale.y*=.82+s.morph*.36;},.5);
      }
      const count=250;instances(geo(new THREE.OctahedronGeometry(.04,0)),glow(3),count,(i,t,s)=>{const a=i/count*TAU;const r=1.6+.16*Math.sin(a*6+t*.4);return{position:vec(Math.cos(a)*r,Math.sin(a)*r*.7,Math.sin(a*3+t*.3)*.6),scale:vec(1,1,1),rotation:vec(0,a,t*.2)};});
    }else if(variant===2){
      for(let side=-1;side<=1;side+=2){
        const subsystem=new THREE.Group();subsystem.position.x=side*.9;sculpture.add(subsystem);
        for(let i=0;i<3;i++){const hoop=ring(.83+i*.075,.041,side<0?1:3);hoop.rotation.set(i*.65,i*.45,0);subsystem.add(hoop);}
        mesh(geo(new THREE.OctahedronGeometry(.22,0)),glass(side<0?1:3,.08),null,subsystem);
        part(subsystem,(t,s,node)=>{node.rotation.y+=side*t*.14;node.position.x*=s.spread;},.85);
      }
      const bridge=mesh(ribbon(t=>vec((t-.5)*2.2,Math.sin(t*TAU*3)*.25,Math.cos(t*TAU*3)*.25),.075,150),shade(0));part(bridge,null,.25);
    }else{
      for(let i=0;i<5;i++){
        const frame=mesh(roundedFrame(2.6-i*.29,2.6-i*.29,.095,.09),shade(i%4),vec(0,0,(i-2)*.35));
        frame.rotation.z=i*Math.PI/8;part(frame,(t,s,node)=>{node.rotation.z+=t*.035*(i%2?-1:1);node.rotation.y+=Math.sin(t*.15+i)*.15;},.6);
      }
      for(let i=0;i<3;i++){const band=ring(.62+i*.18,.033,i);band.rotation.x=Math.PI/2+i*.5;part(band,(t,s,node)=>{node.rotation.y+=t*.12;},.5);}
    }
  }

  function buildLife(){
    if(variant===0){
      for(let side=0;side<2;side++){
        const strand=mesh(tube(t=>{const a=t*TAU*2.8+side*Math.PI;return vec(Math.cos(a)*.65,(t-.5)*4,Math.sin(a)*.65);},.09,220,9),shade(side?1:0));
        part(strand,(t,s,node)=>{node.rotation.y+=t*.05;},.55);
      }
      const bonds=[];
      const beads=[];
      for(let i=0;i<25;i++){
        const u=i/24,a=u*TAU*2.8,y=(u-.5)*4;
        const p=vec(Math.cos(a)*.65,y,Math.sin(a)*.65),end=vec(-p.x,y,-p.z);
        bonds.push(edgeRaw(p,end,.045,0));beads.push(p,end);
      }
      part(mesh(fuse(bonds),shade(3)),(t,s,node)=>{node.rotation.y+=t*.05;},.4);
      instances(geo(new THREE.IcosahedronGeometry(.14,0)),shade(0),beads.length,(i,t,s)=>({position:beads[i].clone().applyAxisAngle(vec(0,1,0),t*.05).multiplyScalar(1+s.blast*.1),scale:vec(1,1,1),rotation:vec(t*.1,i*.3,0)}));
    }else if(variant===1){
      const branches=[],leaves=[];
      function grow(start,direction,length,depth){
        const end=start.clone().addScaledVector(direction,length);
        branches.push(edgeRaw(start,end,.018+depth*.015,length*.07));
        if(!depth){leaves.push(end);return;}
        for(let side=0;side<3;side++){
          const next=direction.clone().applyAxisAngle(vec(Math.cos(side/3*TAU),0,Math.sin(side/3*TAU)),.43).add(vec((random()-.5)*.14,.04,(random()-.5)*.14)).normalize();
          grow(end,next,length*.66,depth-1);
        }
      }
      grow(vec(0,-1.65,0),vec(0,1,0),.85,4);
      part(mesh(fuse(branches),shade(4,{roughness:.34})),(t,s,node)=>{node.rotation.y+=Math.sin(t*.13)*.12;node.scale.y*=.9+s.morph*.3;},.3);
      instances(prism(.075,.26,5,.45),shade(1),leaves.length,(i,t,s)=>({position:leaves[i].clone().multiplyScalar(s.spread*(1+s.blast*.16)),scale:vec(1,1+.25*Math.sin(i+t*.4),1),rotation:vec(Math.sin(i)*.9,i*2.4,t*.07)}));
    }else if(variant===2){
      for(let layer=0;layer<4;layer++){
        const fn=t=>{const a=t*TAU,r=1.15+.25*Math.sin(a*(5+layer)+layer);return vec(Math.cos(a)*r,Math.sin(a*3+layer)*.42+(layer-1.5)*.32,Math.sin(a)*r);};
        const petal=mesh(ribbon(fn,.32,200,10),deform(shade(layer%2?1:4,{metalness:.35,roughness:.30,clearcoat:1}),.09,4));
        petal.rotation.y=layer*.4;
        part(petal,(t,s,node)=>{node.rotation.y+=Math.sin(t*.12+layer)*.10;node.scale.y*=.9+s.morph*.4;},.7);
      }
      const seedMesh=mesh(prism(.3,.95,7),glass(2,.12));part(seedMesh,(t,s,node)=>{node.rotation.y+=t*.08;},.45);
    }else{
      const path=t=>{const a=t*TAU*4.5;const r=1.25+.38*Math.sin(t*TAU*3);return vec(Math.cos(a)*r,Math.sin(t*TAU*2.5)*.7,Math.sin(a)*r*.65);};
      const folded=mesh(tube(path,.115,480,9),deform(shade(4,{metalness:.35,roughness:.28}),.035,3));
      part(folded,(t,s,node)=>{node.rotation.y+=t*.035;},.4);
      for(let i=0;i<2;i++){
        const sheet=mesh(ribbon(t=>vec((t-.5)*2.9,Math.sin(t*TAU*3)*.23+(i-.5)*.7,Math.sin(t*Math.PI)*.9),.24,120),shade(i?1:0));
        sheet.rotation.y=i*Math.PI/2;part(sheet,(t,s,node)=>{node.rotation.z+=Math.sin(t*.14+i)*.08;},.6);
      }
      const count=100;instances(geo(new THREE.OctahedronGeometry(.105,1)),shade(3),count,(i,t,s)=>({position:path(i/(count-1)).multiplyScalar(1+s.blast*.12),scale:vec(.7,.7,.7),rotation:vec(i,t*.05,i*.3)}));
    }
  }

  function buildOptics(){
    if(variant===0){
      const crystal=mesh(prism(.85,3.0,6,.45),glass(3,.24));
      crystal.rotation.z=.16;part(crystal,(t,s,node)=>{node.rotation.y+=t*.06;},.4);
      for(let i=0;i<3;i++){const clampRing=mesh(gear(1.13,.94,30,.1),shade(0));clampRing.rotation.x=Math.PI/2;clampRing.position.y=(i-1)*.86;part(clampRing,(t,s,node)=>{node.rotation.z+=t*.04;},.65);}
      const rays=[];for(let i=0;i<7;i++)rays.push(edgeRaw(vec(-2,.7+(i-3)*.09,-.2),vec(2,-.4+(i-3)*.16,.2),.012,0));
      part(mesh(fuse(rays),glow(0,{emissiveIntensity:.18})),null,.2);
    }else if(variant===1){
      for(let i=0;i<7;i++){
        const shard=mesh(prism(.20,2.3+i*.10,3,.22),i===3?glass(2,.17):shade(i%4,{metalness:.24,roughness:.15,clearcoat:1}));
        shard.position.set((i-3)*.26,Math.abs(i-3)*.10,Math.sin(i)*.16);
        shard.rotation.z=(i-3)*.14;
        part(shard,(t,s,node)=>{node.rotation.y+=t*.065;node.position.x*=s.spread;},.8);
      }
      const bracket=ring(1.7,.08,0,.72);bracket.rotation.x=Math.PI/2;bracket.position.y=-1.05;part(bracket,null,.25);
    }else if(variant===2){
      const count=16;
      for(let i=0;i<count;i++){
        const a=i/count*TAU;
        const blade=mesh(prism(.17,1.55,5,.5),shade(i%2?0:4,{roughness:.08+(i/(count-1))*.68,metalness:.95,clearcoat:.85}));
        blade.position.set(Math.cos(a)*1.05,Math.sin(a)*1.05,0);
        blade.rotation.z=a-Math.PI/2;
        part(blade,(t,s,node)=>{node.rotation.y+=Math.sin(t*.16+i*.22)*.15;},.6);
      }
      const central=mesh(geo(new THREE.IcosahedronGeometry(.75,1)),graphite());part(central,(t,s,node)=>{node.rotation.y+=t*.05;},.25);
      const rim=ring(1.92,.04,3);part(rim,(t,s,node)=>{node.rotation.z+=t*.025;},.3);
    }else{
      for(let layer=0;layer<3;layer++){
        const filter=new THREE.Group();filter.position.z=(layer-1)*.64;filter.rotation.z=layer*.55;sculpture.add(filter);
        mesh(roundedFrame(2.7,2.7,.13,.1),shade(layer===1?1:0),null,filter);
        const wires=[];for(let i=-7;i<=7;i++)wires.push(edgeRaw(vec(i*.15,-1.12,0),vec(i*.15,1.12,0),.015,0));
        mesh(fuse(wires),shade(layer%2?3:0),null,filter);
        part(filter,(t,s,node)=>{node.rotation.z+=Math.sin(t*.19+layer)*(.07+s.morph*.15);node.position.z*=s.spread;},.75);
      }
      const lens=mesh(prism(.42,.18,24,.96),glass(2,0));lens.rotation.x=Math.PI/2;part(lens,null,.3);
    }
  }

  function buildArt(){
    if(variant===0){
      const points=[];let x=.1,y=.4,z=.2;
      for(let i=0;i<2200;i++){
        const dt=.007;
        const dx=10*(y-x),dy=x*(28-z)-y,dz=x*y-(8/3)*z;
        x+=dx*dt;y+=dy*dt;z+=dz*dt;
        if(i>150&&i%2===0)points.push(vec(x*.09,y*.065,(z-25)*.075));
      }
      const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
      const form=mesh(geo(new THREE.TubeGeometry(curve,Math.round(1400*q),.035,6,false)),shade(4,{roughness:.24}));
      part(form,(t,s,node)=>{node.rotation.y+=t*.025;node.scale.y*=.8+s.morph*.4;},.35);
      const count=80;instances(geo(new THREE.OctahedronGeometry(.055,0)),glow(0),count,(i,t,s)=>({position:curve.getPointAt((i/count+t*.02)%1).multiplyScalar(1+s.blast*.1),scale:vec(.75,.75,.75),rotation:vec(i,t,0)}));
    }else if(variant===1){
      const ribbons=[];
      let p=vec(0,-1.8,0),angle=0;
      const points=[p.clone()];
      for(let i=0;i<96;i++){
        angle+=i%2===0?Math.PI/2:-Math.PI/2;
        const length=.19+.04*Math.sin(i*.6);
        p=p.clone().add(vec(Math.cos(angle)*length,Math.sin(angle)*length,.045*Math.sin(i*.4)));
        points.push(p.clone());
      }
      const base=new THREE.CatmullRomCurve3(points);
      for(let i=0;i<4;i++){
        const curve=t=>{const p=base.getPoint(t);p.applyAxisAngle(vec(0,1,0),i/4*TAU);p.x+=Math.cos(i/4*TAU)*.6;p.z+=Math.sin(i/4*TAU)*.6;return p;};
        const strip=mesh(ribbon(curve,.10,250,4),shade(i%3));
        part(strip,(t,s,node)=>{node.rotation.y+=Math.sin(t*.11+i)*.08;},.65);
      }
    }else if(variant===2){
      for(let i=0;i<4;i++){
        const fn=t=>{const a=t*TAU,r=1.5+.42*Math.sin(a*3+i*Math.PI/2);return vec(Math.cos(a)*r,Math.sin(a*2+i)*.55,Math.sin(a)*r);};
        const band=mesh(ribbon(fn,.30,240,12),deform(shade(i,{roughness:.20,metalness:.61}),.05,3.5));
        band.rotation.z=i*.24;part(band,(t,s,node)=>{node.rotation.y+=t*.035*(i%2?-1:1);node.scale.y*=.8+s.morph*.4;},.6);
      }
    }else{
      for(let i=0;i<4;i++){
        const fn=t=>{const a=t*TAU*3;const decay=1-t*.08;return vec(Math.sin(a*3+i*.5)*1.75*decay,Math.sin(a*4+i*.7)*1.6*decay,Math.cos(a*2+i*.4)*.70);};
        const calligraphy=mesh(tube(fn,.027+i*.003,420,7),shade(i));
        part(calligraphy,(t,s,node)=>{node.rotation.y+=Math.sin(t*.1+i)*.07;node.scale.z*=.8+s.morph*.45;},.5);
      }
    }
  }

  const builders={ai:buildAI,world:buildWorld,spatial:buildSpatial,compute:buildCompute,quantum:buildQuantum,life:buildLife,optics:buildOptics,art:buildArt};
  builders[family]();
  const dummy=new THREE.Object3D();
  // Populate instance transforms before measuring the sculpture's initial extent.
  for(const item of instanceSets){
    for(let i=0;i<item.maximum;i++){
      const pose=item.pose(i,state.phase,state);
      dummy.position.copy(pose.position);dummy.scale.copy(pose.scale||vec(1,1,1));
      if(pose.quaternion)dummy.quaternion.copy(pose.quaternion);
      else dummy.rotation.set(...(pose.rotation?pose.rotation.toArray():[0,0,0]));
      dummy.updateMatrix();item.object.setMatrixAt(i,dummy.matrix);
    }
    item.object.computeBoundingBox();item.object.computeBoundingSphere();
  }
  const initialBounds=new THREE.Box3().setFromObject(sculpture);
  const center=initialBounds.isEmpty()?vec():initialBounds.getCenter(vec());
  const boundingSphere=initialBounds.getBoundingSphere(new THREE.Sphere());
  state.fit=boundingSphere.radius>0?2.4/boundingSphere.radius:1;
  sculpture.position.sub(center);
  display.scale.setScalar(state.fit);
  group.userData={...group.userData,artifactFamily:family,artifactVariant:variant,seed,quality:q};

  function update(dt=1/60,time=0){
    if(state.disposed)return;
    const delta=clamp(Number(dt)||0,0,.07);
    state.phase+=delta*state.speed;
    state.blastVelocity+=(-22*state.blast-6.5*state.blastVelocity)*delta;
    state.blast+=state.blastVelocity*delta;
    state.spin+=state.spinVelocity*delta;
    state.spinVelocity*=Math.exp(-delta*1.9);
    state.gravity*=Math.exp(-delta*1.7);
    state.wave*=Math.exp(-delta*1.65);
    const t=state.phase;
    display.rotation.set(Math.sin(t*.08)*.045,t*.035+state.spin,Math.sin(t*.06)*.025);
    display.scale.setScalar(state.fit*state.scale);
    for(const item of parts){
      const {object,position,quaternion,scale,animate,axis,weight,phase}=item;
      object.position.copy(position);object.quaternion.copy(quaternion);object.scale.copy(scale);
      if(animate)animate(t,state,object);
      object.position.addScaledVector(axis,state.blast*weight);
      object.position.multiplyScalar(1-state.gravity*.20);
      const wave=state.wave*Math.sin(t*3+phase)*.08;
      object.scale.multiplyScalar(1+wave);
    }
    for(const item of instanceSets){
      const active=Math.max(1,Math.round(item.maximum*state.density));
      item.object.count=active;
      for(let i=0;i<active;i++){
        const pose=item.pose(i,t,state);
        dummy.position.copy(pose.position);
        if(state.blast){const radial=pose.position.clone().normalize();dummy.position.addScaledVector(radial,state.blast*.40);}
        dummy.position.multiplyScalar(1-state.gravity*.15);
        dummy.scale.copy(pose.scale||vec(1,1,1));
        if(pose.quaternion)dummy.quaternion.copy(pose.quaternion);
        else if(pose.rotation)dummy.rotation.set(pose.rotation.x,pose.rotation.y,pose.rotation.z);
        else dummy.rotation.set(0,0,0);
        dummy.scale.multiplyScalar(1+state.wave*.10*Math.sin(t*3+i*.2));
        dummy.updateMatrix();item.object.setMatrixAt(i,dummy.matrix);
      }
      item.object.instanceMatrix.needsUpdate=true;
    }
    for(const fn of animations)fn(delta,t,state);
    for(const shader of compiledShaders){
      shader.uniforms.uArtifactTime.value=t;
      shader.uniforms.uArtifactMorph.value=state.morph;
      shader.uniforms.uArtifactWave.value=state.wave;
    }
    group.userData.lastExternalTime=Number.isFinite(time)?time:0;
  }
  function normalized(key,value){
    const control=controls.get(key);
    const number=Number(value);
    if(!Number.isFinite(number))return .5;
    // The main UI supplies normalized controls; raw values remain a fallback.
    if(number>=0&&number<=1)return number;
    if(control&&Number(control.max)>Number(control.min))return clamp((number-Number(control.min))/(Number(control.max)-Number(control.min)),0,1);
    return clamp(Math.abs(number)>2?number/100:number,0,1);
  }
  function setParameter(key,value){
    if(state.disposed)return;
    const name=String(key).toLowerCase(),n=normalized(key,value);
    if(/rate|speed|frequency|tempo/.test(name))state.speed=.22+n*1.65;
    else if(/spread|width|radius|distance|spacing/.test(name))state.spread=.70+n*.65;
    else if(/scale|size/.test(name))state.scale=.78+n*.40;
    else if(/material|roughness|metalness/.test(name)){
      for(const material of materials){
        if(!material.isMeshPhysicalMaterial)continue;
        if(/metal/.test(name))material.metalness=.15+n*.80;
        else material.roughness=.12+n*.52;
      }
    }else if(/power|energy|intensity|emission/.test(name)){
      state.emission=.5+n*.9;
      for(const material of materials)material.emissiveIntensity=material.userData.artifactBaseEmission*state.emission;
    }else{
      state.morph=.12+n*.90;
      if(/amount|count|density|resolution|samples|particles/.test(name))state.density=.46+n*.54;
    }
    // All families, including non-instanced ones, respond visibly to parameter changes.
    if(/amount|morph|noise|temperature|complexity/.test(name))state.scale=.90+n*.18;
    if(/spread/.test(name)&&!instanceSets.length)state.scale=.90+n*.20;
  }
  function pulse(kind='burst'){
    if(state.disposed)return;
    const action=String(kind).toLowerCase();
    if(action==='gravity'){state.gravity=Math.min(1.5,state.gravity+.95);state.wave=Math.max(.35,state.wave);}
    else if(action==='spin'||action==='reverse'){state.spinVelocity+=(action==='reverse'?-1:1)*5.5;}
    else if(action==='wave'||action==='pulse'||action==='apply-h'||action==='apply-x'){state.wave=Math.min(2,state.wave+1.3);}
    else if(action==='reset'){state.blast=0;state.blastVelocity=0;state.spinVelocity=0;state.gravity=0;state.wave=0;}
    else{state.blastVelocity=Math.min(10,state.blastVelocity+6.5);state.wave=Math.min(1.8,state.wave+.7);}
  }
  function dispose(){
    if(state.disposed)return;
    state.disposed=true;
    // Resources shared by many instances or parts are disposed exactly once.
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    geometries.clear();materials.clear();compiledShaders.clear();
    parts.length=0;animations.length=0;instanceSets.length=0;
    sculpture.clear();display.clear();group.clear();
  }
  for(const control of entry.controls||[]){
    if(control.value===undefined)continue;
    const range=Number(control.max)-Number(control.min);
    const value=range>0?clamp((Number(control.value)-Number(control.min))/range,0,1):control.value;
    setParameter(control.key,value);
  }
  update(0,0);
  return{group,update,setParameter,pulse,dispose};
}
