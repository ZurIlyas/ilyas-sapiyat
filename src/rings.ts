// Второй экран: два обручальных кольца. Кольцо жениха — жёлтое золото с матовой серединой и мильгрейном
// по краям, кольцо невесты — розовое золото с огранённым бриллиантом и дорожкой мелких камней.
// Кольца медленно вращаются, по прокрутке прилетают из глубины, сближаются и сцепляются —
// в этот момент вспыхивает свет и разлетается золотая пыль. Свечение бликов — bloom.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export type Rings = { setProgress(p: number, instant?: boolean): void }
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

// профиль кольца: суперэллипс (плоский снаружи, скруглённый по краям), провёрнутый вокруг оси
function band(R: number, w: number, t: number, segs = 220) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a)
    pts.push(new THREE.Vector2(R + Math.sign(c) * Math.pow(Math.abs(c), 0.5) * t / 2, Math.sign(s) * Math.pow(Math.abs(s), 0.65) * w / 2))
  }
  const g = new THREE.LatheGeometry(pts, segs)
  g.rotateX(Math.PI / 2)          // отверстие смотрит на камеру
  return g
}
// бриллиант круглой огранки: площадка, корона, рундист, павильон до калетты
function brilliant(r: number) {
  const g = new THREE.LatheGeometry([
    new THREE.Vector2(0.0001, -0.86 * r), new THREE.Vector2(r, -0.02 * r), new THREE.Vector2(r, 0.04 * r),
    new THREE.Vector2(0.78 * r, 0.24 * r), new THREE.Vector2(0.55 * r, 0.34 * r), new THREE.Vector2(0.0001, 0.34 * r),
  ], 16)
  return g.toNonIndexed()   // плоские грани — блики по граням, как у огранки
}

