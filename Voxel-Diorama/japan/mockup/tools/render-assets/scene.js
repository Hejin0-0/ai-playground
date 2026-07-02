'use strict';
// Browser-side (injected into headless Chrome after three.min.js).
// window.renderVoxelAsset(payload) builds one voxel scene, renders it with the
// shared camera + lighting rig, crops to the sprite's alpha bounds, and
// returns { dataUrl, w, h, ax, ay }.
//
// payload: {
//   voxels: [[x, y, z, 0xrrggbb], ...]   // y = "into screen", z = up (grid space)
//   shadow: bool,                         // add ground shadow-catcher plane
//   ppu: number,                          // pixels per world unit
//   elevDeg, azimDeg: camera angles
//   pad: transparent border px
// }

/* global THREE */

window.renderVoxelAsset = function renderVoxelAsset(p) {
  const scene = new THREE.Scene();

  // grid (x, y, z-up) -> world (x, z-up->y, y->z)
  const toWorld = (vx, vy, vz) => new THREE.Vector3(vx + 0.5, vz + 0.5, vy + 0.5);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, p.voxels.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const bounds = new THREE.Box3();
  p.voxels.forEach(([vx, vy, vz, rgb], i) => {
    const c = toWorld(vx, vy, vz);
    m.makeTranslation(c.x, c.y, c.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(rgb).convertSRGBToLinear());
    bounds.expandByPoint(new THREE.Vector3(c.x - 0.5, c.y - 0.5, c.z - 0.5));
    bounds.expandByPoint(new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z);

  if (p.shadow) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 8 + 40, radius * 8 + 40),
      new THREE.ShadowMaterial({ opacity: 0.24 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(center.x, 0, center.z);
    plane.receiveShadow = true;
    scene.add(plane);
  }

  // warm lighting rig: hemisphere ambient + shadow-casting key + cool low fill
  scene.add(new THREE.HemisphereLight(0xfff2dd, 0xb8a894, 0.85));
  const key = new THREE.DirectionalLight(0xffe9c4, 1.15);
  key.position.set(center.x - radius * 0.9, bounds.max.y + radius * 3.2, center.z + radius * 0.3);
  key.target.position.copy(center);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -radius * 3; sc.right = radius * 3;
  sc.top = radius * 3; sc.bottom = -radius * 3;
  sc.near = 0.5; sc.far = radius * 10 + 50;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.3);
  fill.position.set(center.x + radius * 1.5, center.y + radius * 0.8, center.z - radius);
  fill.target.position.copy(center);
  scene.add(fill, fill.target);

  // isometric orthographic camera
  const elev = (p.elevDeg * Math.PI) / 180;
  const azim = (p.azimDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.cos(elev) * Math.cos(azim), Math.sin(elev), Math.cos(elev) * Math.sin(azim));
  const dist = radius * 6 + 40;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, dist * 3);
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);

  // fit frustum: project AABB corners (+ ground shadow footprint) into camera
  // space, then size the canvas at exactly p.ppu pixels per world unit
  const pts = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [p.shadow ? 0 : bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const inv = camera.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of pts) {
    const c = pt.clone().applyMatrix4(inv);
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  const shadowMargin = p.shadow ? size.y * 0.9 + 1 : 0.25; // room for the cast shadow
  minX -= shadowMargin; maxX += shadowMargin; minY -= 0.25; maxY += 0.25;

  const w = Math.ceil((maxX - minX) * p.ppu);
  const h = Math.ceil((maxY - minY) * p.ppu);
  camera.left = minX; camera.right = minX + w / p.ppu;
  camera.top = maxY; camera.bottom = maxY - h / p.ppu;
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.render(scene, camera);

  // anchor: grid-space voxel (0,0,0) top-diamond center = world (0.5, 1, 0.5)
  const anchorCam = new THREE.Vector3(0.5, 1, 0.5).applyMatrix4(inv);
  let ax = (anchorCam.x - camera.left) * p.ppu;
  let ay = (camera.top - anchorCam.y) * p.ppu;

  // crop to alpha bounds (+pad), adjusting the anchor
  const full = document.createElement('canvas');
  full.width = w; full.height = h;
  const fctx = full.getContext('2d');
  fctx.drawImage(renderer.domElement, 0, 0);
  const data = fctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error('rendered sprite is fully transparent');
  const cw = x1 - x0 + 1 + p.pad * 2;
  const ch = y1 - y0 + 1 + p.pad * 2;
  const crop = document.createElement('canvas');
  crop.width = cw; crop.height = ch;
  crop.getContext('2d').drawImage(full, x0 - p.pad, y0 - p.pad, cw, ch, 0, 0, cw, ch);

  renderer.dispose();
  return {
    dataUrl: crop.toDataURL('image/png'),
    w: cw, h: ch,
    ax: Math.round((ax - x0 + p.pad) * 100) / 100,
    ay: Math.round((ay - y0 + p.pad) * 100) / 100,
  };
};
