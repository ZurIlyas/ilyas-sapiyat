// Второй экран: два золотых обручальных кольца. Крутятся сами, а по прокрутке сближаются
// и сцепляются. У кольца невесты — камень. Всё процедурное, без моделей.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type Rings = { setProgress(p: number, instant?: boolean): void }
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ease = (t: number) => t * t * (3 - 2 * t)

// кольцо: сечение «комфорт» — скруглённый прямоугольник, провёрнутый вокруг оси
function ringGeo(R: number, w: number, t: number) {
  const pts: THREE.Vector2[] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    // суперэллипс: плоский снаружи, скруглённый по краям
    const c = Math.cos(a), s = Math.sin(a)
    const x = Math.sign(c) * Math.pow(Math.abs(c), 0.55) * t / 2
    const y = Math.sign(s) * Math.pow(Math.abs(s), 0.7) * w / 2
    pts.push(new THREE.Vector2(R + x, y))
  }
  const g = new THREE.LatheGeometry(pts, 160)
  g.rotateX(Math.PI / 2)     // кольцо стоит «на ребре», отверстие смотрит на камеру
  g.computeVertexNormals()
  return g
}

export function initRings(root: HTMLElement): Rings | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  scene.environmentIntensity = 1.1
  pmrem.dispose()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0.2, 7.2)
  const warm = new THREE.PointLight(0xffd9a0, 30, 12, 2)
  warm.position.set(-2.5, 2.5, 3)
  scene.add(warm)
  const cool = new THREE.PointLight(0xb8c8ff, 18, 12, 2)
  cool.position.set(3, -1.5, 2.5)
  scene.add(cool)

  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf0c27b, metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.08 })
  const rose = new THREE.MeshPhysicalMaterial({ color: 0xf2c0a0, metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.08 })
  const gem = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 0.6, ior: 2.42, iridescence: 0.6, iridescenceIOR: 1.6, specularIntensity: 1, envMapIntensity: 2.2 })

  const pair = new THREE.Group()
  scene.add(pair)
  // кольцо жениха — шире и массивнее
  const groom = new THREE.Group()
  groom.add(new THREE.Mesh(ringGeo(1.0, 0.36, 0.17), gold))
  pair.add(groom)
  // кольцо невесты — тоньше, с камнем в крапанах
  const bride = new THREE.Group()
  bride.add(new THREE.Mesh(ringGeo(0.86, 0.22, 0.13), rose))
  const setting = new THREE.Group()
  setting.position.y = 0.94
  bride.add(setting)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.12, 6), rose)
  setting.add(crown)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.24, 8), rose)
    prong.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15)
    prong.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25)
    setting.add(prong)
  }
  // бриллиант: корона-конус сверху и павильон снизу, огранка — 16 граней
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.08, 16), gem)
  top.position.y = 0.2
  const pav = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 16), gem)
  pav.rotation.x = Math.PI
  pav.position.y = 0.06
  setting.add(top, pav)
  pair.add(bride)

  // искорки вокруг
  const N = 140
  const pos = new Float32Array(N * 3), seed: number[] = []
  for (let i = 0; i < N; i++) {
    const r = 1.6 + Math.random() * 2.2, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 3.4
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r - 0.5], i * 3)
    seed.push(Math.random() * 10)
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const sparkTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.25, 'rgba(255,220,160,.6)'); gr.addColorStop(1, 'rgba(255,220,160,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.09, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }))
  scene.add(sparks)

  let progress = 0, cur = 0, raf = 0, visible = false, t0 = performance.now()
  function resize() {
    const w = root.clientWidth, h = root.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  function frame(now: number) {
    raf = 0
    const t = (now - t0) / 1000
    cur += (progress - cur) * 0.07
    const link = ease(clamp((cur - 0.1) / 0.6))
    // кольца сближаются и сцепляются: кольцо невесты поворачивается поперёк и входит в кольцо жениха
    groom.position.set(-1.6 * (1 - link) - 0.42 * link, 0.05 * Math.sin(t * 0.9), 0)
    bride.position.set(1.6 * (1 - link) + 0.42 * link, 0.05 * Math.sin(t * 0.9 + 1.4), 0)
    groom.rotation.set(0.25 + Math.sin(t * 0.5) * 0.08, t * 0.45 + cur * 2.2, 0.08)
    bride.rotation.set(-0.15 + Math.sin(t * 0.6) * 0.08, -t * 0.4 + link * Math.PI / 2 + cur * 1.4, -0.12)
    pair.rotation.y = Math.sin(t * 0.2) * 0.15 + (cur - 0.5) * 0.6
    pair.position.y = 0.55 + Math.sin(t * 0.7) * 0.06   // выше центра: снизу текст
    // камера отходит так, чтобы оба кольца помещались по ширине: врозь шире, сцепленные уже
    const a = camera.aspect, half = 0.268 * a
    camera.position.z = Math.max(7.2, (3.0 * (1 - link) + 1.9 * link) / half)
    const arr = sg.attributes.position.array as Float32Array
    for (let i = 0; i < N; i++) arr[i * 3 + 1] += Math.sin(t * 0.6 + seed[i]) * 0.0012
    sg.attributes.position.needsUpdate = true
    ;(sparks.material as THREE.PointsMaterial).size = 0.07 + Math.sin(t * 2) * 0.015
    sparks.rotation.y = t * 0.04
    renderer.render(scene, camera)
    if (visible) raf = requestAnimationFrame(frame)
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame) }).observe(root)
  new ResizeObserver(resize).observe(root)
  resize()
  return { setProgress(p, instant) { progress = clamp(p); if (instant) cur = progress } }
}