export function initRings(root: HTMLElement): Rings | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  } catch {
    return null
  }
  const mobile = matchMedia('(max-width: 700px)').matches
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0f1c)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture
  scene.environmentIntensity = 0.95
  pmrem.dispose()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80)

  // свет: тёплый ключевой, холодный контровой и «прожектор», который проходит по кольцам бликом
  const keyL = new THREE.PointLight(0xffd7a0, 22, 14, 2); keyL.position.set(-3, 3, 4); scene.add(keyL)
  const rimL = new THREE.PointLight(0x9fb4ff, 18, 14, 2); rimL.position.set(3.5, -1, -2); scene.add(rimL)
  const sweep = new THREE.PointLight(0xfff2dd, 0, 9, 2); scene.add(sweep)

  // фон: мягкое золотое свечение за кольцами и звёзды
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    gr.addColorStop(0, 'rgba(255,214,150,.55)'); gr.addColorStop(0.35, 'rgba(214,160,90,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  })()
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }))
  halo.scale.set(9, 9, 1); halo.position.set(0, 0.4, -3)
  scene.add(halo)
  const starGeo = new THREE.BufferGeometry()
  const SN = 700, sp = new Float32Array(SN * 3)
  for (let i = 0; i < SN; i++) sp.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 36, -12 - Math.random() * 20], i * 3)
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false }))
  scene.add(stars)

  // материалы
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf3c477, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })
  const satin = new THREE.MeshPhysicalMaterial({ color: 0xe9b866, metalness: 1, roughness: 0.42 })   // матовая середина
  const rose = new THREE.MeshPhysicalMaterial({ color: 0xf4c3a3, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })
  const diamond = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 0.5, ior: 2.42, dispersion: 6, iridescence: 0.35, iridescenceIOR: 1.8, specularIntensity: 1, envMapIntensity: 3, flatShading: true })

  const pair = new THREE.Group()
  scene.add(pair)

  // ---------- кольцо жениха ----------
  const groom = new THREE.Group()
  pair.add(groom)
  const RG = 1.0, WG = 0.42
  groom.add(new THREE.Mesh(band(RG, WG, 0.19), yellow))
  groom.add(new THREE.Mesh(band(RG + 0.0035, WG * 0.5, 0.19), satin))   // матовый поясок посередине
  const grooveMat = new THREE.MeshStandardMaterial({ color: 0x5a3d14, metalness: 1, roughness: 0.4 })
  for (const s of [-1, 1]) {                                            // канавки по краям пояска
    const gr = new THREE.Mesh(new THREE.TorusGeometry(RG + 0.096, 0.007, 6, 200), grooveMat)
    gr.position.z = s * WG * 0.26
    groom.add(gr)
  }
  // мильгрейн — бусинки по обоим краям
  const BEADS = 150
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), yellow, BEADS * 2)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < BEADS; i++) for (const s of [0, 1]) {
    const a = (i / BEADS) * Math.PI * 2
    m4.makeTranslation(Math.cos(a) * (RG + 0.088), Math.sin(a) * (RG + 0.088), (s ? 1 : -1) * WG * 0.43)
    beads.setMatrixAt(i * 2 + s, m4)
  }
  groom.add(beads)

  // ---------- кольцо невесты ----------
  const bride = new THREE.Group()
  pair.add(bride)
  const RB = 0.86, WB = 0.24
  bride.add(new THREE.Mesh(band(RB, WB, 0.14), rose))
  const smallGeo = brilliant(0.045)                  // дорожка камней по верхней половине
  for (let i = -7; i <= 7; i++) {
    if (i === 0) continue
    const a = Math.PI / 2 + i * 0.13
    const st = new THREE.Mesh(smallGeo, diamond)
    st.position.set(Math.cos(a) * (RB + 0.07), Math.sin(a) * (RB + 0.07), 0)
    st.rotation.z = a - Math.PI / 2
    bride.add(st)
  }
  // главный камень в шести крапанах на высокой корзинке
  const head = new THREE.Group()
  head.position.y = RB + 0.07
  bride.add(head)
  const basket = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 40), rose)
  basket.rotation.x = Math.PI / 2; basket.position.y = 0.1
  head.add(basket)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.32, 8), rose)
    pr.position.set(Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15)
    pr.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22)
    head.add(pr)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), rose)
    tip.position.set(Math.cos(a) * 0.185, 0.355, Math.sin(a) * 0.185)
    head.add(tip)
  }
  const stone = new THREE.Mesh(brilliant(0.2), diamond)
  stone.position.y = 0.3
  head.add(stone)
  // искра на камне: четырёхлучевая звезда, вспыхивает время от времени
  const flareTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,240,220,.5)'); gr.addColorStop(1, 'rgba(255,240,220,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
    const ray = g.createLinearGradient(0, 0, 128, 0)
    ray.addColorStop(0, 'rgba(255,255,255,0)'); ray.addColorStop(0.5, 'rgba(255,255,255,.95)'); ray.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = ray; g.fillRect(0, 63, 128, 2)
    const rayV = g.createLinearGradient(0, 0, 0, 128)
    rayV.addColorStop(0, 'rgba(255,255,255,0)'); rayV.addColorStop(0.5, 'rgba(255,255,255,.95)'); rayV.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rayV; g.fillRect(63, 0, 2, 128)
    return new THREE.CanvasTexture(c)
  })()
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }))
  scene.add(flare)

  // ---------- золотая пыль ----------
  const DN = mobile ? 500 : 900
  const dust = new Float32Array(DN * 3), dseed = new Float32Array(DN * 4)
  for (let i = 0; i < DN; i++) dseed.set([Math.random() * Math.PI * 2, 1.4 + Math.random() * 2.6, (Math.random() - 0.5) * 4, 0.2 + Math.random() * 0.8], i * 4)
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3))
  const dustTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.3, 'rgba(255,200,120,.5)'); gr.addColorStop(1, 'rgba(255,200,120,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const dustMat = new THREE.PointsMaterial({ size: 0.07, map: dustTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })
  scene.add(new THREE.Points(dustGeo, dustMat))

  // ---------- постобработка: свечение бликов ----------
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.45, 0.94)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let progress = 0, cur = 0, raf = 0, visible = false, last = performance.now(), t = 0, pulse = 0, wasLinked = false
  function resize() {
    const w = root.clientWidth, h = root.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 0.04, 0.2)
  function frame(now: number) {
    raf = 0
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now; t += dt
    cur += (progress - cur) * 0.07
    const arrive = easeOut(clamp(cur / 0.25))           // прилетают из глубины
    const link = smooth(clamp((cur - 0.2) / 0.5))       // сближаются и сцепляются
    if (link > 0.97 && !wasLinked) pulse = 1
    wasLinked = link > 0.97
    pulse = Math.max(0, pulse - dt * 0.9)

    const spin = t * 0.5 * (1 - link * 0.6)
    groom.position.set(-1.7 * (1 - link) - 0.44 * link, 0.06 * Math.sin(t * 0.9), -6 * (1 - arrive))
    bride.position.set(1.7 * (1 - link) + 0.44 * link, 0.06 * Math.sin(t * 0.9 + 1.4), -6 * (1 - arrive) + 0.02)
    groom.rotation.set(0.28 + Math.sin(t * 0.5) * 0.08, spin + 0.4 + cur * 1.6, 0.06)
    bride.rotation.set(-0.12 + Math.sin(t * 0.6) * 0.08, -spin - 0.3 + link * (Math.PI / 2 + 0.3) + cur * 0.8, -0.1)
    pair.rotation.y = Math.sin(t * 0.18) * 0.2 + (cur - 0.5) * 0.5
    pair.position.y = 0.5 + Math.sin(t * 0.7) * 0.05

    // камера: оба кольца помещаются по ширине кадра, в конце чуть ближе
    const half = Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect
    const span = 3.0 * (1 - link) + 1.95 * link
    camera.position.set(Math.sin(t * 0.1) * 0.3, 0.4, Math.max(8.2, span / half) - cur * 0.4)
    camera.lookAt(0, 0.05, 0)   // кольца выше центра: снизу текст

    // блик-прожектор проходит слева направо
    const sw = (t * 0.22) % 1
    sweep.position.set(-4 + sw * 8, 1.5, 2.5)
    sweep.intensity = Math.sin(sw * Math.PI) * 12 + pulse * 22
    halo.material.opacity = 0.22 + link * 0.12 + pulse * 0.25
    bloom.strength = 0.28 + link * 0.1 + pulse * 0.35

    // искра на бриллианте
    stone.getWorldPosition(tmp)
    flare.position.copy(tmp).add(up)
    const tw = Math.min(1, Math.pow(Math.max(0, Math.sin(t * 1.3)), 24) + Math.pow(Math.max(0, Math.sin(t * 0.7 + 2)), 30) + pulse)
    flare.material.opacity = tw * arrive
    flare.material.rotation = t * 0.3
    flare.scale.setScalar(0.35 + tw * 0.5)

    // золотая пыль кружит вокруг, при сцепке разлетается волной
    for (let i = 0; i < DN; i++) {
      const a0 = dseed[i * 4], r0 = dseed[i * 4 + 1], y0 = dseed[i * 4 + 2], sp2 = dseed[i * 4 + 3]
      const a = a0 + t * 0.15 * sp2
      const r = r0 + pulse * pulse * 3 * sp2
      dust[i * 3] = Math.cos(a) * r
      dust[i * 3 + 1] = y0 * 0.7 + 0.5 + Math.sin(t * 0.5 + a0 * 3) * 0.12
      dust[i * 3 + 2] = Math.sin(a) * r - 0.5
    }
    dustGeo.attributes.position.needsUpdate = true
    dustMat.opacity = (0.35 + link * 0.25 + pulse * 0.3) * arrive
    stars.rotation.z = t * 0.004

    composer.render()
    if (visible) raf = requestAnimationFrame(frame)
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame) } }).observe(root)
  new ResizeObserver(resize).observe(root)
  resize()
  return { setProgress(p, instant) { progress = clamp(p); if (instant) cur = progress } }
}
