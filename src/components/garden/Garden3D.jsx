import { memo, useRef, useMemo, useEffect, useState, Suspense, Component } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Float, Html, Sparkles, ContactShadows,
  AdaptiveDpr, PerformanceMonitor, MeshDistortMaterial, useGLTF,
} from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, HueSaturation } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useGarden } from '@/context/GardenContext'
import { groupGardenGoals, STAGE_NAMES } from '@/lib/gardenModel'

// ─── Drag-to-peek camera state (no React state in the canvas) ─────────────────
let dragAzimuth = 0
let dragVelocity = 0
let isCanvasDragging = false
const Y_UP = new THREE.Vector3(0, 1, 0)

// ─── Soft shading ramp — Hay Day style ────────────────────────────────────────
// Smooth, warm gradient (not hard cel bands). Shadows are warm + lifted so the
// scene reads bright and sunny; a gentle plateau keeps a touch of stylisation.
let _toonGrad = null
function getToonGrad() {
  if (_toonGrad) return _toonGrad
  const W = 96
  const data = new Uint8Array(W * 4)
  // Warm shadow → warm highlight control stops (t, r, g, b)
  const stops = [
    [0.00,  86,  91,  82],
    [0.30, 116, 122, 106],
    [0.54, 151, 155, 133],
    [0.76, 187, 186, 160],
    [1.00, 220, 216, 194],
  ]
  const smooth = (a) => a * a * (3 - 2 * a) // smoothstep
  for (let i = 0; i < W; i++) {
    const t = i / (W - 1)
    let s = 0
    while (s < stops.length - 2 && t > stops[s + 1][0]) s++
    const [t0, r0, g0, b0] = stops[s]
    const [t1, r1, g1, b1] = stops[s + 1]
    const a = smooth(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))))
    data[i*4+0] = Math.round(r0 + (r1 - r0) * a)
    data[i*4+1] = Math.round(g0 + (g1 - g0) * a)
    data[i*4+2] = Math.round(b0 + (b1 - b0) * a)
    data[i*4+3] = 255
  }
  _toonGrad = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat)
  _toonGrad.minFilter = THREE.LinearFilter
  _toonGrad.magFilter = THREE.LinearFilter
  _toonGrad.needsUpdate = true
  return _toonGrad
}

// ─── Procedural ground texture — warm painted grass with patches ──────────────
const _texCache = {}
function makeGroundTexture(base, light, dark, seed = 1) {
  const key = base + light + dark + seed
  if (_texCache[key]) return _texCache[key]
  const S = 512
  const c = document.createElement('canvas'); c.width = c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S)
  // Soft lighter centre (sun-kissed)
  const g = ctx.createRadialGradient(S*0.5, S*0.42, S*0.05, S*0.5, S*0.5, S*0.62)
  g.addColorStop(0, light); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  // Deterministic scattered blobs for organic variation
  let s = seed * 9301
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < 64; i++) {
    const x = rnd()*S, y = rnd()*S, r = 12 + rnd()*46
    ctx.globalAlpha = 0.06 + rnd()*0.11
    ctx.fillStyle = rnd() > 0.5 ? dark : light
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
  }
  // Fine speckle
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 760; i++) {
    const x = rnd()*S, y = rnd()*S
    ctx.fillStyle = rnd() > 0.5 ? dark : light
    ctx.fillRect(x, y, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  _texCache[key] = tex
  return tex
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const goalPct    = (g) => Math.min(Math.round((Number(g.current_amount) / (Number(g.target_amount) || 1)) * 100), 100)
const plantStage = (p) => p >= 100 ? 5 : p >= 70 ? 4 : p >= 45 ? 3 : p >= 20 ? 2 : p > 0 ? 1 : 0

// ─── Ribbon geometry (for stream) ────────────────────────────────────────────
function makeRibbonGeo(ctrlPts, width, N = 64) {
  const curve  = new THREE.CatmullRomCurve3(ctrlPts)
  const pts    = curve.getPoints(N)
  const verts  = [], uvs = [], idxs = []
  for (let i = 0; i <= N; i++) {
    const p   = pts[i]
    const t   = i / N
    const np  = pts[Math.min(i + 1, N)]
    const pp  = pts[Math.max(i - 1, 0)]
    const tan = np.clone().sub(pp).normalize()
    const perp = new THREE.Vector3(-tan.z, 0, tan.x)
    // Gently narrow both ends without pinching the stream before the spillway.
    const w = (width * 0.5) * (0.54 + 0.46 * Math.sin(t * Math.PI))
    const L = p.clone().addScaledVector(perp, -w)
    const R = p.clone().addScaledVector(perp,  w)
    verts.push(L.x, L.y, L.z, R.x, R.y, R.z)
    uvs.push(0, t * 5, 1, t * 5)
    // Wind counter-clockwise so the surface normal points up. Distortion along
    // a downward normal pushed the animated water into the island and flickered.
    if (i < N) { const b = i * 2; idxs.push(b, b+1, b+2, b+1, b+3, b+2) }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(idxs)
  geo.computeVertexNormals()
  return geo
}

// ─── Time-of-day ─────────────────────────────────────────────────────────────
function getTimeOfDay() {
  const h = new Date().getHours() + new Date().getMinutes() / 60
  const isNight = h < 5.5 || h >= 21
  const isDusk  = h >= 18 && h < 21
  const isDawn  = h >= 5.5 && h < 8
  return {
    isNight, isDusk, isDawn,
    // The sky stays deep and calm at every hour (harmonizes with the app's
    // dark shell — the island reads as a calm, dimensional sanctuary in it).
    // Time of day lives in the LIGHTING, which is where it reads best.
    bgColor:  isNight ? '#050a0d' : isDusk ? '#130d0a' : isDawn ? '#0f1410' : '#071512',
    skyTop:   isNight ? '#10223a' : isDusk ? '#6e3f2c' : isDawn ? '#58624c' : '#294b43',
    skyGnd:   isNight ? '#0d1212' : isDusk ? '#2c1e15' : isDawn ? '#26382b' : '#284437',
    sunInt:   isNight ? 0.20 : isDusk ? 0.78 : isDawn ? 0.92 : 1.22,
    sunColor: isNight ? '#7788a8' : isDusk ? '#e98a55' : isDawn ? '#e5c99c' : '#f2d7b2',
    sunPos:   isNight ? [-5, 8, 5] : [9, 20, 9],
    ambInt:   isNight ? 0.13 : isDusk ? 0.36 : isDawn ? 0.42 : 0.50,
    exposure: isNight ? 0.74 : isDusk ? 0.84 : isDawn ? 0.86 : 0.90,
  }
}
let TOD = getTimeOfDay()

// ─── Sky backdrop ─────────────────────────────────────────────────────────────
// A large inverted gradient sphere fills the canvas so tall phones never see a
// black void around the island. The bottom edge fades into the page bgColor.
function makeSkyTexture(top, bottom) {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, S)
  grad.addColorStop(0, top)
  grad.addColorStop(0.55, bottom)
  grad.addColorStop(1, bottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, S, S)
  // Radial falloff darkens the corners so the sphere blends into the page edge.
  const rad = ctx.createRadialGradient(S * 0.5, S * 0.45, S * 0.25, S * 0.5, S * 0.45, S * 0.88)
  rad.addColorStop(0, 'rgba(0,0,0,0)')
  rad.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = rad
  ctx.fillRect(0, 0, S, S)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
let skyTexture = makeSkyTexture(TOD.skyTop, TOD.bgColor)
function refreshTimeOfDay() {
  TOD = getTimeOfDay()
  skyTexture?.dispose?.()
  skyTexture = makeSkyTexture(TOD.skyTop, TOD.bgColor)
}
function SkyBackdrop() {
  const groupRef = useRef()
  const { camera } = useThree()
  useFrame(() => {
    if (!groupRef.current) return
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    groupRef.current.position.copy(camera.position).add(dir.multiplyScalar(-55))
    groupRef.current.lookAt(camera.position)
  })
  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[160, 160]} />
        <meshBasicMaterial map={skyTexture} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {TOD.isNight && (
        <Sparkles count={40} scale={[70, 30, 1]} position={[0, 0, 4]}
          size={1.8} speed={0.04} color="#ffffff" opacity={0.7} />
      )}
    </group>
  )
}

// ─── Responsive orthographic zoom ────────────────────────────────────────────
// Island radius = 8.3 world units. Viewed isometrically at 45° the island
// projects ±8.3 units on the camera right axis → full span ≈ 16.6 wu.
// We want the full island + fence + a little sky visible, so target visible
// world-width ≈ 19 units → zoom = canvas_px / 19 ≈ canvas_px * 0.053.
// Clamp so it never feels microscopic on huge desktop monitors.
function ResponsiveCamera({ reducedMotion = false }) {
  const { camera, size, invalidate } = useThree()
  const basePos = useMemo(() => new THREE.Vector3(18, 28, 18), [])
  const targetZoom = useMemo(() => {
    const zoomW = size.width / 20.8
    const zoomH = size.height / 25.5
    return Math.min(Math.max(Math.min(zoomW, zoomH), 12), 56)
  }, [size.height, size.width])

  useEffect(() => {
    if (!reducedMotion) return
    camera.zoom = targetZoom
    camera.position.copy(basePos)
    camera.lookAt(0, -0.8, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [basePos, camera, invalidate, reducedMotion, targetZoom])

  useFrame(({ clock }) => {
    // Fit the WHOLE island in both axes. In the iso projection the island spans
    // ~17 world-units wide and ~21 tall (disc ellipse + the dirt underside), so
    // zoom to the more constraining axis — otherwise a wide/short container
    // (like the dashboard card) clips the top and bottom.
    if (Math.abs(camera.zoom - targetZoom) > 0.3) {
      camera.zoom += (targetZoom - camera.zoom) * 0.08
      camera.updateProjectionMatrix()
    }
    // Drag-to-peek spring-back when the user releases.
    if (!isCanvasDragging) {
      dragVelocity = dragVelocity * 0.86 - dragAzimuth * 0.035
      dragAzimuth += dragVelocity
      dragAzimuth = Math.max(-0.42, Math.min(0.42, dragAzimuth))
      if (Math.abs(dragAzimuth) < 0.002 && Math.abs(dragVelocity) < 0.0002) {
        dragAzimuth = 0
        dragVelocity = 0
      }
    }
    // Subtle living drift — gentle sway, kept small so the island stays centred
    const t = clock.elapsedTime
    const driftX = reducedMotion ? 0 : Math.sin(t * 0.08) * 0.55
    const driftZ = reducedMotion ? 0 : Math.cos(t * 0.08) * 0.55
    const driftY = reducedMotion ? 0 : Math.sin(t * 0.05) * 0.28
    const targetPos = basePos.clone().applyAxisAngle(Y_UP, dragAzimuth)
    camera.position.set(targetPos.x + driftX, targetPos.y + driftY, targetPos.z + driftZ)
    // Aim a bit below the disc so the island sits centred (underside hangs down)
    camera.lookAt(0, -0.8, 0)
  })
  return null
}

// ─── GLTF toon loader ─────────────────────────────────────────────────────────
function GltfToon({ url, position = [0,0,0], rotation = [0,0,0], scale = 1,
                    leafColor, trunkColor, windPhase = 0, windStrength = 0 }) {
  const groupRef = useRef()
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(child => {
      if (!child.isMesh) return
      try {
        const o = child.material?.color ?? new THREE.Color(1,1,1)
        let col
        if (leafColor  && o.g > o.r * 0.85 && o.g > o.b * 0.85) col = leafColor
        else if (trunkColor) col = trunkColor
        else col = '#' + o.getHexString()
        child.material    = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: getToonGrad() })
        child.castShadow  = true
        child.receiveShadow = true
    } catch {}
    })
    return c
  }, [scene, leafColor, trunkColor])

  useFrame(({ clock }) => {
    if (!groupRef.current || windStrength === 0) return
    const t = clock.elapsedTime
    groupRef.current.rotation.x = Math.sin(t * 0.55 + windPhase) * windStrength * 0.013
    groupRef.current.rotation.z = Math.cos(t * 0.45 + windPhase) * windStrength * 0.010
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={obj} dispose={null} />
    </group>
  )
}

