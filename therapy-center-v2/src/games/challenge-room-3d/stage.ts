/**
 * The 3D world of challenge-room-3d - a cozy toy room, a chunky console with four push
 * buttons (2x2) and a round robot friend. No React here: the component drives it with
 * setButtons / press / feedback / robot and reads screen positions back (project / pick).
 *
 * Phones first: models are small GLBs made in Blender (blender/make_models.py in the
 * workshop), no shadow maps (soft blob shadows), pixel ratio capped at 1.5, no antialias
 * on touch screens, shaders compiled before the game shows, and while a menu covers the
 * world it is drawn only when something changes.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface BtnView {
  /** css colour of the light, or null = off */
  color: string | null;
  lit: boolean;
  /** a calm "home" mark (engine mode 'base') */
  base: boolean;
}
export type RobotAct = 'cheer' | 'hmm' | 'wave' | 'party';
export type Face = 'idle' | 'happy' | 'hmm';

const CREAM = new THREE.Color('#fff8ec');
const BR = 0.47; // button radius (as in the Blender script)

interface Btn {
  root: THREE.Object3D;
  mesh: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
  ringMat: THREE.MeshStandardMaterial;
  glow: THREE.Mesh;
  halo: THREE.Sprite;
  home: THREE.Vector3;
  lit: number;
  base: number;
  color: THREE.Color;
  view: BtnView;
  pressAt: number;
  fx: { kind: 'yes' | 'no'; at: number } | null;
}

