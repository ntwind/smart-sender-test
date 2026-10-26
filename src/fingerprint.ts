import { useState } from 'react'

const STORAGE_KEY = 'fingerprint'
const FINGERPRINT_RE = /^[0-9a-f]{32}$/

let cached: string | undefined

function canvasSignal(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'top'
    ctx.font = '16px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(100, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('fingerprint ✓ 1.0', 2, 15)
    return canvas.toDataURL()
  } catch {
    return ''
  }
}

function webglSignal(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return ''
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (!info) return ''
    return `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}`
  } catch {
    return ''
  }
}


function collectSignals(): string {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return [
    nav.userAgent,
    nav.language,
    nav.languages?.join(','),
    nav.platform,
    nav.hardwareConcurrency,
    nav.deviceMemory,
    nav.maxTouchPoints,
    screen.width,
    screen.height,
    screen.colorDepth,
    window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasSignal(),
    webglSignal(),
  ].join('||')
}

function hash128(str: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('')
}

export function getFingerprint(): string {
  if (cached) return cached

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && FINGERPRINT_RE.test(stored)) return (cached = stored)
  } catch {
    // Storage blocked (e.g. private mode) — fall through and derive.
  }

  cached = hash128(collectSignals())
  try {
    localStorage.setItem(STORAGE_KEY, cached)
  } catch {
    // Can't persist; the derived value is still reproducible on this device.
  }
  return cached
}

export function useFingerprint(): string {
  const [fingerprint] = useState(getFingerprint)
  return fingerprint
}