// ─── Floating island ──────────────────────────────────────────────────────────
// Per-stage ground palette: a prepared seedbed (0) → a deep sanctuary green (7)
const STAGE_GROUND = [
  { base: '#776948', light: '#9c8c60', dark: '#554a33', lip: '#57462f' },
  { base: '#73794b', light: '#949b62', dark: '#535b38', lip: '#4c5534' },
  { base: '#657d4f', light: '#829c65', dark: '#465f3a', lip: '#415a37' },
  { base: '#587c4c', light: '#77975f', dark: '#3c5d38', lip: '#385536' },
  { base: '#4d7948', light: '#6b925b', dark: '#355936', lip: '#315234' },
  { base: '#447344', light: '#628b58', dark: '#2e5434', lip: '#2b4d31' },
  { base: '#3d6d42', light: '#598252', dark: '#294d31', lip: '#27482f' },
  { base: '#37663f', light: '#527b4f', dark: '#25472f', lip: '#24432d' },
]
function FloatingIsland({ stage }) {
  const g = STAGE_GROUND[Math.max(0, Math.min(7, stage))]
  const groundTex = useMemo(() => makeGroundTexture(g.base, g.light, g.dark, stage + 1), [g, stage])
  return (
    <group>
      {/* Grassy top — painted texture (browns at low stages, greens as it grows) */}
      <mesh position={[0, 0.70, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8.3, 8.3, 0.50, 96]} />
        <meshToonMaterial map={groundTex} gradientMap={getToonGrad()} />
      </mesh>
      {/* Soft grassy lip overhanging the cliff */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[8.45, 8.55, 0.16, 96]} />
        <meshToonMaterial color={g.lip} gradientMap={getToonGrad()} />
      </mesh>
      {/* Warm earthy cliff strata */}
      {[{y:-0.32,t:8.55,b:7.3,h:2.0,c:'#785d43'},{y:-2.10,t:7.3,b:5.6,h:1.8,c:'#604934'},{y:-3.60,t:5.6,b:3.6,h:1.5,c:'#463526'}]
        .map((cl, i) => (
          <mesh key={i} position={[0, cl.y, 0]}>
            <cylinderGeometry args={[cl.t, cl.b, cl.h, 48]} />
            <meshToonMaterial color={cl.c} gradientMap={getToonGrad()} />
          </mesh>
        ))}
      <mesh position={[0, -5.1, 0]}>
        <coneGeometry args={[3.6, 3.6, 32]} />
        <meshToonMaterial color="#32231b" gradientMap={getToonGrad()} />
      </mesh>
      <HangingRoots />
      <FloatingRocks />
    </group>
  )
}

// ─── Island underside dressing — roots and bobbing rock shards ────────────────
const ROOT_DEFS = [
  { p: [2.4, -0.35, 2.0], r: [2.6, 0.2, -0.3], h: 2.2 },
  { p: [-3.0, -0.40, 1.4], r: [2.5, -0.3, 0.2], h: 2.6 },
  { p: [1.2, -0.30, -2.8], r: [2.7, 0.1, 0.3], h: 2.0 },
  { p: [-2.2, -0.35, -2.2], r: [2.55, -0.2, -0.2], h: 2.4 },
  { p: [4.0, -0.25, -0.8], r: [2.85, 0.4, 0.0], h: 1.7 },
]
const ROOT_COLOR = '#754225'
function HangingRoots() {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((r, i) => {
      if (!r) return
      r.rotation.z = ROOT_DEFS[i].r[2] + Math.sin(clock.elapsedTime * 0.7 + i) * 0.05
      r.rotation.x = ROOT_DEFS[i].r[1] + Math.cos(clock.elapsedTime * 0.55 + i) * 0.04
    })
  })
  return (
    <group>
      {ROOT_DEFS.map((d, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} position={d.p} rotation={[Math.PI - d.r[1], d.r[2], 0]}>
          <coneGeometry args={[0.08, d.h, 6]} />
          <meshToonMaterial color={ROOT_COLOR} emissive="#3d1f0a" emissiveIntensity={0.25} gradientMap={getToonGrad()} />
        </mesh>
      ))}
    </group>
  )
}

const ROCK_SHARDS = [
  { p: [3.6, -3.2, 2.6], c: '#b08a60', s: 0.62 },
  { p: [-3.2, -3.6, -1.8], c: '#9f7850', s: 0.48 },
  { p: [0.8, -2.9, -3.6], c: '#b89462', s: 0.44 },
]
function FloatingRocks() {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((r, i) => {
      if (!r) return
      r.position.y = ROCK_SHARDS[i].p[1] + Math.sin(clock.elapsedTime * 0.5 + i * 2.1) * 0.18
      r.rotation.x += 0.0012
      r.rotation.y += 0.0018
    })
  })
  return (
    <group>
      {ROCK_SHARDS.map((d, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} position={d.p}>
          <icosahedronGeometry args={[d.s, 0]} />
          <meshToonMaterial color={d.c} emissive="#2a1a10" emissiveIntensity={0.18} gradientMap={getToonGrad()} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Grass tufts — lush multi-tone clumps ─────────────────────────────────────
const GRASS_COUNT = 760
// Approx stream centreline z at a given x (matches STREAM_CTRL slope)
const streamZAt = (x) => Math.sin(x * 0.9) * 0.12
// Grass per stage: dead/dry & sparse at 0 → lush, dense, deep-green at 5.
const STAGE_GRASS = [
  { count: 180, h: [0.40, 0.76], tones: ['#899456', '#9da365', '#788449', '#b2aa70'] },
  { count: 300, h: [0.50, 0.94], tones: ['#8fa653', '#a2b763', '#7f9848', '#b3c374'] },
  { count: 410, h: [0.58, 1.12], tones: ['#72b557', '#85c367', '#62a648', '#93c977'] },
  { count: 520, h: [0.64, 1.28], tones: ['#62b34c', '#75c15d', '#51a23f', '#86ca6b'] },
  { count: 610, h: [0.68, 1.40], tones: ['#55ad43', '#68ba52', '#469a38', '#79c461'] },
  { count: 680, h: [0.70, 1.48], tones: ['#49a33b', '#59b047', '#3e9233', '#6cbb55'] },
  { count: 730, h: [0.72, 1.54], tones: ['#419a36', '#50a943', '#378a2f', '#62b64d'] },
  { count: 760, h: [0.74, 1.60], tones: ['#398f31', '#489e3c', '#317f2a', '#58aa46'] },
]
function GrassBlades({ stage, windStrength }) {
  const meshRef = useRef()
  const coloredStage = useRef(-1)
  const dummy  = useMemo(() => new THREE.Object3D(), [])
  const tmpCol = useMemo(() => new THREE.Color(), [])
  const cfg = STAGE_GRASS[Math.max(0, Math.min(7, stage))]
  const blades = useMemo(() => {
    const out = []
    let guard = 0
    while (out.length < cfg.count && guard < cfg.count * 12) {
      guard++
      const angle = Math.random() * Math.PI * 2
      const r = 4.2 + Math.pow(Math.random(), 0.5) * 3.45
      const cx = Math.cos(angle) * r, cz = Math.sin(angle) * r
      if (Math.abs(cz - streamZAt(cx)) < 1.5) continue   // keep stream clear
      if (Math.abs(cx) < 0.6) continue                   // keep central path clear
      const n = 3 + Math.floor(Math.random() * 4)
      const tone = cfg.tones[Math.floor(Math.random() * cfg.tones.length)]
      for (let k = 0; k < n && out.length < cfg.count; k++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 0.24
        out.push({
          x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr,
          ry: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2,
          h: cfg.h[0] + Math.random() * (cfg.h[1] - cfg.h[0]), tone,
        })
      }
    }
    return out
  }, [cfg])
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime, ws = windStrength * 0.2
    for (let i = 0; i < blades.length; i++) {
      const b = blades[i], sw = Math.sin(t * 1.4 + b.phase) * ws
      dummy.position.set(b.x, 1.02, b.z)
      dummy.rotation.set(sw, b.ry, sw * 0.5)
      dummy.scale.set(1, b.h, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.count = blades.length
    meshRef.current.instanceMatrix.needsUpdate = true
    // Recolour whenever the stage (and thus the blade set) changes
    if (coloredStage.current !== stage) {
      coloredStage.current = stage
      for (let i = 0; i < blades.length; i++) {
        tmpCol.set(blades[i].tone)
        meshRef.current.setColorAt(i, tmpCol)
      }
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    }
  })
  return (
    <instancedMesh ref={meshRef} args={[null, null, GRASS_COUNT]} castShadow>
      <coneGeometry args={[0.055, 0.34, 4]} />
      <meshToonMaterial color="#ffffff" gradientMap={getToonGrad()} />
    </instancedMesh>
  )
}

// ─── Stream ───────────────────────────────────────────────────────────────────
// A gently meandering stream crosses the island along the x-axis and meets the
// path at the central bridge. Its ends now reach the rim and feed both falls.
const STREAM_CTRL = [
  new THREE.Vector3(-8.48, 0,  0.00),
  new THREE.Vector3(-6.40, 0, -0.12),
  new THREE.Vector3(-4.20, 0,  0.14),
  new THREE.Vector3(-2.10, 0, -0.08),
  new THREE.Vector3( 0.0, 0, 0),   // bridge crossing — dead centre
  new THREE.Vector3( 2.10, 0,  0.10),
  new THREE.Vector3( 4.20, 0, -0.14),
  new THREE.Vector3( 6.40, 0,  0.10),
  new THREE.Vector3( 8.48, 0,  0.00),
]

// Pulsing foam cluster where water meets the bridge / rocks
function FoamTuft({ position, t0 = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + t0
    const s = 1 + Math.sin(t * 2.0) * 0.16
    ref.current.scale.set(s, 1, s)
    ref.current.children.forEach((c, i) => {
      if (c.material) c.material.opacity = 0.45 + Math.sin(t * 2.0 + i) * 0.25
    })
  })
  return (
    <group ref={ref} position={position}>
      {[[0,0,0.12],[0.12,0.05,0.08],[-0.10,0.06,0.09],[0.04,-0.10,0.07]].map((b, i) => (
        <mesh key={i} position={[b[0], 0, b[1]]} scale={[1, 0.4, 1]}>
          <sphereGeometry args={[b[2], 7, 7]} />
          <meshToonMaterial color="#dce9e2" gradientMap={getToonGrad()} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Stream() {
  // NB: island top surface sits at y≈0.95 — every layer must clear it or it's buried.
  const bankGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.85), [])
  const sandGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.42), [])
  const foamGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.26), [])
  const deepGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 1.45), [])
  const watGeo  = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.08), [])
  const coreGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 0.72), [])

  return (
    <group>
      {/* Earthen bank — frames the channel just above the island surface. */}
      <mesh position={[0, 0.956, 0]} receiveShadow>
        <primitive object={bankGeo} attach="geometry" />
        <meshToonMaterial color="#49372a" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* Sandy / pebbly shallows */}
      <mesh position={[0, 0.965, 0]} receiveShadow>
        <primitive object={sandGeo} attach="geometry" />
        <meshToonMaterial color="#9a8b70" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* Deep channel — darker teal centre, gives the water depth */}
      <mesh position={[0, 0.971, 0]}>
        <primitive object={deepGeo} attach="geometry" />
        <meshToonMaterial color="#174d5a" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* White foam rim at the water's edge */}
      <mesh position={[0, 0.974, 0]}>
        <primitive object={foamGeo} attach="geometry" />
        <meshToonMaterial color="#cbd8d1" gradientMap={getToonGrad()} transparent opacity={0.62} side={THREE.DoubleSide} />
      </mesh>
      {/* Water surface — restrained teal with a soft moving current */}
      <mesh position={[0, 0.981, 0]}>
        <primitive object={watGeo} attach="geometry" />
        <MeshDistortMaterial
          color="#2b7c84" emissive="#163f46" emissiveIntensity={0.12}
          roughness={0.32} metalness={0.04} transparent opacity={0.84}
          distort={0.10} speed={0.75} side={THREE.DoubleSide}
        />
      </mesh>
      {/* Brighter central current — sun glint + flow read */}
      <mesh position={[0, 0.988, 0]}>
        <primitive object={coreGeo} attach="geometry" />
        <MeshDistortMaterial
          color="#a8cbc6" emissive="#35666a" emissiveIntensity={0.10}
          roughness={0.22} metalness={0.03} transparent opacity={0.34}
          distort={0.16} speed={1.1} side={THREE.DoubleSide}
        />
      </mesh>
      {/* Foam crescents where the water meets the bridge piers + bank rocks */}
      {[[-0.85,0.35],[0.88,-0.30],[-4.80,0.50],[4.90,-0.40],[-2.60,0.70],[2.80,-0.60]].map((p, i) => (
        <FoamTuft key={i} position={[p[0], 0.99, p[1]]} t0={i * 1.3} />
      ))}
      {/* Foam / ripple sparkle drifting along the water */}
      <Sparkles count={10} scale={[15.5, 0.22, 1.25]} position={[0, 1.04, 0]}
        size={1.0} speed={0.28} color="#dcebe5" opacity={0.28} />
    </group>
  )
}