function radial(size: number, stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a soft painted wood grain for the table top (no image to download) */
function woodTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e6be93';
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // planks
  const planks = 6;
  for (let p = 0; p < planks; p++) {
    const y0 = (p * S) / planks;
    g.fillStyle = `rgba(${p % 2 ? '170,110,60' : '255,236,205'},${0.08 + rnd() * 0.06})`;
    g.fillRect(0, y0, S, S / planks);
    for (let k = 0; k < 14; k++) {
      const y = y0 + rnd() * (S / planks);
      g.strokeStyle = `rgba(150,95,50,${0.05 + rnd() * 0.08})`;
      g.lineWidth = 1 + rnd() * 2.5;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x / 70 + k) * 3 * rnd());
      g.stroke();
    }
    g.fillStyle = 'rgba(140,85,40,0.22)';
    g.fillRect(0, y0, S, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const bump = (p: number) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p));

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 0.5, 0.1, 80);
  private lastTs = 0;
  private raf = 0;
  private w = 1;
  private h = 1;
  private mode: 'menu' | 'play' = 'menu';
  private dirty = 3;
  private disposed = false;
  private btns: Btn[] = [];
  private topY = 0.56;
  private robot: THREE.Object3D | null = null;
  private rParts: { head?: THREE.Object3D; armL?: THREE.Object3D; armR?: THREE.Object3D; body?: THREE.Object3D; chest?: THREE.MeshStandardMaterial; visor?: THREE.Mesh } = {};
  private robotHome = new THREE.Vector3(0.95, 0, -1.95);
  private act: { kind: RobotAct; at: number } | null = null;
  private tmpC = new THREE.Color();
  /** the calm life of the room: bunting that sways, dust in the window light, the robot's idle glances */
  private flags: THREE.Object3D[] = [];
  private motes: THREE.Points | null = null;
  private moteBase: Float32Array | null = null;
  private idleAt = 6;
  private idleKind: 'look' | 'antenna' = 'look';
  private antenna: THREE.Object3D | null = null;
  face: Face = 'idle';
  private faceCanvas = document.createElement('canvas');
  private faceTex: THREE.CanvasTexture;
  private faceKey = '';
  private blinkAt = 2;
  private lookYaw = 0;
  private lookPitch = 0;
  private t = 0;
  /** projected positions cache (css px, relative to the canvas) */
  private proj: { x: number; y: number; rx: number; ry: number }[] = [];
  onFrame?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: false, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = new THREE.Color('#8fb2ec');
    this.faceCanvas.width = 256;
    this.faceCanvas.height = 160;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.flipY = false;
  }

  /** load the three models, build the scene, compile every shader; resolves when it can be shown */
  async load(urls: { console: string; robot: string; room: string }, sizes: Record<string, number>, onProgress?: (p: number) => void) {
    const loader = new GLTFLoader();
    const got: Record<string, number> = {};
    const total = Object.values(sizes).reduce((a, b) => a + b, 0) || 1;
    const report = () => onProgress?.(Math.min(0.95, Object.values(got).reduce((a, b) => a + b, 0) / total));
    const one = (k: 'console' | 'robot' | 'room') => new Promise<THREE.Group>((res, rej) => {
      loader.load(urls[k], (g) => { got[k] = sizes[k] || 0; report(); res(g.scene); }, (e) => { got[k] = Math.min(sizes[k] || 0, e.loaded || 0); report(); }, rej);
    });
    const [con, rob, room] = await Promise.all([one('console'), one('robot'), one('room')]);
    if (this.disposed) return;
    this.build(con, rob, room);
    this.frame();
    // build every shader and upload every texture now, while the loading card is still up
    const gl = this.renderer.getContext();
    if (gl.getExtension('KHR_parallel_shader_compile')) {
      try { await this.renderer.compileAsync(this.scene, this.camera); } catch { this.renderer.compile(this.scene, this.camera); }
    } else this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    onProgress?.(1);
    this.start();
  }

  private build(con: THREE.Group, rob: THREE.Group, room: THREE.Group) {
    const s = this.scene;
    // light: a soft sky/ground fill, a warm key from the window side, a cool rim, reflections from a studio room
    s.add(new THREE.HemisphereLight('#e4eeff', '#d9b48e', 1.05));
    const key = new THREE.DirectionalLight('#fff0dc', 2.3);
    key.position.set(-3, 7, 5);
    s.add(key);
    const rim = new THREE.DirectionalLight('#cfe0ff', 0.6);
    rim.position.set(4, 4, -4);
    s.add(rim);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environment = env;
    s.environmentIntensity = 0.55;
    pmrem.dispose();
    s.fog = new THREE.Fog('#a9c3f0', 12, 24);

    room.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'envMapIntensity' in m) m.envMapIntensity = 0.35;
    });
    s.add(room);
    const tableTop = con.getObjectByName('table_top') as THREE.Mesh | undefined;
    if (tableTop) {
      const m = (tableTop.material as THREE.MeshStandardMaterial).clone();
      m.map = woodTexture();
      m.color.set('#ffffff');
      m.roughness = 0.5;
      m.envMapIntensity = 0.5;
      tableTop.material = m;
    }
    s.add(con);
    s.add(rob);

    // soft blob shadows (no shadow maps on phones)
    const blob = radial(128, [[0, 'rgba(0,0,0,0.55)'], [0.55, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
    const shadow = (w: number, d: number, y: number, x = 0, z = 0, o = 1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: o, fog: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.renderOrder = 1;
      s.add(m);
      return m;
    };
    shadow(3.6, 3.3, 0.004, 0, 0.05, 0.75);
    shadow(7.4, 6.6, -2.53, 0, 0.6, 0.5);
    const robotShadow = shadow(1.1, 0.8, 0.006, this.robotHome.x, this.robotHome.z + 0.02, 0.6);
    robotShadow.name = 'robot-shadow';

    // the buttons
    const glowTex = radial(128, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    const haloTex = radial(128, [[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    // where a button sits in its socket the plate darkens softly (fake ambient occlusion)
    const aoTex = radial(128, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [0.7, 'rgba(20,30,70,0.3)'], [0.82, 'rgba(20,30,70,0.08)'], [1, 'rgba(20,30,70,0)']]);
    for (let i = 0; i < 4; i++) {
      const mesh = con.getObjectByName(`btn${i}`) as THREE.Mesh;
      const ring = con.getObjectByName(`ring${i}`) as THREE.Mesh;
      if (!mesh) continue;
      const mat = new THREE.MeshPhysicalMaterial({ color: CREAM.clone(), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, envMapIntensity: 1.0 });
      mesh.material = mat;
      const ringMat = ((ring?.material as THREE.MeshStandardMaterial) || new THREE.MeshStandardMaterial()).clone();
      if (ring) ring.material = ringMat;
      const wp = new THREE.Vector3();
      mesh.getWorldPosition(wp);
      this.topY = wp.y + 0.03;
      const ao = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.62, 40), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, fog: false }));
      ao.rotation.x = -Math.PI / 2;
      ao.position.set(wp.x, this.topY + 0.004, wp.z);
      ao.renderOrder = 1;
      s.add(ao);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.75, 40), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(wp.x, this.topY + 0.012, wp.z);
      glow.renderOrder = 2;
      s.add(glow);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false }));
      halo.scale.set(BR * 3.2, BR * 3.2, 1);
      halo.position.set(wp.x, this.topY + 0.22, wp.z);
      halo.renderOrder = 3;
      s.add(halo);
      this.btns.push({ root: mesh, mesh, mat, ringMat, glow, halo, home: mesh.position.clone(), lit: 0, base: 0, color: new THREE.Color('#ffffff'), view: { color: null, lit: false, base: false }, pressAt: -9, fx: null });
    }

    // the robot
    this.robot = rob;
    rob.position.copy(this.robotHome);
    rob.scale.setScalar(1.12);
    this.rParts.head = rob.getObjectByName('r_head') || undefined;
    this.rParts.armL = rob.getObjectByName('r_arm_l') || undefined;
    this.rParts.armR = rob.getObjectByName('r_arm_r') || undefined;
    this.rParts.body = rob.getObjectByName('r_body') || undefined;
    const visor = rob.getObjectByName('r_visor') as THREE.Mesh | undefined;
    if (visor) {
      visor.material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: this.faceTex, emissive: '#ffffff', emissiveMap: this.faceTex, emissiveIntensity: 0.9, roughness: 0.18, metalness: 0, envMapIntensity: 1.2 });
      this.rParts.visor = visor;
    }
    const chest = rob.getObjectByName('r_chest') as THREE.Mesh | undefined;
    if (chest) this.rParts.chest = chest.material as THREE.MeshStandardMaterial;
    this.antenna = rob.getObjectByName('r_antenna_ball') || null;

    for (let k = 0; k < 12; k++) { const f = room.getObjectByName(`flag${k}`); if (f) this.flags.push(f); }
    // the lamp glows warm
    const shade = room.getObjectByName('lamp_shade');
    if (shade) {
      const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(64, [[0, 'rgba(255,226,160,0.8)'], [0.4, 'rgba(255,214,140,0.25)'], [1, 'rgba(255,214,140,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
      const wp = shade.getWorldPosition(new THREE.Vector3());
      lampGlow.position.copy(wp);
      lampGlow.scale.set(2.2, 2.2, 1);
      s.add(lampGlow);
    }
    // a few soft dust motes drifting in the window light
    const N = 26;
    const pos = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      pos[k * 3] = -2.2 + Math.random() * 3.2;
      pos[k * 3 + 1] = -0.4 + Math.random() * 3.0;
      pos[k * 3 + 2] = -4.6 + Math.random() * 1.4;
    }
    this.moteBase = pos.slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: radial(32, [[0, 'rgba(255,255,240,1)'], [1, 'rgba(255,255,240,0)']]), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false, toneMapped: false }));
    s.add(this.motes);
    this.drawFace('idle', 0, 0, false);
  }

  // ---------------------------------------------------------------- face on the visor
  private drawFace(face: Face, lx: number, ly: number, blink: boolean) {
    const key = `${face}|${Math.round(lx * 6)}|${Math.round(ly * 6)}|${blink}`;
    if (key === this.faceKey) return;
    this.faceKey = key;
    const c = this.faceCanvas;
    const g = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    g.fillStyle = '#141a33';
    g.fillRect(0, 0, W, H);
    const shine = g.createLinearGradient(0, 0, 0, H);
    shine.addColorStop(0, 'rgba(120,150,255,0.18)');
    shine.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.fillStyle = shine;
    g.fillRect(0, 0, W, H);
    const cx = W / 2 + lx * 18;
    const cy = H * 0.46 + ly * 10;
    const dx = 52;
    g.strokeStyle = '#7fe3ff';
    g.fillStyle = '#7fe3ff';
    g.lineCap = 'round';
    g.shadowColor = '#5fd0ff';
    g.shadowBlur = 14;
    if (face === 'happy') {
      g.lineWidth = 13;
      [-1, 1].forEach((s) => { g.beginPath(); g.arc(cx + s * dx, cy + 10, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); });
      g.fillStyle = '#ff7a8a';
      g.shadowColor = '#ff7a8a';
      g.beginPath(); g.arc(cx, cy + 34, 20, 0, Math.PI); g.closePath(); g.fill();
    } else if (face === 'hmm') {
      g.lineWidth = 12;
      g.beginPath(); g.ellipse(cx - dx, cy, 15, 19, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx + dx - 20, cy + 2); g.lineTo(cx + dx + 20, cy - 4); g.stroke();
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(cx - 14, cy + 40); g.quadraticCurveTo(cx + 2, cy + 33, cx + 18, cy + 40); g.stroke();
    } else if (blink) {
      g.lineWidth = 12;
      [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(cx + s * dx - 17, cy + 2); g.lineTo(cx + s * dx + 17, cy + 2); g.stroke(); });
      g.lineWidth = 9;
      g.beginPath(); g.arc(cx, cy + 28, 15, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    } else {
      [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(cx + s * dx, cy, 17, 22, 0, 0, Math.PI * 2); g.fill(); });
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      [-1, 1].forEach((s) => { g.beginPath(); g.arc(cx + s * dx + 5, cy - 8, 5, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = '#7fe3ff';
      g.shadowBlur = 14;
      g.lineWidth = 9;
      g.beginPath(); g.arc(cx, cy + 28, 15, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }
    g.shadowBlur = 0;
    this.faceTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- public API
  setSize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.frame();
    this.dirty = 3;
  }

  setMode(m: 'menu' | 'play') {
    if (this.mode === m) return;
    this.mode = m;
    this.dirty = 3;
    this.lastTs = 0;
  }

  setButtons(views: BtnView[]) {
    views.forEach((v, i) => {
      const b = this.btns[i];
      if (!b) return;
      if (v.color && (v.lit || v.base)) b.color.set(v.color);
      b.view = v;
    });
    this.dirty = Math.max(this.dirty, 2);
  }

  /** the physical press: the button goes down and springs back */
  press(i: number) {
    const b = this.btns[i];
    if (b) b.pressAt = this.t;
    this.dirty = Math.max(this.dirty, 30);
  }

  /** right = bounce, wrong = shake (the colour comes from setButtons) */
  feedback(ids: number[], kind: 'yes' | 'no') {
    ids.forEach((i) => { const b = this.btns[i]; if (b) b.fx = { kind, at: this.t }; });
  }

  robotDo(kind: RobotAct) {
    if (this.act && this.act.kind === 'party' && this.t - this.act.at < 2.2 && kind !== 'party') return;
    this.act = { kind, at: this.t };
  }

  /** screen position (css px in the canvas) and radii of button i's top */
  project(i: number) {
    return this.proj[i] || null;
  }

  /** the button under a point (css px in the canvas), generous: 1.25x its own size */
  pick(x: number, y: number): number {
    let best = -1;
    let bd = 1.25;
    this.proj.forEach((p, i) => {
      const d = Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** where a world point lands on screen (css px) */
  toScreen(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  /** console corners near each button, for the small key numbers */
  numberSpots() {
    const y = this.topY - 0.01;
    return [[-1.13, -1.03], [1.13, -1.03], [-1.13, 1.0], [1.13, 1.0]].map(([x, z]) => this.toScreen(x, y, z));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x) => { Object.values(x).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); }); x.dispose(); });
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }

  // ---------------------------------------------------------------- camera
  private frame() {
    const aspect = this.w / this.h;
    const cam = this.camera;
    cam.fov = 30;
    cam.aspect = aspect;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // the console (2.7 wide) fills ~94% of the width on a phone; on wider screens the height decides
    const dW = 3.0 / (2 * tanH * aspect);
    const dH = 5.3 / (2 * tanH);
    const d = Math.max(dW, Math.min(dH, dW * 1.6));
    const elev = THREE.MathUtils.degToRad(41);
    const target = new THREE.Vector3(0, 0.45, -0.3);
    cam.position.set(target.x, target.y + d * Math.sin(elev), target.z + d * Math.cos(elev));
    cam.lookAt(target);
    // push the picture down so the console sits in the lower part and the robot above it
    cam.setViewOffset(this.w, this.h, 0, -this.h * 0.14, this.w, this.h);
    cam.updateProjectionMatrix();
    this.updateProj();
  }

  private updateProj() {
    this.camera.updateMatrixWorld();
    this.proj = this.btns.map((b) => {
      const wp = new THREE.Vector3();
      b.mesh.getWorldPosition(wp);
      const c = this.toScreen(wp.x, this.topY + 0.15, wp.z);
      const r1 = this.toScreen(wp.x + BR, this.topY + 0.05, wp.z);
      const r2 = this.toScreen(wp.x, this.topY + 0.05, wp.z + BR);
      const r3 = this.toScreen(wp.x, this.topY + 0.05, wp.z - BR);
      return { x: c.x, y: c.y, rx: Math.abs(r1.x - c.x), ry: Math.abs(r2.y - r3.y) / 2 + 6 };
    });
  }

  // ---------------------------------------------------------------- loop
  private start() {
    const loop = (ts: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastTs ? Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000)) : 0;
      this.lastTs = ts;
      this.t += dt;
      const animating = this.update(dt);
      if (this.mode === 'play' || this.dirty > 0 || animating) {
        this.renderer.render(this.scene, this.camera);
        if (this.dirty > 0) this.dirty--;
        this.onFrame?.();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** returns true while something is still moving (menus draw only then) */
  private update(dt: number): boolean {
    const t = this.t;
    let moving = false;
    let lookAt: THREE.Vector3 | null = null;
    for (const b of this.btns) {
      const on = b.view.lit ? 1 : 0;
      const rate = on > b.lit ? dt / 0.05 : dt / 0.14;
      b.lit = on > b.lit ? Math.min(on, b.lit + rate) : Math.max(on, b.lit - rate);
      const baseOn = b.view.base && !b.view.lit ? 1 : 0;
      b.base += (baseOn - b.base) * Math.min(1, dt * 10);
      const k = b.lit;
      // right / wrong: the light burns brighter for a moment and its glow on the plate breathes out
      let fxP = -1;
      if (b.fx) {
        fxP = (t - b.fx.at) / (b.fx.kind === 'yes' ? 0.65 : 0.6);
        if (fxP >= 1) { b.fx = null; fxP = -1; }
      }
      const boost = fxP >= 0 ? 1 - fxP * 0.5 : 0;
      this.tmpC.copy(b.color).multiplyScalar(0.82);
      b.mat.color.copy(CREAM).lerp(this.tmpC, k);
      b.mat.emissive.copy(b.color).multiplyScalar((0.5 + 0.35 * boost) * k + 0.12 * b.base);
      b.ringMat.emissive.copy(b.color).multiplyScalar((0.45 + 0.4 * boost) * k + 0.35 * b.base);
      const gm = b.glow.material as THREE.MeshBasicMaterial;
      gm.color.copy(b.color);
      gm.opacity = Math.min(1, (0.8 + 0.2 * boost) * k + 0.2 * b.base);
      const gs = 1 + 0.22 * (fxP >= 0 ? bump(Math.min(1, fxP * 1.4)) : 0);
      b.glow.scale.set(gs, gs, 1);
      const hm = b.halo.material as THREE.SpriteMaterial;
      hm.color.copy(b.color);
      hm.opacity = (0.42 + 0.33 * boost) * k;
      if (k > 0.5) lookAt = b.mesh.getWorldPosition(new THREE.Vector3());
      // press: down fast, hold, spring back with a little overshoot
      const pt = t - b.pressAt;
      let y = 0;
      if (pt < 0.05) y = -0.08 * (pt / 0.05);
      else if (pt < 0.13) y = -0.08;
      else if (pt < 0.42) { const p = (pt - 0.13) / 0.29; y = -0.08 * (1 - ease(p)) + 0.015 * bump(p); }
      let x = 0;
      let sc = 1;
      if (b.fx && fxP >= 0) {
        if (b.fx.kind === 'yes') {
          // a springy bounce: up, a little squash on landing, settle
          y += 0.12 * bump(Math.min(1, fxP * 1.6));
          sc = 1 + 0.1 * bump(Math.min(1, fxP * 1.3)) - 0.04 * bump(Math.max(0, fxP * 2.2 - 1.2));
        } else x = 0.075 * Math.sin(fxP * Math.PI * 7) * (1 - fxP);
      }
      b.mesh.position.set(b.home.x + x, b.home.y + y, b.home.z);
      b.mesh.scale.set(sc, 1 + (sc - 1) * 1.4, sc);
      b.glow.position.x = b.home.x + x;
      b.halo.position.x = b.home.x + x;
      b.halo.position.y = this.topY + 0.22 + y;
      if (pt < 0.45 || b.fx || Math.abs(on - k) > 0.001) moving = true;
    }

    // the room breathes: bunting sways, dust drifts (calm, slow - nothing a child has to follow)
    this.flags.forEach((f, k) => { f.rotation.z = Math.sin(t * 0.9 + k * 0.8) * 0.07; });
    if (this.motes && this.moteBase) {
      const a = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = this.moteBase;
      for (let k = 0; k < a.count; k++) {
        const ph = k * 1.7;
        a.setXYZ(k, base[k * 3] + Math.sin(t * 0.12 + ph) * 0.35, base[k * 3 + 1] + ((t * 0.05 + k * 0.11) % 1) * 0.6 - 0.3 + Math.sin(t * 0.3 + ph) * 0.05, base[k * 3 + 2]);
      }
      a.needsUpdate = true;
    }

    // the robot: breathing, blinking, looking at the light, cheering or thinking
    const r = this.robot;
    if (r) {
      const { head, armL, armR, body, chest } = this.rParts;
      let hop = 0;
      let armUp = 0;
      let wave = 0;
      let tilt = 0;
      let lean = 0;
      let face: Face = 'idle';
      if (this.act) {
        const at = t - this.act.at;
        const dur = { cheer: 1.0, hmm: 1.4, wave: 1.6, party: 2.4 }[this.act.kind];
        const p = at / dur;
        if (p >= 1) this.act = null;
        else {
          moving = true;
          const env = Math.min(1, at / 0.15) * Math.min(1, (dur - at) / 0.3);
          if (this.act.kind === 'cheer') {
            hop = 0.22 * bump(Math.min(1, at / 0.45));
            armUp = env;
            wave = 0.25 * Math.sin(at * 18) * env;
            face = 'happy';
          } else if (this.act.kind === 'party') {
            hop = 0.24 * Math.abs(Math.sin(at * Math.PI / 0.5)) * env;
            armUp = env;
            wave = 0.35 * Math.sin(at * 12) * env;
            face = 'happy';
          } else if (this.act.kind === 'wave') {
            armUp = 0;
            wave = env;
            face = 'happy';
          } else {
            tilt = 0.3 * env;
            lean = 0.06 * env;
            face = 'hmm';
          }
        }
      }
      const bob = Math.sin(t * 2.2) * 0.015;
      r.position.set(this.robotHome.x, this.robotHome.y + hop + Math.max(0, bob), this.robotHome.z);
      // face the camera, turned a little toward the console
      r.rotation.y = -0.38 + lean;
      r.rotation.z = -lean;
      if (body) body.scale.set(1, 1 - 0.04 * bump(Math.min(1, hop * 5)), 1);
      // look at the lit button (or, waiting calmly, glance around now and then)
      let yaw = 0;
      let pitch = 0.05;
      let antWiggle = 0;
      if (!lookAt && !this.act) {
        const it = t - this.idleAt;
        if (it > 0 && it < 2.2) {
          const env = bump(it / 2.2);
          if (this.idleKind === 'look') { yaw = Math.sin(it * 2.2) * 0.45 * env; pitch = 0.05 - 0.12 * env; }
          else antWiggle = Math.sin(it * 16) * 0.3 * env;
          moving = true;
        } else if (it >= 2.2) {
          this.idleAt = t + 5 + Math.random() * 5;
          this.idleKind = Math.random() < 0.6 ? 'look' : 'antenna';
        }
      } else if (lookAt) this.idleAt = Math.max(this.idleAt, t + 4);
      if (lookAt) {
        const rp = new THREE.Vector3(this.robotHome.x, 1.3, this.robotHome.z);
        const dir = lookAt.clone().sub(rp);
        yaw = Math.atan2(dir.x, dir.z) - r.rotation.y;
        yaw = Math.max(-0.7, Math.min(0.7, yaw));
        pitch = 0.32;
      }
      this.lookYaw += (yaw - this.lookYaw) * Math.min(1, dt * 8);
      this.lookPitch += (pitch - this.lookPitch) * Math.min(1, dt * 8);
      if (head) head.rotation.set(this.lookPitch, this.lookYaw, tilt + Math.sin(t * 1.3) * 0.03 + antWiggle * 0.15);
      if (this.antenna) this.antenna.position.x = antWiggle * 0.06 + (this.act ? Math.sin(t * 20) * 0.015 : 0);
      if (armL && armR) {
        const rest = 0.12 + Math.sin(t * 2.2) * 0.04;
        const up = 2.5;
        armL.rotation.z = -(rest + armUp * up) - wave * 0.4 * (armUp > 0 ? 1 : 0);
        armR.rotation.z = rest + armUp * up + (armUp > 0 ? wave * 0.4 : wave * 2.3 + Math.sin(t * 14) * 0.35 * wave);
      }
      if (chest) chest.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5 + (face === 'happy' ? 1.2 : 0);
      // blink now and then
      let blink = false;
      if (t > this.blinkAt) { blink = true; if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.5 + Math.random() * 3; }
      this.face = face;
      const lx = lookAt ? Math.max(-1, Math.min(1, (this.lookYaw) * 1.6)) : 0;
      this.drawFace(face, lx, lookAt ? 0.6 : 0, blink && face === 'idle');
    }
    return moving;
  }
}
