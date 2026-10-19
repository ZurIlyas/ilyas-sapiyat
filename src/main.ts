import './style.css'
import { initRings } from './rings'

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s))
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const progressOf = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight || 1)) }
const forced = new URLSearchParams(location.search)   // ?n=1 — ночь, ?r=0.8 — кольца, для проверки без прокрутки

// 1. природа: по прокрутке день плавно переходит в ночь, камера слегка наезжает на пару
const hero = $('[data-hero]'), night = $<HTMLVideoElement>('[data-night]'), frame = $('.frame')
// 2. кольца
const ringsEl = $('[data-rings]')
const rings = initRings($('.rings-pin'))
const lines = $$('[data-line]')

function onScroll() {
  const h = forced.has('n') ? Number(forced.get('n')) : progressOf(hero)
  night.style.opacity = String(clamp((h - 0.15) / 0.6))
  frame.style.setProperty('--zoom', String(1 + h * 0.08))
  const r = forced.has('r') ? Number(forced.get('r')) : progressOf(ringsEl)
  rings?.setProgress(r, forced.has('r'))
  lines.forEach((l, i) => l.classList.toggle('on', r > 0.22 + i * 0.14))
}
addEventListener('scroll', onScroll, { passive: true })
addEventListener('resize', onScroll)
onScroll()

// мобильные браузеры иногда не запускают второе видео сами
document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => v.play().catch(() => {}))

// 3. появление карточки и обратный отсчёт до 26.11.2026 14:00 (время Махачкалы, UTC+3)
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -12% 0px' })
$$('.rv').forEach((el) => io.observe(el))
const target = Date.UTC(2026, 10, 26, 11, 0)
function tick() {
  const ms = Math.max(0, target - Date.now())
  $('[data-d]').textContent = String(Math.floor(ms / 864e5))
  $('[data-h]').textContent = String(Math.floor(ms / 36e5) % 24)
  $('[data-m]').textContent = String(Math.floor(ms / 6e4) % 60)
}
tick()
setInterval(tick, 30000)