// ─── Waterfalls off the stream ends ───────────────────────────────────────────
const WATERFALL_VERTEX = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPhase;
  void main() {
    vUv = uv;
    vec3 p = position;
    float seamLock = 1.0 - smoothstep(0.72, 1.0, uv.y);
    float ripple = sin(uv.y * 16.0 + uTime * 2.2 + uv.x * 7.0 + uPhase) * 0.022;
    p.z += ripple * seamLock;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const WATERFALL_FRAGMENT = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPhase;
  void main() {
    float edge = smoothstep(0.02, 0.15, vUv.x) * smoothstep(0.02, 0.15, 1.0 - vUv.x);
    float bottom = smoothstep(0.0, 0.14, vUv.y);
    float strands = 0.5 + 0.5 * sin(vUv.x * 32.0 + sin(vUv.y * 7.0) - uTime * 0.45 + uPhase);
    float flow = pow(0.5 + 0.5 * sin(vUv.y * 38.0 + uTime * 3.2 + vUv.x * 6.0 + uPhase), 7.0);
    float crest = smoothstep(0.84, 1.0, vUv.y);
    vec3 deepWater = vec3(0.075, 0.275, 0.300);
    vec3 softLight = vec3(0.520, 0.690, 0.660);
    float detail = 0.15 + strands * 0.16 + flow * 0.18 + crest * 0.20;
    vec3 color = mix(deepWater, softLight, detail);
    float alpha = edge * bottom * (0.48 + strands * 0.09 + flow * 0.07 + crest * 0.10);
    gl_FragColor = vec4(color, alpha);
  }
`

function WaterfallSheet({ side, phase = 0, reducedMotion = false }) {
  const materialRef = useRef()
  const animationTime = useRef(0)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPhase: { value: phase },
  }), [phase])

  useFrame((_, delta) => {
    if (!materialRef.current || reducedMotion) return
    // Clamp long background-tab frames so the water resumes without jumping.
    animationTime.current += Math.min(delta, 0.05)
    materialRef.current.uniforms.uTime.value = animationTime.current
  })

  return (
    <group>
      {/* A short chute bridges the horizontal stream over the grassy lip. */}
      <mesh position={[side * 8.43, 0.967, 0]}>
        <boxGeometry args={[0.5, 0.075, 1.24]} />
        <meshStandardMaterial color="#2a6d73" emissive="#14383d" emissiveIntensity={0.08}
          roughness={0.30} metalness={0.02} />
      </mesh>
      {/* The sheet sits just outside the 8.55-radius cliff instead of clipping through it. */}
      <mesh position={[side * 8.58, -0.78, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={6}>
        <planeGeometry args={[1.3, 3.52, 18, 30]} />
        <shaderMaterial ref={materialRef} uniforms={uniforms}
          vertexShader={WATERFALL_VERTEX} fragmentShader={WATERFALL_FRAGMENT}
          transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

const MIST_PUFFS = [
  [-0.04, 0.02, -0.56, 0.68],
  [ 0.03, 0.12,  0.02, 0.86],
  [-0.02, 0.00,  0.58, 0.62],
  [ 0.07, 0.22,  0.30, 0.44],
]
function WaterfallMist({ side, reducedMotion = false }) {
  const mistRef = useRef()
  const animationTime = useRef(0)
  useFrame((_, delta) => {
    if (!mistRef.current || reducedMotion) return
    animationTime.current += Math.min(delta, 0.05)
    const pulse = 1 + Math.sin(animationTime.current * 1.2 + side) * 0.05
    mistRef.current.scale.set(pulse, pulse, pulse)
  })
  return (
    <group ref={mistRef} position={[side * 8.60, -2.48, 0]}>
      {MIST_PUFFS.map((p, index) => (
        <mesh key={index} position={[p[0], p[1], p[2]]} scale={[p[3] * 0.55, p[3] * 0.20, p[3]]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#c5d8d1" transparent opacity={0.13} depthWrite={false} />
        </mesh>
      ))}
      {!reducedMotion && <Sparkles count={5} scale={[0.45, 0.48, 1.8]} position={[0, 0.14, 0]}
        size={1.0} speed={0.22} color="#d8e7e1" opacity={0.24} />}
    </group>
  )
}

function Waterfalls({ reducedMotion = false }) {
  return (
    <group>
      <WaterfallSheet side={-1} phase={1.7} reducedMotion={reducedMotion} />
      <WaterfallSheet side={1} phase={0} reducedMotion={reducedMotion} />
      <WaterfallMist side={-1} reducedMotion={reducedMotion} />
      <WaterfallMist side={1} reducedMotion={reducedMotion} />
    </group>
  )
}

// ─── Stone bridge over the stream ─────────────────────────────────────────────
// Spans the stream at the centre. The bridge runs along the Z axis (the path).
function StreamBridge() {
  return (
    <group position={[0, 0.96, 0]}>
      {/* Approach ramps - stone slabs leading to bridge */}
      <mesh position={[0, 0.06, 1.55]} receiveShadow castShadow>
        <boxGeometry args={[1.30, 0.14, 0.50]} />
        <meshToonMaterial color="#b09870" gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 0.06, -1.55]} receiveShadow castShadow>
        <boxGeometry args={[1.30, 0.14, 0.50]} />
        <meshToonMaterial color="#b09870" gradientMap={getToonGrad()} />
      </mesh>
      {/* Main bridge deck — long enough to span the centred river */}
      <mesh position={[0, 0.10, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.30, 0.14, 3.00]} />
        <meshToonMaterial color="#d8c090" gradientMap={getToonGrad()} />
      </mesh>
      {/* Deck planks overlay */}
      {[-0.32, 0, 0.32].map((x, i) => (
        <mesh key={i} position={[x, 0.17, 0]}>
          <boxGeometry args={[0.28, 0.04, 3.00]} />
          <meshToonMaterial color="#c8a860" gradientMap={getToonGrad()} />
        </mesh>
      ))}
      {/* Stone parapet walls */}
      {[-0.60, 0.60].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.42, 3.00]} />
            <meshToonMaterial color="#a07848" gradientMap={getToonGrad()} />
          </mesh>
          {/* Top coping */}
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.20, 0.10, 3.12]} />
            <meshToonMaterial color="#c4a468" gradientMap={getToonGrad()} />
          </mesh>
          {/* Corner posts */}
          {[-1.40, 0, 1.40].map((z, j) => (
            <mesh key={j} position={[0, 0.12, z]} castShadow>
              <boxGeometry args={[0.22, 0.54, 0.22]} />
              <meshToonMaterial color="#8a6030" gradientMap={getToonGrad()} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Arch support underneath */}
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[1.30, 0.18, 0.60]} />
        <meshToonMaterial color="#7a5828" gradientMap={getToonGrad()} />
      </mesh>
    </group>
  )
}

// ─── Stream decor — reeds + lily pads ─────────────────────────────────────────
function Reed({ position, ry = 0 }) {
  return (
    <group position={position} rotation={[0, ry, 0]}>
      {[[-0.07,0.18],[0.06,-0.10],[0.0,0.04]].map((o, i) => (
        <group key={i} position={[o[0], 0, o[1]]} rotation={[0, 0, (i-1)*0.13]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.024, 0.66, 5]} />
            <meshToonMaterial color="#4ea83a" gradientMap={getToonGrad()} />
          </mesh>
          {i !== 2 && (
            <mesh position={[0, 0.64, 0]} castShadow>
              <capsuleGeometry args={[0.038, 0.10, 4, 8]} />
              <meshToonMaterial color="#7c4a22" gradientMap={getToonGrad()} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function LilyPad({ position, flower = false, ry = 0 }) {
  return (
    <group position={position} rotation={[0, ry, 0]}>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.33, 16, 0.55, Math.PI*2 - 1.1]} />
        <meshToonMaterial color="#3f9d4a" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {flower && (
        <group position={[0.05, 0.05, 0.05]}>
          {[0,1,2,3,4].map(i => {
            const a = (i/5) * Math.PI*2
            return (
              <mesh key={i} position={[Math.cos(a)*0.06, 0, Math.sin(a)*0.06]}>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshToonMaterial color="#f9a8d4" gradientMap={getToonGrad()} />
              </mesh>
            )
          })}
          <mesh><sphereGeometry args={[0.042, 6, 6]} /><meshToonMaterial color="#fde047" gradientMap={getToonGrad()} /></mesh>
        </group>
      )}
    </group>
  )
}

// Little sprout — two leaves + a bud, dotted along the riverbanks
function Sprout({ position, color = '#5cc24a' }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.07, 0]} castShadow><cylinderGeometry args={[0.012, 0.018, 0.14, 4]} /><meshToonMaterial color="#4a8a2e" gradientMap={getToonGrad()} /></mesh>
      <mesh position={[-0.05, 0.14, 0]} rotation={[0, 0, 0.7]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.06, 6, 6]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0.05, 0.14, 0]} rotation={[0, 0, -0.7]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.06, 6, 6]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0, 0.18, 0]} scale={[1, 0.65, 1]}><sphereGeometry args={[0.045, 6, 6]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
    </group>
  )
}
// River runs at z = 0; banks sit at z ≈ ±1.1. Bridge occupies x ≈ ±0.8, so decor avoids it.
const REED_POS  = [[-5.0,0.95,1.1,0.4],[-3.4,0.95,-1.1,1.2],[2.6,0.95,1.1,-0.5],[4.4,0.95,-1.1,2.0],[1.6,0.95,-1.0,0.8],[-1.6,0.95,1.0,1.6]]
const LILY_POS  = [[-3.0,0.984,0.2,0.3],[4.4,0.984,-0.3,1.1],[-4.8,0.984,0.3,2.2],[2.9,0.984,0.35,0.6]]
const SPROUT_POS = [
  [-5.3,0.955,1.15,'#6ace4c'],[-3.5,0.955,1.15,'#57bd3c'],[-1.8,0.955,1.15,'#7ed85d'],
  [ 1.8,0.955,1.15,'#57bd3c'],[ 3.8,0.955,1.15,'#6ace4c'],[ 5.3,0.955,1.15,'#92db66'],
  [-5.0,0.955,-1.15,'#6ace4c'],[-3.2,0.955,-1.15,'#7ed85d'],[-1.7,0.955,-1.15,'#57bd3c'],
  [ 1.9,0.955,-1.15,'#6ace4c'],[ 3.6,0.955,-1.15,'#92db66'],[ 5.2,0.955,-1.15,'#57bd3c'],
]
function StreamDecor() {
  return (
    <group>
      {REED_POS.map((p, i) => <Reed key={i} position={[p[0],p[1],p[2]]} ry={p[3]} />)}
      {LILY_POS.map((p, i) => <LilyPad key={i} position={[p[0],p[1],p[2]]} flower={i < 2} ry={p[3]} />)}
      {SPROUT_POS.map((p, i) => <Sprout key={`sp${i}`} position={[p[0],p[1],p[2]]} color={p[3]} />)}
    </group>
  )
}

// ─── Stream ripples ───────────────────────────────────────────────────────────
const RIPPLE_SPOTS = [
  { x: -3.8, z: 0.18, cycle: 2.4, delay: 0.0 },
  { x: 0.6, z: -0.22, cycle: 2.8, delay: 0.9 },
  { x: 4.2, z: 0.12, cycle: 2.6, delay: 1.7 },
]
function StreamRipples() {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((r, i) => {
      if (!r) return
      const d = RIPPLE_SPOTS[i]
      const t = ((clock.elapsedTime + d.delay) % d.cycle) / d.cycle
      r.position.set(d.x, 0.985, d.z)
      const s = 0.2 + t * 1.3
      r.scale.set(s, s, s)
      r.material.opacity = (1 - t) * 0.55
    })
  })
  return (
    <group>
      {RIPPLE_SPOTS.map((d, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} rotation={[-Math.PI/2, 0, 0]}>
          <ringGeometry args={[0.22, 0.32, 24]} />
          <meshBasicMaterial color="#aef0ff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Path stones — two sections either side of the centred river (bridge spans z ≈ ±1.6) ──
const FRONT_PATH_Z = [6.7, 6.0, 5.3, 4.6, 3.9, 3.2, 2.5, 1.9]
const BACK_PATH_Z  = [-1.9, -2.6, -3.3, -4.0, -4.7, -5.4, -6.1, -6.8]

// A soft sandy path strip beneath the stones (front section + back section),
// with a slightly darker border so the walkway reads clean and defined.
function PathStrip({ z0, z1, width = 0.92 }) {
  const len = Math.abs(z1 - z0), mid = (z0 + z1) / 2
  return (
    <group position={[0, 0, mid]}>
      <mesh position={[0, 0.948, 0]} receiveShadow>
        <boxGeometry args={[width + 0.14, 0.03, len]} />
        <meshToonMaterial color="#9c7a48" gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 0.956, 0]} receiveShadow>
        <boxGeometry args={[width, 0.03, len]} />
        <meshToonMaterial color="#cdb487" gradientMap={getToonGrad()} />
      </mesh>
    </group>
  )
}
function PathStones() {
  return (
    <group>
      {/* Defined sandy walkway under the stepping stones (either side of the bridge) */}
      <PathStrip z0={6.9} z1={1.7} />
      <PathStrip z0={-1.7} z1={-6.9} />
      {FRONT_PATH_Z.map((z, i) => (
        <mesh key={`f${i}`} position={[0, 0.972, z]} rotation={[0, i*0.4, 0]} receiveShadow>
          <cylinderGeometry args={[0.31, 0.34, 0.058, 7]} />
          <meshToonMaterial color="#d8d0c0" gradientMap={getToonGrad()} />
        </mesh>
      ))}
      {BACK_PATH_Z.map((z, i) => (
        <mesh key={`b${i}`} position={[0, 0.972, z]} rotation={[0, i*0.35, 0]} receiveShadow>
          <cylinderGeometry args={[0.29, 0.32, 0.058, 7]} />
          <meshToonMaterial color="#d8d0c0" gradientMap={getToonGrad()} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Rocks ────────────────────────────────────────────────────────────────────
const ROCK_DEFS = [
  { url:'/models/rock-large-a.glb', p:[ 6.5, 0.85,  2.5], s:0.55, ry:0.50 },
  { url:'/models/rock-large-b.glb', p:[-6.2, 0.85,  2.8], s:0.52, ry:-0.30 },
  { url:'/models/rock-small-a.glb', p:[ 6.1, 0.90, -4.5], s:0.60, ry:0.80 },
  { url:'/models/rock-small-b.glb', p:[-6.0, 0.90, -4.7], s:0.58, ry:1.10 },
  { url:'/models/rock-tall-a.glb',  p:[ 6.8, 0.85, -2.0], s:0.50, ry:-0.60 },
  // River-bank rocks (centered river runs along z=0, away from the bridge at x≈0)
  { url:'/models/rock-small-a.glb', p:[-5.2, 0.90,  1.2], s:0.32, ry:0.20 },
  { url:'/models/rock-small-b.glb', p:[ 5.2, 0.90, -1.2], s:0.30, ry:1.40 },
  { url:'/models/rock-small-a.glb', p:[-5.4, 0.90, -1.2], s:0.28, ry:2.10 },
]
function SceneRocks() {
  return (
    <>
      {ROCK_DEFS.map((r, i) => (
        <GltfToon key={i} url={r.url} position={r.p} rotation={[0, r.ry, 0]} scale={r.s} trunkColor="#a09480" />
      ))}
    </>
  )
}

// ─── Fence ring ───────────────────────────────────────────────────────────────
// Connected picket fence: ground-anchored posts joined by two horizontal rails.
const POST_COUNT = 30, FENCE_R = 7.65
const isFenceOpening = (angle) => Math.min(Math.abs(Math.sin(angle)), Math.abs(Math.cos(angle))) * FENCE_R < 1.15
function Fence() {
  const postRef = useRef(), railTopRef = useRef(), railBotRef = useRef()
  const capRef  = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])
  const ready   = useRef(false)
  // Refs are populated after R3F commit — set matrices on the first frame
  useFrame(() => {
    if (ready.current || !postRef.current || !railTopRef.current || !railBotRef.current || !capRef.current) return
    ready.current = true
    for (let i = 0; i < POST_COUNT; i++) {
      const pa = (i/POST_COUNT)*Math.PI*2          // post angle
      const ma = ((i+0.5)/POST_COUNT)*Math.PI*2    // mid-span angle (rail centre)
      const rr = -ma + Math.PI/2                    // align rail tangent to ring
      // Post — anchored into the ground, facing centre
      const postScale = isFenceOpening(pa) ? 0 : 1
      dummy.position.set(Math.cos(pa)*FENCE_R, 1.16, Math.sin(pa)*FENCE_R)
      dummy.rotation.set(0, -pa, 0); dummy.scale.setScalar(postScale); dummy.updateMatrix()
      postRef.current.setMatrixAt(i, dummy.matrix)
      // Post cap
      dummy.position.set(Math.cos(pa)*FENCE_R, 1.47, Math.sin(pa)*FENCE_R)
      dummy.updateMatrix(); capRef.current.setMatrixAt(i, dummy.matrix)
      // Top rail
      const railScale = isFenceOpening(ma) ? 0 : 1
      dummy.position.set(Math.cos(ma)*FENCE_R, 1.32, Math.sin(ma)*FENCE_R)
      dummy.rotation.set(0, rr, 0); dummy.scale.setScalar(railScale); dummy.updateMatrix()
      railTopRef.current.setMatrixAt(i, dummy.matrix)
      // Bottom rail
      dummy.position.set(Math.cos(ma)*FENCE_R, 1.07, Math.sin(ma)*FENCE_R)
      dummy.updateMatrix(); railBotRef.current.setMatrixAt(i, dummy.matrix)
    }
    postRef.current.instanceMatrix.needsUpdate    = true
    railTopRef.current.instanceMatrix.needsUpdate = true
    railBotRef.current.instanceMatrix.needsUpdate = true
    capRef.current.instanceMatrix.needsUpdate     = true
  })
  const railLen = (2*Math.PI*FENCE_R)/POST_COUNT + 0.06
  return (
    <>
      <instancedMesh ref={postRef} args={[null,null,POST_COUNT]} castShadow receiveShadow>
        <boxGeometry args={[0.13,0.62,0.13]} />
        <meshToonMaterial color="#b9803f" gradientMap={getToonGrad()} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[null,null,POST_COUNT]} castShadow>
        <boxGeometry args={[0.18,0.07,0.18]} />
        <meshToonMaterial color="#d8a258" gradientMap={getToonGrad()} />
      </instancedMesh>
      <instancedMesh ref={railTopRef} args={[null,null,POST_COUNT]} castShadow>
        <boxGeometry args={[railLen,0.085,0.085]} />
        <meshToonMaterial color="#cd9050" gradientMap={getToonGrad()} />
      </instancedMesh>
      <instancedMesh ref={railBotRef} args={[null,null,POST_COUNT]} castShadow>
        <boxGeometry args={[railLen,0.085,0.085]} />
        <meshToonMaterial color="#cd9050" gradientMap={getToonGrad()} />
      </instancedMesh>
    </>
  )
}

// ─── Lantern — warm path light, glows after dark ──────────────────────────────
function Lantern({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.055, 0.84, 6]} />
        <meshToonMaterial color="#6e4a22" gradientMap={getToonGrad()} />
      </mesh>
      {/* Housing + glowing pane */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[0.17, 0.21, 0.17]} />
        <meshToonMaterial color="#3a2a14" gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[0.115, 0.14, 0.115]} />
        <meshToonMaterial color="#ffd98a" emissive="#ffb347"
          emissiveIntensity={TOD.isNight ? 1.7 : 0.55} gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 1.06, 0]} castShadow>
        <coneGeometry args={[0.14, 0.11, 4]} />
        <meshToonMaterial color="#8a5a28" gradientMap={getToonGrad()} />
      </mesh>
      {TOD.isNight && (
        <pointLight position={[0, 0.95, 0]} intensity={1.5} color="#ffb347" distance={3.6} decay={2} />
      )}
    </group>
  )
}
// Flank both path entrances (path runs along x=0)
const LANTERN_POS = [
  [ 0.85, 0.95,  6.8], [-0.85, 0.95,  6.8],
  [ 0.85, 0.95, -6.8], [-0.85, 0.95, -6.8],
]

// ─── Signpost — compact game-style marker: icon ringed by progress + name tag ──
function Signpost({
  name,
  progress = null,
  type = 'savings',
  yOffset = 0,
  empty = false,
  markerText,
  persistentLabel = false,
  showProgressText = true,
  onSelect,
  accessibleLabel,
}) {
  const isInv  = type === 'investment'
  const hasProgress = Number.isFinite(progress)
  const done   = hasProgress && progress >= 100
  const ring   = done ? '#fbbf24' : isInv ? '#f59e0b' : '#22c55e'
  const accent = done ? '#fde68a' : isInv ? '#fcd34d' : '#86efac'
  const marker = markerText ?? (empty ? '+' : done ? '✓' : hasProgress ? `${progress}%` : '•')
  return (
    <group position={[0, 0.10, 1.28]}>
      {/* Slim grounding post */}
      <mesh position={[0, 0.40, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.80, 6]} />
        <meshToonMaterial color={isInv ? '#a8742a' : '#8a6a32'} gradientMap={getToonGrad()} />
      </mesh>
      <Html position={[0, 1.06 + yOffset, 0]} center zIndexRange={[30, 0]}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}>
        <button type="button" onClick={onSelect} onPointerDown={event => event.stopPropagation()}
          aria-label={accessibleLabel || `${name}, ${progress}% complete`}
          className="group relative flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          style={{ fontFamily: 'Inter Variable, Inter, system-ui, sans-serif' }}>
          {/* Progress ring (conic) wrapping the glossy icon chip. Empty plots are
              a dashed, muted "plant here" invitation — no ring fill, no %. */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', padding: '3px',
            background: empty || !hasProgress ? 'rgba(8,17,14,0.82)' : `conic-gradient(${ring} ${progress * 3.6}deg, rgba(255,255,255,0.30) 0deg)`,
            border: empty ? '1.5px dashed rgba(255,255,255,0.45)' : !hasProgress ? '1px solid rgba(255,255,255,0.25)' : 'none',
            boxShadow: empty ? 'none' : '0 4px 10px rgba(0,0,0,0.40)',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: empty ? '16px' : marker.length > 2 ? '10px' : '13px', fontWeight: 800,
              color: empty ? 'rgba(255,255,255,0.75)' : undefined,
              background: empty || !hasProgress ? 'rgba(12,20,10,0.72)'
                        : isInv ? 'linear-gradient(135deg,#fde68a,#f59e0b)'
                                : 'linear-gradient(135deg,#bbf7d0,#34d399)',
              ...(hasProgress || empty ? {} : { color: '#fff' }),
              boxShadow: empty ? 'none' : 'inset 0 1px 2px rgba(255,255,255,0.55)',
            }}>{marker}</div>
          </div>
          {/* Keep the sanctuary quiet: goal names reveal on hover/focus while
              the two collection groves retain a small permanent label. */}
          <div className={`absolute left-1/2 top-[calc(100%-2px)] flex -translate-x-1/2 items-center gap-1 transition-all duration-160 ${
            persistentLabel
              ? 'opacity-100'
              : 'pointer-events-none translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'
          }`} style={{
            background: 'rgba(8,17,14,0.90)', border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: '8px', padding: '3px 7px', whiteSpace: 'nowrap', backdropFilter: 'blur(5px)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: empty ? 'rgba(255,255,255,0.9)' : '#fff', maxWidth: '116px',
              overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            {!empty && hasProgress && showProgressText && <span style={{ fontSize: '12px', fontWeight: 800, color: accent }}>{progress}%</span>}
          </div>
        </button>
      </Html>
    </group>
  )
}

// ─── Interactive plot wrapper — hover pop + tap to open ───────────────────────
function InteractivePlot({ position, onSelect, children }) {
  const ref = useRef()
  const hover = useRef(false)
  const pressed = useRef(false)
  const start = useRef({ x: 0, y: 0, t: 0 })
  useFrame(() => {
    if (!ref.current) return
    let target = 1.0
    if (pressed.current) target = 1.07
    else if (hover.current) target = 1.07
    const s = ref.current.scale.x + (target - ref.current.scale.x) * 0.18
    ref.current.scale.set(s, s, s)
  })
  if (!onSelect) {
    return <group position={position}>{children}</group>
  }
  const enter = (e) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer' }
  const leave = (e) => { e.stopPropagation(); hover.current = false; pressed.current = false; document.body.style.cursor = 'auto' }
  const onPointerDown = (e) => {
    e.stopPropagation()
    pressed.current = true
    start.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() }
    if (ref.current) ref.current.scale.setScalar(0.94)
  }
  const onPointerMove = (e) => {
    if (!pressed.current) return
    const dx = e.nativeEvent.clientX - start.current.x
    const dy = e.nativeEvent.clientY - start.current.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8 || performance.now() - start.current.t > 250) {
      pressed.current = false
    }
  }
  const onPointerUp = (e) => {
    if (!pressed.current) return
    e.stopPropagation()
    pressed.current = false
    const dx = e.nativeEvent.clientX - start.current.x
    const dy = e.nativeEvent.clientY - start.current.y
    const dt = performance.now() - start.current.t
    if (dt < 250 && Math.abs(dx) < 8 && Math.abs(dy) < 8) onSelect()
  }
  return (
    <group position={position} ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={enter}
      onPointerOut={leave}>
      {/* Large transparent hit mesh so taps are easy on mobile. */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children}
    </group>
  )
}

// ─── Cemented accomplishment — a reached goal is set in stone ─────────────────
// A stone plinth + gold plaque ring the plot, so a completed goal reads as a
// permanent monument rather than an in-progress planting.
const DUST_SPOTS = [
  { start: [0.45, 0.12, 0.45], dir: [0.55, 0.85, 0.55] },
  { start: [-0.40, 0.10, 0.42], dir: [-0.50, 0.90, 0.50] },
  { start: [0.35, 0.08, -0.38], dir: [0.45, 0.80, -0.48] },
  { start: [-0.42, 0.14, -0.35], dir: [-0.55, 0.75, -0.45] },
  { start: [0.10, 0.10, 0.55], dir: [0.15, 0.95, 0.55] },
  { start: [-0.12, 0.11, -0.52], dir: [-0.18, 0.88, -0.52] },
]
function CementedBase({ animateIn = false }) {
  const groupRef = useRef()
  const dustRef = useRef()
  const startedAt = useRef(null)
  const hasAnimated = useRef(false)
  useFrame(() => {
    if (!groupRef.current) return
    if (!animateIn || hasAnimated.current) {
      groupRef.current.scale.setScalar(1)
      if (dustRef.current) dustRef.current.visible = false
      return
    }
    if (startedAt.current === null) startedAt.current = performance.now()
    const t = Math.min(1, (performance.now() - startedAt.current) / 520)
    let s
    if (t < 0.55) s = (t / 0.55) * 1.15
    else s = 1.15 - (t - 0.55) / 0.45 * 0.15
    groupRef.current.scale.setScalar(s)
    if (dustRef.current) {
      dustRef.current.visible = true
      const dt = Math.min(1, (performance.now() - startedAt.current) / 800)
      dustRef.current.children.forEach((c, i) => {
        const d = DUST_SPOTS[i]
        c.position.set(d.start[0], d.start[1], d.start[2])
        c.position.x += d.dir[0] * dt * 0.8
        c.position.y += d.dir[1] * dt * 0.8
        c.position.z += d.dir[2] * dt * 0.8
        c.scale.setScalar(0.08 + dt * 0.45)
        c.material.opacity = (1 - dt) * 0.5
      })
    }
    if (t >= 1) hasAnimated.current = true
  })
  return (
    <group>
      <group ref={groupRef}>
        <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.08, 1.18, 0.18, 28]} />
          <meshToonMaterial color="#9aa3ad" gradientMap={getToonGrad()} />
        </mesh>
        <mesh position={[0, 0.17, 0]} receiveShadow>
          <cylinderGeometry args={[1.0, 1.04, 0.05, 28]} />
          <meshToonMaterial color="#c6d0da" gradientMap={getToonGrad()} />
        </mesh>
        {/* gold plaque on the front lip */}
        <mesh position={[0, 0.16, 0.96]} rotation={[-0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.54, 0.30, 0.05]} />
          <meshToonMaterial color="#d9b945" emissive="#a8801a" emissiveIntensity={0.25} gradientMap={getToonGrad()} />
        </mesh>
      </group>
      <group ref={dustRef}>
        {DUST_SPOTS.map((d, i) => (
          <mesh key={i} position={d.start}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshBasicMaterial color="#a0a8b0" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ─── Unified goal plot — one growing plant per goal, cemented when reached ────
function GoalSlot({ position, goal, onSelect, yOffset = 0 }) {
  const p = goalPct(goal), st = plantStage(p), done = p >= 100
  const isInv = goal.goal_type === 'investment'
  const nm = goal.name.length > 22 ? `${goal.name.slice(0, 21)}…` : goal.name
  const wasDoneRef = useRef(done)
  useEffect(() => { wasDoneRef.current = done }, [done])
  const animateIn = done && !wasDoneRef.current
  return (
    <InteractivePlot position={position} onSelect={onSelect}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]} receiveShadow>
        <ringGeometry args={[0.98, 1.32, 40]} />
        <meshToonMaterial color="#c8b890" gradientMap={getToonGrad()} />
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
        <circleGeometry args={[0.98, 40]} />
        <meshToonMaterial color="#6b3e1e" gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 0.024, 0]}>
        <cylinderGeometry args={[0.98, 0.98, 0.048, 40]} />
        <meshToonMaterial color="#7c4a22" gradientMap={getToonGrad()} />
      </mesh>
      {done && <CementedBase animateIn={animateIn} />}
      {isInv ? <InvestPlant stage={st} /> : <SavingsPlant stage={st} />}
      <Signpost name={nm} progress={p} type={isInv ? 'investment' : 'savings'} yOffset={yOffset}
        onSelect={onSelect} accessibleLabel={`Open ${goal.name}, ${p}% complete`} />
    </InteractivePlot>
  )
}

function CollectionGrove({ position, name, count, legacy = false, onSelect, yOffset = 0 }) {
  return (
    <InteractivePlot position={position} onSelect={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[1.28, 40]} />
        <meshToonMaterial color={legacy ? '#75633d' : '#5c4930'} gradientMap={getToonGrad()} />
      </mesh>
      <LushTree position={[-0.45, 0.02, 0.08]} scale={0.72} palette={legacy ? 'gold' : 'green'} fruit={legacy} rotation={0.5} />
      <LushTree position={[0.38, 0.02, -0.18]} scale={0.62} palette={legacy ? 'orange' : 'lime'} fruit={legacy} rotation={-0.7} />
      <Signpost name={name} progress={legacy ? 100 : null} markerText={legacy ? '✓' : `${count}`} persistentLabel showProgressText={false}
        yOffset={yOffset} onSelect={onSelect}
        accessibleLabel={`Open ${name}, ${count} ${count === 1 ? 'goal' : 'goals'}`} />
    </InteractivePlot>
  )
}

// ─── Savings plants ───────────────────────────────────────────────────────────
function SavingsPlant({ stage }) {
  if (stage === 0) return <GltfToon url="/models/plant-flat.glb"    position={[0,0.95,0]} scale={0.90} leafColor="#4ade80" trunkColor="#15803d" />
  if (stage === 1) return <GltfToon url="/models/tree-thin.glb"     position={[0,0.95,0]} scale={1.00} leafColor="#4ade80" trunkColor="#7c3410" />
  if (stage === 2) return <GltfToon url="/models/tree-small.glb"    position={[0,0.95,0]} scale={1.15} leafColor="#22c55e" trunkColor="#7c3410" />
  if (stage === 3) return <GltfToon url="/models/tree-round.glb"    position={[0,0.95,0]} scale={1.30} leafColor="#16a34a" trunkColor="#7c3410" />
  if (stage === 4) return <GltfToon url="/models/tree-detailed.glb" position={[0,0.95,0]} scale={1.45} leafColor="#15803d" trunkColor="#5a2a08" />
  return (
    <group>
      <GltfToon url="/models/tree-oak.glb" position={[0,0.95,0]} scale={1.60} leafColor="#166534" trunkColor="#4a1e04" />
      <GoldStarGlow y={3.8} color="#86efac" emissive="#4ade80" />
      <pointLight position={[0,3.0,0]} intensity={1.2} color="#4ade80" distance={4} decay={2} />
    </group>
  )
}

// ─── Investment plants ────────────────────────────────────────────────────────
function InvestPlant({ stage }) {
  if (stage === 0) return <InvestmentStake />
  if (stage === 1) return <GltfToon url="/models/tree-thin.glb"     position={[0,0.95,0]} scale={1.00} leafColor="#fbbf24" trunkColor="#92400e" />
  if (stage === 2) return <GltfToon url="/models/tree-fat.glb"      position={[0,0.95,0]} scale={1.10} leafColor="#f59e0b" trunkColor="#78350f" />
  if (stage === 3) return <GltfToon url="/models/tree-round.glb"    position={[0,0.95,0]} scale={1.28} leafColor="#d97706" trunkColor="#78350f" />
  if (stage === 4) return <GltfToon url="/models/tree-detailed.glb" position={[0,0.95,0]} scale={1.42} leafColor="#b45309" trunkColor="#5a2800" />
  return (
    <group>
      <GltfToon url="/models/tree-oak.glb" position={[0,0.95,0]} scale={1.58} leafColor="#92400e" trunkColor="#4a1e00" />
      <GoldStarGlow y={3.8} color="#fde68a" emissive="#fbbf24" />
      <pointLight position={[0,3.0,0]} intensity={2.0} color="#fbbf24" distance={5} decay={2} />
    </group>
  )
}

function InvestmentStake() {
  const ref = useRef()
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.45 })
  return (
    <group position={[0, 0.10, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.64, 6]} />
        <meshToonMaterial color="#d4a520" emissive="#b88010" emissiveIntensity={0.22} gradientMap={getToonGrad()} />
      </mesh>
      <group ref={ref} position={[0, 0.68, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.13, 0]} />
          <meshToonMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.60} gradientMap={getToonGrad()} />
        </mesh>
      </group>
    </group>
  )
}

function GoldStarGlow({ y, color = '#fde68a', emissive = '#fbbf24' }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.scale.setScalar(1 + Math.sin(t*2.2)*0.20)
    ref.current.material.emissiveIntensity = 1.0 + Math.sin(t*2.2)*0.65
  })
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <sphereGeometry args={[0.20, 10, 10]} />
      <meshToonMaterial color={color} emissive={emissive} emissiveIntensity={1.2} gradientMap={getToonGrad()} />
    </mesh>
  )
}

// (Background trees are now the procedural lush PERIMETER_TREES — see above.)

// ─── Flowers ──────────────────────────────────────────────────────────────────
// ─── Flower beds — flowers grouped into tidy patches (not scattered) ──────────
const FLOWER_MODELS = ['/models/flower-purple.glb', '/models/flower-red.glb', '/models/flower-yellow.glb']
// One dense bed of flowers packed together (all touching, same spot).
function FlowerBed({ position, rotation = 0, windStrength = 0 }) {
  const spots = [
    [0, 0], [-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22],
    [-0.16, 0.16], [0.16, 0.16], [-0.16, -0.16], [0.16, -0.16],
  ]
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[0.5, 18]} />
        <meshToonMaterial color="#6b4a2a" gradientMap={getToonGrad()} />
      </mesh>
      {spots.map((s, i) => (
        <GltfToon key={i} url={FLOWER_MODELS[i % 3]} position={[s[0], 0.04, s[1]]}
          scale={0.62} windPhase={i * 0.7} windStrength={windStrength} />
      ))}
    </group>
  )
}
// One bed per front quadrant, in the inner lane between the path and the plots.
const FLOWER_BEDS = [
  [-1.4, 0, 4.9],
  [ 1.4, 0, 4.9],
]

// ─── Mushrooms ────────────────────────────────────────────────────────────────
const MUSHROOM_DEFS = [
  { url:'/models/mushroom-red.glb', p:[-7.2, 0.93,  1.0], ry: 0.5, s:0.70 },
  { url:'/models/mushroom-tan.glb', p:[ 7.2, 0.93,  1.2], ry:-0.8, s:0.70 },
  { url:'/models/mushroom-red.glb', p:[-6.5, 0.93, -3.5], ry: 1.2, s:0.65 },
  { url:'/models/mushroom-tan.glb', p:[ 6.5, 0.93, -3.2], ry:-1.5, s:0.65 },
  { url:'/models/mushroom-tan.glb', p:[ 1.7, 0.93, -7.2], ry: 0.3, s:0.60 },
  { url:'/models/mushroom-red.glb', p:[-4.5, 0.93,  6.2], ry: 2.1, s:0.58 },
  { url:'/models/mushroom-tan.glb', p:[ 4.8, 0.93,  6.0], ry:-0.9, s:0.58 },
]

// ─── Clouds ───────────────────────────────────────────────────────────────────
function CloudShape({ position, scale = 1, dark = false, speed = 1, opacity = 1, windStrength = 0 }) {
  const ref = useRef()
  const t0  = useMemo(() => Math.random()*100, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const ws = 0.06 + windStrength * 0.10
    ref.current.position.x = position[0] + Math.sin((clock.elapsedTime+t0)*ws*speed)*3
    ref.current.position.y = position[1] + Math.sin((clock.elapsedTime+t0)*0.04*speed)*0.4
  })
  return (
    <group ref={ref} scale={scale}>
      {[{p:[0,0,0],r:1.3},{p:[-1.1,-0.2,0],r:0.95},{p:[1.1,-0.2,0],r:1.05},{p:[-0.5,0.5,0],r:0.90},{p:[0.6,0.6,0],r:1.00}]
        .map((s,i) => (
          <mesh key={i} position={s.p}>
            <sphereGeometry args={[s.r,10,10]} />
            <meshToonMaterial color={dark ? '#455258' : '#6e817b'} gradientMap={getToonGrad()}
              transparent opacity={(dark ? 0.42 : 0.28) * opacity} depthWrite={false} />
          </mesh>
        ))}
    </group>
  )
}

// ─── Cloud framing — high, large clouds for tall phone viewports ──────────────
function CloudFraming({ dark = false, windStrength = 0 }) {
  const opacity = TOD.isNight ? 0.18 : 0.50
  return (
    <group>
      <CloudShape position={[-14, 13, -22]} scale={1.2} dark={dark} speed={0.35} opacity={opacity} windStrength={windStrength} />
      <CloudShape position={[16, 12, -20]} scale={1.0} dark={dark} speed={0.42} opacity={opacity} windStrength={windStrength} />
    </group>
  )
}

// ─── Butterflies ──────────────────────────────────────────────────────────────
const BF_CONFIGS = [
  { start:[-3.0,3.8,1.5],  colors:['#f97316','#fb923c'], t0:0.0 },
  { start:[ 3.5,3.5,0.5],  colors:['#a78bfa','#c4b5fd'], t0:2.1 },
  { start:[ 0.0,4.2,-2.5], colors:['#38bdf8','#7dd3fc'], t0:4.4 },
  { start:[-4.0,3.6,-1.0], colors:['#4ade80','#86efac'], t0:1.3 },
]
function Butterfly({ startPos, colors, t0 }) {
  const bodyRef = useRef(), wingRef = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + t0
    if (bodyRef.current) {
      bodyRef.current.position.set(startPos[0]+Math.sin(t*0.40)*2.5, startPos[1]+Math.sin(t*0.55)*0.6, startPos[2]+Math.cos(t*0.35)*2.0)
      bodyRef.current.rotation.y = Math.atan2(Math.cos(t*0.35), -Math.sin(t*0.40))
    }
    if (wingRef.current) wingRef.current.rotation.z = Math.sin(clock.elapsedTime*14)*0.65
  })
  return (
    <group ref={bodyRef} scale={0.38}>
      <group ref={wingRef}>
        {[[-0.42,colors[0]],[0.42,colors[1]]].map(([x,c],i) => (
          <mesh key={i} position={[x,0,0]} scale={i===1?[-1,1,1]:[1,1,1]}>
            <sphereGeometry args={[0.52,6,5]} />
            <meshToonMaterial color={c} emissive={c} emissiveIntensity={0.15} gradientMap={getToonGrad()} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      <mesh>
        <cylinderGeometry args={[0.062,0.062,0.50,5]} />
        <meshToonMaterial color="#1c0800" gradientMap={getToonGrad()} />
      </mesh>
    </group>
  )
}

// ─── Birds ────────────────────────────────────────────────────────────────────
function Birds({ count = 3 }) {
  const refs = useRef([])
  const configs = useMemo(() =>
    Array.from({length:count}, (_,i) => ({ t0:i*((Math.PI*2)/count), r:10+i*1.8, y:7+i*1.0, speed:0.26+i*0.04 })),
    [count])
  useFrame(({ clock }) => {
    configs.forEach((c,i) => {
      const b = refs.current[i]; if (!b) return
      const a = clock.elapsedTime*c.speed+c.t0
      b.position.set(Math.cos(a)*c.r, c.y, Math.sin(a)*c.r); b.rotation.y = -a+Math.PI/2
    })
  })
  return (
    <group>
      {configs.map((c,i) => (
        <group key={i} ref={el=>{refs.current[i]=el}}>
          {[[-0.32,0.32],[-0.32,-0.32]].map(([x],j) => (
            <mesh key={j} position={[x,0,0]} rotation={[0,0,j===0?0.32:-0.32]}>
              <boxGeometry args={[0.44,0.048,0.12]} />
              <meshToonMaterial color="#1c1c2e" gradientMap={getToonGrad()} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ─── Fireflies at night (stage ≥ 1) ───────────────────────────────────────────
function Fireflies() {
  return (
    <Sparkles count={20} scale={[14, 1.1, 14]} position={[0, 1.7, 0]}
      size={2.0} speed={0.12} color="#fde047" opacity={0.70} />
  )
}

// ─── Plot positions ───────────────────────────────────────────────────────────
// Unified goal slots — one per quadrant first (front-left, front-right,
// back-left, back-right), then a second ring further out for overflow. Goals
// fill these in order so they spread across all four quadrants; the next free
// slot shows the single "Add a goal" invitation. (Stream runs E-W at z=0, so
// z>1.5 is front, z<-1.5 is back — all slots clear the water.)
const QUADRANT_SLOTS = [
  [-2.6, 0.93,  3.0], [ 2.6, 0.93,  3.0], [-2.6, 0.93, -3.4], [ 2.6, 0.93, -3.4],
  [-4.4, 0.93,  3.8], [ 4.4, 0.93,  3.8], [-4.4, 0.93, -4.1], [ 4.4, 0.93, -4.1],
]
// Lift markers that would otherwise share a screen column with their neighbour.
const SLOT_SIGN_OFFSET = [0, 0, 0.6, 0.6, 1.1, 0.9, 1.7, 1.5]


// Lush round-canopy tree — fuller + more Hay Day than the low-poly cones.
// Supports autumn palettes and optional fruit.
const FRUIT_SPOTS = [[0.40,1.30,0.20],[-0.34,1.18,0.18],[0.10,1.55,-0.28],[0.30,1.05,-0.30],
                     [-0.42,1.42,-0.10],[0.00,1.22,0.46],[0.46,1.40,-0.04],[-0.18,1.62,0.18]]
const LUSH_PALETTES = {
  green:  ['#3f9a3a', '#48ab40', '#359030', '#43a23c'],
  lime:   ['#5cb84a', '#6fce55', '#4ea83c', '#62c24a'],
  orange: ['#d97a28', '#e8902f', '#c4661f', '#df8326'],
  red:    ['#c0392b', '#d6492f', '#a82f24', '#cc4030'],
  gold:   ['#d9a521', '#e8b62f', '#c2901c', '#dfad27'],
  autumn: ['#c97a2a', '#d99030', '#b5562a', '#cc8a3a'], // stage 1 — turning
  bare:   ['#7a6240', '#6b5436', '#5c4830', '#736040'], // stage 0 — dormant/dead
}
function LushTree({ position, scale = 1, palette = 'green', fruit = false, rotation = 0 }) {
  const c = LUSH_PALETTES[palette] ?? LUSH_PALETTES.green
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, 0.94, 7]} />
        <meshToonMaterial color="#7c4a22" gradientMap={getToonGrad()} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow><sphereGeometry args={[0.64, 12, 12]} />
        <meshToonMaterial color={c[0]} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0.38, 1.40, 0.22]} castShadow><sphereGeometry args={[0.42, 10, 10]} />
        <meshToonMaterial color={c[1]} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[-0.34, 1.32, -0.18]} castShadow><sphereGeometry args={[0.44, 10, 10]} />
        <meshToonMaterial color={c[2]} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0.05, 1.62, -0.10]} castShadow><sphereGeometry args={[0.40, 10, 10]} />
        <meshToonMaterial color={c[3]} gradientMap={getToonGrad()} /></mesh>
      {fruit && FRUIT_SPOTS.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.075, 7, 7]} />
          <meshToonMaterial color="#e0392b" emissive="#e0392b" emissiveIntensity={0.10} gradientMap={getToonGrad()} /></mesh>
      ))}
    </group>
  )
}
// Dense, colourful perimeter orchard — green + autumn tones like the reference.
// A full ring of lush trees, all kept clear of the diagonal stream band and the
// central path so nothing sits in the water or blocks the walkway.
// Zone orchards: trees that grow with each category's total value.
// ── Animals ──
function Chicken({ position, color = '#fbfbf6', t0 = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + t0
    ref.current.position.y = position[1] + Math.abs(Math.sin(t * 2.2)) * 0.035
    ref.current.rotation.y = Math.sin(t * 0.4) * 0.5
  })
  return (
    <group ref={ref} position={position} scale={0.5}>
      <mesh position={[0, 0.18, 0]} castShadow><sphereGeometry args={[0.18, 10, 10]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0, 0.33, 0.12]} castShadow><sphereGeometry args={[0.10, 8, 8]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0, 0.43, 0.12]}><boxGeometry args={[0.025, 0.07, 0.09]} /><meshToonMaterial color="#e0392b" gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0, 0.32, 0.22]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshToonMaterial color="#f6a821" gradientMap={getToonGrad()} /></mesh>
      <mesh position={[0, 0.24, -0.16]} rotation={[0.7, 0, 0]}><coneGeometry args={[0.07, 0.18, 5]} /><meshToonMaterial color={color} gradientMap={getToonGrad()} /></mesh>
      {[-0.05, 0.05].map((x, i) => <mesh key={i} position={[x, 0.04, 0.02]}><cylinderGeometry args={[0.012, 0.012, 0.10, 4]} /><meshToonMaterial color="#f6a821" gradientMap={getToonGrad()} /></mesh>)}
    </group>
  )
}
function Sheep({ position, t0 = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime + t0
    ref.current.position.y = position[1] + Math.sin(t * 1.5) * 0.02
    ref.current.rotation.y = Math.sin(t * 0.25 + t0) * 0.55
  })
  return (
    <group ref={ref} position={position} scale={0.62}>
      {[[0,0.26,0,0.22],[-0.16,0.24,0,0.16],[0.16,0.24,0,0.16],[0,0.33,0.08,0.15],[0,0.30,-0.13,0.16]].map((s, i) => (
        <mesh key={i} position={[s[0], s[1], s[2]]} castShadow><sphereGeometry args={[s[3], 8, 8]} /><meshToonMaterial color="#f3f0e7" gradientMap={getToonGrad()} /></mesh>
      ))}
      <mesh position={[0, 0.27, 0.25]} castShadow><sphereGeometry args={[0.11, 8, 8]} /><meshToonMaterial color="#403833" gradientMap={getToonGrad()} /></mesh>
      {[-0.09, 0.09].map((x, i) => <mesh key={i} position={[x, 0.33, 0.24]}><sphereGeometry args={[0.045, 6, 6]} /><meshToonMaterial color="#403833" gradientMap={getToonGrad()} /></mesh>)}
      {[[-0.1,-0.08],[0.1,-0.08],[-0.1,0.08],[0.1,0.08]].map((p, i) => <mesh key={`l${i}`} position={[p[0], 0.08, p[1]]}><cylinderGeometry args={[0.032, 0.032, 0.17, 5]} /><meshToonMaterial color="#403833" gradientMap={getToonGrad()} /></mesh>)}
    </group>
  )
}

// ── Animated farm life: grazing animals on the open front lawns ──
function FarmLife() {
  return (
    <group position={[0, 0.95, 0]}>
      {/* Chickens pecking on the front-right (investments) lawn edge */}
      <Chicken position={[5.3, 0, 5.6]} t0={0} />
      <Chicken position={[5.8, 0, 5.2]} color="#f4d9b0" t0={1.5} />
      <Chicken position={[5.0, 0, 5.0]} t0={3.0} />
      {/* Sheep grazing on the front-left (savings) lawn edge */}
      <Sheep position={[-5.4, 0, 5.4]} t0={0.5} />
      <Sheep position={[-4.9, 0, 5.8]} t0={2.4} />
    </group>
  )
}

// ─── Celebration burst — scene-side reward when the garden grows ──────────────
const BURST_PARTICLES = 16
const BURST_DURATION = 1600
const BURST_COLORS = ['#fbbf24', '#f472b6', '#86efac', '#60a5fa']
function CelebrationBurst() {
  const { burstAt } = useGarden()
  const meshRef = useRef()
  const lightRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpCol = useMemo(() => new THREE.Color(), [])
  const particles = useMemo(() => Array.from({ length: BURST_PARTICLES }, () => ({
    vx: (Math.random() - 0.5) * 4.0,
    vy: 3.0 + Math.random() * 3.0,
    vz: (Math.random() - 0.5) * 4.0,
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 4,
    color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
    size: 0.10 + Math.random() * 0.12,
  })), [])
  useFrame(() => {
    if (!meshRef.current) return
    if (!burstAt) {
      meshRef.current.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      return
    }
    const t = Math.min(1, (performance.now() - burstAt) / BURST_DURATION)
    if (t >= 1) {
      meshRef.current.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      return
    }
    meshRef.current.visible = true
    if (lightRef.current) lightRef.current.intensity = Math.sin(t * Math.PI) * 2.4
    const g = 9.8
    for (let i = 0; i < BURST_PARTICLES; i++) {
      const p = particles[i]
      const x = p.vx * t * 1.8
      const y = p.vy * t * 1.8 - 0.5 * g * t * t * 2.8
      const z = p.vz * t * 1.8
      const s = p.size * (1 - t * 0.75)
      dummy.position.set(x, Math.max(0.7, 1.1 + y), z)
      dummy.rotation.set(p.spin * t, p.rot + p.spin * t, 0)
      dummy.scale.setScalar(Math.max(0.001, s))
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
      tmpCol.set(p.color)
      meshRef.current.setColorAt(i, tmpCol)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={meshRef} args={[null, null, BURST_PARTICLES]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial vertexColors transparent opacity={0.92} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <pointLight ref={lightRef} position={[0, 2.5, 0]} intensity={0} color="#fbbf24" distance={8} decay={2} />
    </group>
  )
}

// ─── Island group ─────────────────────────────────────────────────────────────
function IslandGroup({ groupedGoals, stage, momentum, onSelectGoal, onSelectOverflow, onSelectLegacy, reducedMotion }) {
  const windStrength = reducedMotion ? 0 : momentum === 'lively' ? 0.24 : momentum === 'gentle' ? 0.14 : 0.07
  const bedCount = stage < 4 ? 0 : stage < 6 ? 1 : FLOWER_BEDS.length
  const mushCount = stage < 5 ? 0 : stage < 7 ? 2 : MUSHROOM_DEFS.length
  const birdCount = reducedMotion || stage < 4 ? 0 : momentum === 'lively' ? Math.min(6, stage) : momentum === 'gentle' ? 2 : 0

  return (
    <group>
      <FloatingIsland stage={stage} />
      <GrassBlades stage={stage} windStrength={windStrength} />
      <Stream />
      <StreamRipples />
      <StreamDecor />
      <StreamBridge />
      <Waterfalls reducedMotion={reducedMotion} />
      <PathStones />
      <SceneRocks />
      <Fence />
      {LANTERN_POS.map((p, i) => <Lantern key={`ln${i}`} position={p} />)}

      {stage >= 6 && momentum === 'lively' && !reducedMotion && <FarmLife />}

      {groupedGoals.visible.map((g, i) => (
        <GoalSlot key={g.id} position={QUADRANT_SLOTS[i]} goal={g} yOffset={SLOT_SIGN_OFFSET[i]}
          onSelect={onSelectGoal ? () => onSelectGoal(g) : undefined} />
      ))}
      {groupedGoals.overflow.length > 0 && (
        <CollectionGrove position={QUADRANT_SLOTS[7]} name={`More · ${groupedGoals.overflow.length}`}
          count={groupedGoals.overflow.length} onSelect={onSelectOverflow} yOffset={SLOT_SIGN_OFFSET[7]} />
      )}
      {groupedGoals.legacy.length > 0 && (
        <CollectionGrove position={QUADRANT_SLOTS[6]} name={`Legacy · ${groupedGoals.legacy.length}`}
          count={groupedGoals.legacy.length} legacy onSelect={onSelectLegacy} yOffset={SLOT_SIGN_OFFSET[6]} />
      )}
      {FLOWER_BEDS.slice(0, bedCount).map((p, i) => (
        <FlowerBed key={`fb${i}`} position={p} rotation={i * 0.8} windStrength={windStrength} />
      ))}
      {MUSHROOM_DEFS.slice(0, mushCount).map((m, i) => (
        <GltfToon key={i} url={m.url} position={m.p} rotation={[0, m.ry, 0]} scale={m.s} />
      ))}

      {birdCount > 0 && <Birds count={birdCount} />}

    </group>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ groupedGoals, stage, momentum, sceneTone, onSelectGoal, onSelectOverflow, onSelectLegacy, reducedMotion, quality }) {
  const cloudCount = sceneTone === 'strained' ? 2 : 0
  const windStrength = reducedMotion ? 0 : momentum === 'lively' ? 0.22 : momentum === 'gentle' ? 0.12 : 0.05
  const butterflyCount = reducedMotion || momentum !== 'lively' || stage < 4 ? 0 : Math.min(4, stage - 2)
  return (
    <>
      <ResponsiveCamera reducedMotion={reducedMotion} />
      <color attach="background" args={[TOD.bgColor]} />
      <SkyBackdrop />
      <hemisphereLight skyColor={TOD.skyTop} groundColor={TOD.skyGnd} intensity={TOD.ambInt} />
      <directionalLight
        position={TOD.sunPos}
        intensity={sceneTone === 'strained' ? TOD.sunInt * 0.82 : TOD.sunInt}
        color={TOD.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-8, 4, -10]} intensity={TOD.isNight ? 0.08 : 0.18} color="#9fb6ac" />
      {/* Stream glow — soft cool fill near the water (river runs along z = 0) */}
      <pointLight position={[0, 1.05, 0]} intensity={TOD.isNight ? 0.75 : 0.22} color="#4f8f91" distance={8} decay={2.2} />
      <fog attach="fog" args={[TOD.bgColor, 38, 105]} />

      <ContactShadows position={[0, 0.97, 0]} opacity={0.50} width={24} height={24} blur={2.2} far={4.5} color="#1a3808" />

      {reducedMotion ? (
        <IslandGroup groupedGoals={groupedGoals} stage={stage} momentum={momentum} reducedMotion
          onSelectGoal={onSelectGoal} onSelectOverflow={onSelectOverflow} onSelectLegacy={onSelectLegacy} />
      ) : (
        <Float speed={0.55} rotationIntensity={0.018} floatIntensity={0.32} floatingRange={[-0.08, 0.08]}>
          <IslandGroup groupedGoals={groupedGoals} stage={stage} momentum={momentum}
            onSelectGoal={onSelectGoal} onSelectOverflow={onSelectOverflow} onSelectLegacy={onSelectLegacy} />
        </Float>
      )}

      <CelebrationBurst />

      {!reducedMotion && momentum === 'lively' && stage >= 4 && (
        <Sparkles count={TOD.isNight ? 20 : 8} scale={[14, 6, 14]} position={[0, 1.8, 0]}
          size={TOD.isNight ? 3.5 : 2.2} speed={0.25}
          color={TOD.isNight ? '#fef08a' : '#c8f5a0'} opacity={TOD.isNight ? 0.80 : 0.42} />
      )}
      {BF_CONFIGS.slice(0, butterflyCount).map((b, i) => (
        <Butterfly key={i} startPos={b.start} colors={b.colors} t0={b.t0} />
      ))}
      {!reducedMotion && TOD.isNight && momentum !== 'resting' && stage >= 2 && <Fireflies />}
      <CloudFraming dark={false} windStrength={windStrength} />
      {cloudCount > 0 && (
        <>
          <CloudShape position={[-16, 10, -6]} scale={1.1} dark={false} speed={reducedMotion ? 0 : 0.45} opacity={0.72} windStrength={windStrength} />
          <CloudShape position={[14, 8, -10]} scale={0.9} dark={false} speed={reducedMotion ? 0 : 0.55} opacity={0.66} windStrength={windStrength} />
        </>
      )}
      {quality === 'high' && !reducedMotion && <EffectComposer multisampling={0}>
        <Bloom intensity={0.18} luminanceThreshold={0.82} luminanceSmoothing={0.76} mipmapBlur radius={0.44} />
        <HueSaturation saturation={TOD.isNight ? -0.02 : -0.08} />
        <Vignette eskil={false} offset={0.24} darkness={TOD.isNight ? 0.70 : 0.46} />
      </EffectComposer>}
    </>
  )
}

// ─── Preload all GLTF models ──────────────────────────────────────────────────
;[
  '/models/plant-flat.glb', '/models/tree-thin.glb', '/models/tree-small.glb',
  '/models/tree-round.glb', '/models/tree-detailed.glb', '/models/tree-oak.glb',
  '/models/tree-fat.glb',
  '/models/flower-purple.glb','/models/flower-red.glb','/models/flower-yellow.glb',
  '/models/mushroom-red.glb','/models/mushroom-tan.glb',
  '/models/rock-large-a.glb','/models/rock-large-b.glb',
  '/models/rock-small-a.glb','/models/rock-small-b.glb','/models/rock-tall-a.glb',
].forEach(u => useGLTF.preload(u))

// ─── Error boundary — degrade gracefully if WebGL / a model fails ─────────────
class GardenErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { if (import.meta.env.DEV) console.warn('Garden3D failed:', err) }
  render() {
    if (this.state.failed) {
      const fallbackStage = STAGE_NAMES[this.props.stage] || STAGE_NAMES[0]
      const growth = Math.max(0, Math.min(7, Number(this.props.stage) || 0))
      return (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_42%,#4f9b57_0,#24573c_34%,#0a2018_68%,#07110d_100%)]">
          <div className="text-center text-white drop-shadow">
            <div className="relative mx-auto mb-4 h-36 w-44" aria-hidden="true">
              <div className="absolute bottom-2 left-1/2 h-14 w-32 -translate-x-1/2 rounded-[50%] bg-[#5a341f] shadow-2xl" />
              <div className="absolute bottom-8 left-1/2 h-20 w-40 -translate-x-1/2 rounded-[50%] border border-emerald-100/25 bg-[#4f8f4f] shadow-[inset_0_8px_20px_rgba(255,255,255,0.12)]">
                <div className="absolute inset-3 rounded-[50%] border border-dashed border-amber-100/25 bg-[#6c5430]/45" />
              </div>
              <div className="absolute bottom-[4.15rem] left-1/2 -translate-x-1/2">
                <span className="block w-2 -translate-x-1/2 rounded-full bg-emerald-200/95" style={{ height: `${18 + growth * 5}px` }} />
                <span className="absolute -left-7 top-2 h-5 w-8 rotate-12 rounded-[100%_0_100%_0] bg-emerald-300/95" />
                <span className="absolute -right-6 top-0 h-5 w-8 -rotate-12 rounded-[0_100%_0_100%] bg-emerald-200/95" />
                {growth >= 3 && <span className="absolute -left-7 -top-5 h-10 w-14 rounded-[50%] bg-emerald-400/95 shadow-lg" />}
              </div>
              {Array.from({ length: growth >= 4 ? growth - 2 : 0 }, (_, index) => (
                <span key={index} className="absolute h-3 w-3 rounded-full border-2 border-amber-50/80 bg-amber-300"
                  style={{ left: `${30 + index * 17}%`, bottom: `${37 + (index % 2) * 8}%` }} />
              ))}
            </div>
            <div className="text-[15px] font-semibold">Your {fallbackStage} garden is resting</div>
            <div className="mt-1 text-[13px] font-medium text-white/75">The peaceful view is available without 3D.</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
const Garden3D = memo(function Garden3D({ onSelectGoal, onSelectOverflow, onSelectLegacy }) {
  const { stage, milestones, momentum, sceneTone, goals } = useGarden()
  const containerRef = useRef()
  const reducedMotion = useReducedMotion()
  const [quality, setQuality] = useState('high')
  const [, setTimeVersion] = useState(0)
  const groupedGoals = useMemo(() => groupGardenGoals(goals, milestones), [goals, milestones])

  useEffect(() => {
    const refresh = () => {
      refreshTimeOfDay()
      setTimeVersion(version => version + 1)
    }
    const timer = setInterval(refresh, 5 * 60 * 1000)
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || reducedMotion) return undefined
    let active = false, sx = 0, moved = false, pid = null
    const down = (e) => {
      active = true; moved = false; sx = e.clientX; pid = e.pointerId
    }
    const move = (e) => {
      if (!active || e.pointerId !== pid) return
      const dx = e.clientX - sx
      if (!moved && Math.abs(dx) > 8) {
        moved = true; isCanvasDragging = true; el.setPointerCapture(pid)
      }
      if (moved) {
        dragAzimuth = Math.max(-0.42, Math.min(0.42, dragAzimuth + dx * 0.003))
        dragVelocity = dx * 0.001
        sx = e.clientX
      }
    }
    const up = (e) => {
      if (!active || e.pointerId !== pid) return
      active = false; isCanvasDragging = false; pid = null
      if (moved) { try { el.releasePointerCapture(e.pointerId) } catch {} }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [reducedMotion])
  return (
    <div ref={containerRef} className="w-full h-full touch-none" style={{ touchAction: 'none' }}>
      <GardenErrorBoundary stage={stage}>
        <Canvas
          orthographic
          frameloop={reducedMotion ? 'demand' : 'always'}
          shadows={quality === 'high' ? { type: THREE.PCFSoftShadowMap } : false}
          dpr={quality === 'high' ? [1, 1.5] : [1, 1]}
          gl={{ antialias: true, powerPreference: 'high-performance',
                toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: TOD.exposure }}
          camera={{ position: [18, 28, 18], zoom: 21 }}
          onCreated={({ camera }) => { camera.lookAt(0, 0.5, 0); camera.updateProjectionMatrix() }}
        >
          <AdaptiveDpr pixelated />
          <PerformanceMonitor onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} flipflops={2}>
            <Suspense fallback={null}>
              <Scene groupedGoals={groupedGoals} stage={stage} momentum={momentum} sceneTone={sceneTone}
                onSelectGoal={onSelectGoal} onSelectOverflow={onSelectOverflow} onSelectLegacy={onSelectLegacy}
                reducedMotion={reducedMotion} quality={quality} />
            </Suspense>
          </PerformanceMonitor>
        </Canvas>
      </GardenErrorBoundary>
    </div>
  )
})

export default Garden3D
