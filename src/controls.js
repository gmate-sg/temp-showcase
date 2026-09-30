import * as THREE from 'three';

// Input changes the camera immediately. Pointer release and idle frames never
// restore a saved pose, apply inertia, or rebuild a default orbit.
export function createPersistentControls(camera, element) {
  const host = element.ownerDocument.defaultView;
  const pointers = new Map(), listeners = [];
  let lastDragEnded = -Infinity, disposed = false, enabled = true;
  const controls = {
    target: new THREE.Vector3(),
    get enabled() { return enabled; },
    set enabled(value) { if (!value && enabled) cancelAll(); enabled = Boolean(value); },
    noRotate: false, noPan: false, noZoom: false,
    minDistance: .9, maxDistance: 500,
    rotateSpeed: 1, zoomSpeed: 1, panSpeed: 1,
    mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    begin, update: () => camera.lookAt(controls.target), handleResize() {},
    reset: cancelAll, wasDrag: () => {
      const age = host.performance.now() - lastDragEnded;
      element.dataset.dragAge = String(age);
      return age < 450;
    },
    dispose() { disposed = true; cancelAll(); listeners.forEach(off => off()); },
  };
  const on = (target, name, fn, options) => {
    target.addEventListener(name, fn, options);
    listeners.push(() => target.removeEventListener(name, fn, options));
  };
  function telemetry(action) {
    element.dataset.cameraGesture = action;
    element.dataset.pointerCount = String(pointers.size);
  }
  function rotate(dx, dy) {
    if (controls.noRotate || (!dx && !dy)) return;
    const eye = camera.position.clone().sub(controls.target);
    const right = new THREE.Vector3().crossVectors(camera.up, eye).normalize();
    const axis = camera.up.clone().normalize().multiplyScalar(-dx).addScaledVector(right, -dy).normalize();
    const box = element.getBoundingClientRect();
    const angle = Math.hypot(dx, dy) * Math.PI * controls.rotateSpeed / Math.max(1, Math.min(box.width, box.height));
    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    eye.applyQuaternion(rotation); camera.up.applyQuaternion(rotation).normalize();
    camera.position.copy(controls.target).add(eye); controls.update();
  }
  function pan(dx, dy) {
    if (controls.noPan) return;
    const eye = camera.position.clone().sub(controls.target);
    const right = new THREE.Vector3().crossVectors(camera.up, eye).normalize();
    const vertical = new THREE.Vector3().crossVectors(eye, right).normalize();
    const scale = 2 * eye.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) / (Math.max(1, element.getBoundingClientRect().height) * camera.zoom);
    const shift = right.multiplyScalar(-dx * scale * controls.panSpeed).addScaledVector(vertical, dy * scale * controls.panSpeed);
    camera.position.add(shift); controls.target.add(shift); controls.update();
  }
  function zoom(factor) {
    if (controls.noZoom || !Number.isFinite(factor)) return;
    const eye = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(eye.length() * factor, controls.minDistance, controls.maxDistance);
    eye.setLength(distance); camera.position.copy(controls.target).add(eye); controls.update();
  }
  function pairPose() {
    const values = [...pointers.values()].slice(0, 2);
    const [a, b] = values;
    return { x: (a.x + b.x) * .5, y: (a.y + b.y) * .5,
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function begin(event) {
    if (!controls.enabled || disposed || pointers.has(event.pointerId)) return;
    const action = event.shiftKey ? THREE.MOUSE.PAN : [controls.mouseButtons.LEFT, controls.mouseButtons.MIDDLE, controls.mouseButtons.RIGHT][event.button ?? 0];
    const capture = event.currentTarget?.setPointerCapture ? event.currentTarget : element;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
      action, type: event.pointerType, moved: false, capture });
    try { capture.setPointerCapture(event.pointerId); } catch {}
    if (pointers.size > 1) for (const point of pointers.values()) point.moved = true;
    telemetry(pointers.size > 1 ? 'touch-transform' : 'pressed');
  }
  function move(event) {
    const point = pointers.get(event.pointerId);
    if (!point || !controls.enabled) return;
    const oldPair = pointers.size > 1 ? pairPose() : null;
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    if (!point.moved && Math.hypot(event.clientX - point.startX, event.clientY - point.startY) < 4) return;
    point.moved = true; point.x = event.clientX; point.y = event.clientY;
    if (oldPair) {
      const next = pairPose(); pan(next.x - oldPair.x, next.y - oldPair.y); zoom(oldPair.distance / next.distance);
      if (!controls.noRotate) {
        const axis = camera.position.clone().sub(controls.target).normalize();
        const angle = Math.atan2(Math.sin(next.angle - oldPair.angle), Math.cos(next.angle - oldPair.angle));
        camera.up.applyAxisAngle(axis, -angle).normalize(); controls.update();
      }
      telemetry('touch-transform');
    } else if (point.action === THREE.MOUSE.PAN) { pan(dx, dy); telemetry('pan'); }
    else if (point.action === THREE.MOUSE.DOLLY) { zoom(Math.exp(dy * .008 * controls.zoomSpeed)); telemetry('zoom'); }
    else { rotate(dx, dy); telemetry('rotate'); }
  }
  function end(event) {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    if (point.moved) lastDragEnded = host.performance.now();
    element.dataset.lastGestureMoved = String(point.moved);
    pointers.delete(event.pointerId);
    try { if (point.capture.hasPointerCapture(event.pointerId)) point.capture.releasePointerCapture(event.pointerId); } catch {}
    // No camera writes here. Remaining fingers begin from their current point.
    telemetry(pointers.size ? 'pressed' : 'retained');
  }
  function cancelAll() {
    for (const [id, point] of pointers) {
      try { if (point.capture.hasPointerCapture(id)) point.capture.releasePointerCapture(id); } catch {}
    }
    pointers.clear(); telemetry('retained');
  }
  on(element, 'pointerdown', begin);
  on(host, 'pointermove', move);
  on(host, 'pointerup', end);
  on(host, 'pointercancel', end);
  on(host, 'lostpointercapture', end);
  on(host, 'blur', cancelAll);
  on(element, 'contextmenu', event => event.preventDefault());
  on(element, 'wheel', event => {
    if (!controls.enabled || controls.noZoom) return;
    event.preventDefault(); const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
    zoom(Math.exp(THREE.MathUtils.clamp(pixels * .0011 * controls.zoomSpeed, -.7, .7))); telemetry('zoom');
  }, { passive: false });
  return controls;
}
