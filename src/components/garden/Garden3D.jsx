import { memo, useRef, useMemo, Suspense, Component } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import {
  Float, Html, Sparkles, ContactShadows,
  AdaptiveDpr, PerformanceMonitor, MeshDistortMaterial, useGLTF,
} from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useGarden } from '@/context/GardenContext'

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
    [0.00, 150, 128, 120],
    [0.32, 178, 158, 138],
    [0.55, 208, 196, 168],
    [0.74, 232, 224, 198],
    [1.00, 255, 252, 240],
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
  for (let i = 0; i < 90; i++) {
    const x = rnd()*S, y = rnd()*S, r = 12 + rnd()*46
    ctx.globalAlpha = 0.10 + rnd()*0.16
    ctx.fillStyle = rnd() > 0.5 ? dark : light
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
  }
  // Fine speckle
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 1400; i++) {
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

// Contextual icon from a goal's name (falls back to type)
function goalIcon(name = '', type = 'savings', done = false) {
  const n = name.toLowerCase()
  const has = (...k) => k.some(w => n.includes(w))
  if (has('house', 'home', 'mortgage', 'down payment', 'apartment', 'condo')) return '🏡'
  if (has('car', 'auto', 'vehicle', 'truck', 'tesla'))                        return '🚗'
  if (has('vacation', 'trip', 'travel', 'holiday', 'flight', 'getaway'))      return '✈️'
  if (has('wedding', 'ring', 'engage', 'marri'))                              return '💍'
  if (has('emergency', 'rainy', 'safety', 'cushion'))                         return '🛟'
  if (has('baby', 'child', 'kid', 'family'))                                  return '👶'
  if (has('school', 'college', 'tuition', 'education', 'degree', 'student'))  return '🎓'
  if (has('retire', '401k', '401', 'ira', 'roth', 'pension'))                 return '🏦'
  if (has('invest', 'brokerage', 'stock', 'equity', 'portfolio', 'index'))    return '📈'
  if (has('wealth', 'growth', 'million', 'rich'))                             return '💎'
  if (has('phone', 'laptop', 'computer', 'tech', 'gadget'))                   return '💻'
  if (has('debt', 'loan', 'credit', 'payoff', 'pay off'))                     return '💳'
  if (has('boat', 'yacht', 'sail'))                                           return '⛵'
  if (has('bike', 'cycle', 'motor'))                                          return '🏍️'
  if (has('health', 'medical', 'gym', 'fitness'))                             return '💪'
  if (has('business', 'startup', 'company', 'venture'))                       return '💼'
  if (has('gift', 'present', 'holiday'))                                      return '🎁'
  if (has('fund', 'save', 'saving', 'nest', 'cash'))                          return '💰'
  if (has('future', 'dream', 'goal'))                                         return '⭐'
  return type === 'investment' ? '📈' : '🌱'
}

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
    // Taper to softly rounded ends, full width in the middle — keeps the
    // stream from ending in a hard rectangular edge near the fence.
    const w = (width * 0.5) * (0.42 + 0.66 * Math.sin(t * Math.PI))
    const L = p.clone().addScaledVector(perp, -w)
    const R = p.clone().addScaledVector(perp,  w)
    verts.push(L.x, L.y, L.z, R.x, R.y, R.z)
    uvs.push(0, t * 5, 1, t * 5)
    if (i < N) { const b = i * 2; idxs.push(b, b+2, b+1, b+1, b+2, b+3) }
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
    // dark shell — the island reads as a bright diorama floating in it).
    // Time of day lives in the LIGHTING, which is where it reads best.
    bgColor:  isNight ? '#070d17' : isDusk  ? '#170f0a' : isDawn  ? '#161109' : '#0a1d22',
    skyTop:   isNight ? '#1a2d5a' : isDusk  ? '#cc5522' : '#aadef5',
    skyGnd:   isNight ? '#1a1200' : isDusk  ? '#7a2d08' : '#a8d67e',
    sunInt:   isNight ? 0.22 : isDusk ? 1.1 : isDawn ? 1.3 : 2.0,
    sunColor: isNight ? '#8090c0' : isDusk ? '#ff8030' : '#fff0d2',
    sunPos:   isNight ? [-5, 8, 5] : [9, 20, 9],
    ambInt:   isNight ? 0.15 : 0.82,
  }
}
const TOD = getTimeOfDay()

// ─── Responsive orthographic zoom ────────────────────────────────────────────
// Island radius = 8.3 world units. Viewed isometrically at 45° the island
// projects ±8.3 units on the camera right axis → full span ≈ 16.6 wu.
// We want the full island + fence + a little sky visible, so target visible
// world-width ≈ 19 units → zoom = canvas_px / 19 ≈ canvas_px * 0.053.
// Clamp so it never feels microscopic on huge desktop monitors.
function ResponsiveCamera() {
  const { camera, size } = useThree()
  useFrame(({ clock }) => {
    // Fit the WHOLE island in both axes. In the iso projection the island spans
    // ~17 world-units wide and ~21 tall (disc ellipse + the dirt underside), so
    // zoom to the more constraining axis — otherwise a wide/short container
    // (like the dashboard card) clips the top and bottom.
    const zoomW  = size.width  / 19.8
    const zoomH  = size.height / 21
    const target = Math.min(Math.max(Math.min(zoomW, zoomH), 12), 56)
    if (Math.abs(camera.zoom - target) > 0.3) {
      camera.zoom += (target - camera.zoom) * 0.08
      camera.updateProjectionMatrix()
    }
    // Subtle living drift — gentle sway, kept small so the island stays centred
    const t = clock.elapsedTime
    camera.position.x = 18 + Math.sin(t * 0.08) * 0.9
    camera.position.z = 18 + Math.cos(t * 0.08) * 0.9
    camera.position.y = 28 + Math.sin(t * 0.05) * 0.5
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
      } catch (_) {}
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
// Per-stage ground palette: barren brown (0) → deep lush green (5)
const STAGE_GROUND = [
  { base: '#9c7a4e', light: '#b89868', dark: '#7a5c38', lip: '#6e5230' }, // 0 barren
  { base: '#a6a45a', light: '#c6c47e', dark: '#7e7a40', lip: '#7a7038' }, // 1 sprouting
  { base: '#7cc85e', light: '#b4e188', dark: '#5aa748', lip: '#4a9c38' }, // 2 greening
  { base: '#6cc24a', light: '#a6dd76', dark: '#479a38', lip: '#3f8f33' }, // 3 growing
  { base: '#5cb840', light: '#9bd86a', dark: '#3f8f33', lip: '#368a2e' }, // 4 thriving
  { base: '#4fae36', light: '#90d65f', dark: '#368a2e', lip: '#2f7e28' }, // 5 flourishing
]
function FloatingIsland({ stage, netWorthTier = 0 }) {
  const g = STAGE_GROUND[Math.max(0, Math.min(5, stage))]
  const groundTex = useMemo(() => makeGroundTexture(g.base, g.light, g.dark, stage + 1), [g, stage])
  return (
    <group>
      {/* Grassy top — painted texture (browns at low stages, greens as it grows) */}
      <mesh position={[0, 0.70, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8.3, 8.3, 0.50, 96]} />
        <meshToonMaterial map={groundTex} gradientMap={getToonGrad()}
          emissive={netWorthTier >= 4 ? '#1a0e00' : '#000'} emissiveIntensity={netWorthTier >= 4 ? 0.10 : 0} />
      </mesh>
      {/* Soft grassy lip overhanging the cliff */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[8.45, 8.55, 0.16, 96]} />
        <meshToonMaterial color={g.lip} gradientMap={getToonGrad()} />
      </mesh>
      {/* Warm earthy cliff strata */}
      {[{y:-0.32,t:8.55,b:7.3,h:2.0,c:'#b08350'},{y:-2.10,t:7.3,b:5.6,h:1.8,c:'#946a3c'},{y:-3.60,t:5.6,b:3.6,h:1.5,c:'#74512c'}]
        .map((cl, i) => (
          <mesh key={i} position={[0, cl.y, 0]}>
            <cylinderGeometry args={[cl.t, cl.b, cl.h, 48]} />
            <meshToonMaterial color={cl.c} gradientMap={getToonGrad()} />
          </mesh>
        ))}
      <mesh position={[0, -5.1, 0]}>
        <coneGeometry args={[3.6, 3.6, 32]} />
        <meshToonMaterial color="#5a3416" gradientMap={getToonGrad()} />
      </mesh>
    </group>
  )
}

// ─── Grass tufts — lush multi-tone clumps ─────────────────────────────────────
const GRASS_COUNT = 760
// Approx stream centreline z at a given x (matches STREAM_CTRL slope)
const streamZAt = () => 0   // river now runs straight across the middle (z = 0)
// Grass per stage: dead/dry & sparse at 0 → lush, dense, deep-green at 5.
const STAGE_GRASS = [
  { count: 150, h: [0.45, 0.85], tones: ['#a8905c', '#b89a64', '#9c8450', '#c2a86e', '#8f7a48'] }, // 0 dead/dry
  { count: 330, h: [0.55, 1.05], tones: ['#9cae54', '#aab864', '#8ca048', '#b6c270', '#7e9440'] }, // 1 drying green
  { count: 480, h: [0.65, 1.35], tones: ['#6ace4c', '#7ed85d', '#57bd3c', '#82d65f'] },           // 2 fresh
  { count: 600, h: [0.70, 1.45], tones: ['#57bd3c', '#6ace4c', '#4aa636', '#7ed85d'] },           // 3 green
  { count: 700, h: [0.70, 1.55], tones: ['#4aa636', '#57bd3c', '#3f9c33', '#6ace4c'] },           // 4 lush
  { count: 760, h: [0.72, 1.60], tones: ['#3f9c33', '#4aa636', '#57bd3c', '#349029'] },           // 5 deep
]
function GrassBlades({ stage, windStrength }) {
  const meshRef = useRef()
  const coloredStage = useRef(-1)
  const dummy  = useMemo(() => new THREE.Object3D(), [])
  const tmpCol = useMemo(() => new THREE.Color(), [])
  const cfg = STAGE_GRASS[Math.max(0, Math.min(5, stage))]
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
// Runs straight across the MIDDLE (z = 0) along the x-axis. Together with the
// path (x = 0) it forms a centred cross dividing the island into 4 quadrants.
// Tapered ends keep the water inside the fence (r 7.65).
const STREAM_CTRL = [
  new THREE.Vector3(-6.4, 0, 0),
  new THREE.Vector3(-4.3, 0, 0),
  new THREE.Vector3(-2.1, 0, 0),
  new THREE.Vector3( 0.0, 0, 0),   // bridge crossing — dead centre
  new THREE.Vector3( 2.1, 0, 0),
  new THREE.Vector3( 4.3, 0, 0),
  new THREE.Vector3( 6.4, 0, 0),
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
          <meshToonMaterial color="#f2ffff" gradientMap={getToonGrad()} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Stream() {
  // NB: island top surface sits at y≈0.95 — every layer must clear it or it's buried.
  const bankGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 3.0), [])
  const sandGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.5), [])
  const foamGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.34), [])
  const deepGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 1.5), [])
  const watGeo  = useMemo(() => makeRibbonGeo(STREAM_CTRL, 2.15), [])
  const coreGeo = useMemo(() => makeRibbonGeo(STREAM_CTRL, 0.95), [])

  return (
    <group>
      {/* Earthen bank — frames the channel, just above ground.
          NB: ribbon normals point down, so every layer needs DoubleSide. */}
      <mesh position={[0, 0.956, 0]} receiveShadow>
        <primitive object={bankGeo} attach="geometry" />
        <meshToonMaterial color="#5a3a1c" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* Sandy / pebbly shallows */}
      <mesh position={[0, 0.965, 0]} receiveShadow>
        <primitive object={sandGeo} attach="geometry" />
        <meshToonMaterial color="#d8c298" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* Deep channel — darker teal centre, gives the water depth */}
      <mesh position={[0, 0.971, 0]}>
        <primitive object={deepGeo} attach="geometry" />
        <meshToonMaterial color="#117a98" gradientMap={getToonGrad()} side={THREE.DoubleSide} />
      </mesh>
      {/* White foam rim at the water's edge */}
      <mesh position={[0, 0.974, 0]}>
        <primitive object={foamGeo} attach="geometry" />
        <meshToonMaterial color="#eafdff" gradientMap={getToonGrad()} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* Water surface — bright Hay Day turquoise (transparent so depth shows) */}
      <mesh position={[0, 0.981, 0]}>
        <primitive object={watGeo} attach="geometry" />
        <MeshDistortMaterial
          color="#2fc6dc" emissive="#0e8fb0" emissiveIntensity={0.38}
          roughness={0.10} metalness={0.20} transparent opacity={0.82}
          distort={0.16} speed={1.2} side={THREE.DoubleSide}
        />
      </mesh>
      {/* Brighter central current — sun glint + flow read */}
      <mesh position={[0, 0.988, 0]}>
        <primitive object={coreGeo} attach="geometry" />
        <MeshDistortMaterial
          color="#bdf1f8" emissive="#5cccde" emissiveIntensity={0.32}
          roughness={0.06} metalness={0.15} transparent opacity={0.55}
          distort={0.30} speed={1.9} side={THREE.DoubleSide}
        />
      </mesh>
      {/* Foam crescents where the water meets the bridge piers + bank rocks */}
      {[[-0.85,0.35],[0.88,-0.30],[-4.80,0.50],[4.90,-0.40],[-2.60,0.70],[2.80,-0.60]].map((p, i) => (
        <FoamTuft key={i} position={[p[0], 0.99, p[1]]} t0={i * 1.3} />
      ))}
      {/* Foam / ripple sparkle drifting along the water */}
      <Sparkles count={26} scale={[13, 0.3, 1.4]} position={[0, 1.04, 0]}
        size={1.4} speed={0.5} color="#eaffff" opacity={0.75} />
    </group>
  )
}

// ─── Stone bridge over the stream ─────────────────────────────────────────────
// Spans the stream at x=0, z≈-2.1. Bridge runs along Z axis (path direction).
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
      dummy.position.set(Math.cos(pa)*FENCE_R, 1.16, Math.sin(pa)*FENCE_R)
      dummy.rotation.set(0, -pa, 0); dummy.scale.set(1,1,1); dummy.updateMatrix()
      postRef.current.setMatrixAt(i, dummy.matrix)
      // Post cap
      dummy.position.set(Math.cos(pa)*FENCE_R, 1.47, Math.sin(pa)*FENCE_R)
      dummy.updateMatrix(); capRef.current.setMatrixAt(i, dummy.matrix)
      // Top rail
      dummy.position.set(Math.cos(ma)*FENCE_R, 1.32, Math.sin(ma)*FENCE_R)
      dummy.rotation.set(0, rr, 0); dummy.updateMatrix()
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
function Signpost({ name, progress, type = 'savings', icon, yOffset = 0, empty = false }) {
  const isInv  = type === 'investment'
  const done   = progress >= 100
  const ring   = done ? '#fbbf24' : isInv ? '#f59e0b' : '#22c55e'
  const accent = done ? '#fde68a' : isInv ? '#fcd34d' : '#86efac'
  const ic     = empty ? '+' : done ? '🏆' : (icon ?? (isInv ? '📈' : '🌱'))
  return (
    <group position={[0, 0.10, 1.28]}>
      {/* Slim grounding post */}
      <mesh position={[0, 0.40, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.80, 6]} />
        <meshToonMaterial color={isInv ? '#a8742a' : '#8a6a32'} gradientMap={getToonGrad()} />
      </mesh>
      {/* Compact floating marker — circular progress ring around the icon */}
      <Html position={[0, 1.06 + yOffset, 0]} center zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          fontFamily: 'Inter Variable, system-ui, sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        }}>
          {/* Progress ring (conic) wrapping the glossy icon chip. Empty plots are
              a dashed, muted "plant here" invitation — no ring fill, no %. */}
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', padding: '2.5px',
            background: empty ? 'transparent' : `conic-gradient(${ring} ${progress * 3.6}deg, rgba(255,255,255,0.30) 0deg)`,
            border: empty ? '1.5px dashed rgba(255,255,255,0.45)' : 'none',
            boxShadow: empty ? 'none' : '0 4px 10px rgba(0,0,0,0.40)',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: empty ? '15px' : '12px', fontWeight: 700,
              color: empty ? 'rgba(255,255,255,0.75)' : undefined,
              background: empty ? 'rgba(12,20,10,0.45)'
                        : isInv ? 'linear-gradient(135deg,#fde68a,#f59e0b)'
                                : 'linear-gradient(135deg,#bbf7d0,#34d399)',
              boxShadow: empty ? 'none' : 'inset 0 1px 2px rgba(255,255,255,0.55)',
            }}>{ic}</div>
          </div>
          {/* Tiny name + % tag (% hidden on empty invitations) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            background: 'rgba(12,20,10,0.80)', border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: '7px', padding: '1.5px 6px', whiteSpace: 'nowrap', backdropFilter: 'blur(3px)',
            opacity: empty ? 0.85 : 1,
          }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: empty ? 'rgba(255,255,255,0.8)' : '#fff', maxWidth: '64px',
              overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            {!empty && <span style={{ fontSize: '8.5px', fontWeight: 800, color: accent }}>{progress}%</span>}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ─── Interactive plot wrapper — hover pop + tap to open ───────────────────────
function InteractivePlot({ position, onSelect, children }) {
  const ref = useRef()
  const hover = useRef(false)
  useFrame(() => {
    if (!ref.current) return
    const target = hover.current ? 1.07 : 1.0
    const s = ref.current.scale.x + (target - ref.current.scale.x) * 0.18
    ref.current.scale.set(s, s, s)
  })
  const enter = (e) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer' }
  const leave = () => { hover.current = false; document.body.style.cursor = 'auto' }
  return (
    <group position={position} ref={ref}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect() } : undefined}
      onPointerOver={onSelect ? enter : undefined}
      onPointerOut={onSelect ? leave : undefined}>
      {children}
    </group>
  )
}

// ─── Empty plot — the "Add a goal" invitation ─────────────────────────────────
function EmptyPlot({ position, label = 'Add a goal', onSelect, signYOffset = 0 }) {
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
      <Signpost name={label} progress={0} type="savings" empty yOffset={signYOffset} />
    </InteractivePlot>
  )
}


// ─── Cemented accomplishment — a reached goal is set in stone ─────────────────
// A stone plinth + gold plaque ring the plot, so a completed goal reads as a
// permanent monument rather than an in-progress planting.
function CementedBase() {
  return (
    <group>
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
  )
}

// ─── Unified goal plot — one growing plant per goal, cemented when reached ────
function GoalSlot({ position, goal, onSelect, yOffset = 0 }) {
  const p = goalPct(goal), st = plantStage(p), done = p >= 100
  const isInv = goal.goal_type === 'investment'
  const nm = goal.name.length > 8 ? goal.name.slice(0, 8) + '…' : goal.name
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
      {done && <CementedBase />}
      {isInv ? <InvestPlant stage={st} /> : <SavingsPlant stage={st} />}
      <Signpost name={nm} progress={p} type={isInv ? 'investment' : 'savings'}
        icon={done ? '🏆' : goalIcon(goal.name, isInv ? 'investment' : 'savings')} yOffset={yOffset} />
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
function CloudShape({ position, scale = 1, dark = false, speed = 1 }) {
  const ref = useRef()
  const t0  = useMemo(() => Math.random()*100, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.x = position[0] + Math.sin((clock.elapsedTime+t0)*0.06*speed)*3
    ref.current.position.y = position[1] + Math.sin((clock.elapsedTime+t0)*0.04*speed)*0.4
  })
  return (
    <group ref={ref} scale={scale}>
      {[{p:[0,0,0],r:1.3},{p:[-1.1,-0.2,0],r:0.95},{p:[1.1,-0.2,0],r:1.05},{p:[-0.5,0.5,0],r:0.90},{p:[0.6,0.6,0],r:1.00}]
        .map((s,i) => (
          <mesh key={i} position={s.p}>
            <sphereGeometry args={[s.r,10,10]} />
            <meshToonMaterial color={dark?'#5e6c7c':'#cfdde6'} gradientMap={getToonGrad()} transparent opacity={dark?0.72:0.45} />
          </mesh>
        ))}
    </group>
  )
}

// ─── Rain ─────────────────────────────────────────────────────────────────────
const RAIN_POOL = Array.from({length:50}, () => ({
  x:(Math.random()-0.5)*28, y:Math.random()*18, z:(Math.random()-0.5)*28, speed:0.18+Math.random()*0.12,
}))
function RainSystem({ severity }) {
  const refs = useRef([]), count = Math.round(severity*50)
  useFrame(() => {
    refs.current.forEach(r => { if (!r) return; r.position.y -= r.userData.speed; r.position.x -= r.userData.speed*0.10; if (r.position.y < -6) r.position.y = 18 })
  })
  return (
    <>
      {RAIN_POOL.slice(0,count).map((d,i) => (
        <mesh key={i} ref={el=>{refs.current[i]=el;if(el)el.userData.speed=d.speed}} position={[d.x,d.y,d.z]} rotation={[0,0,0.12]}>
          <cylinderGeometry args={[0.014,0.014,0.33,4]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.38} />
        </mesh>
      ))}
    </>
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
          {[[-0.32,0.32],[-0.32,-0.32]].map(([x,z],j) => (
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
const SLOT_SIGN_OFFSET = [0, 0, 0.7, 0.7, 0, 0, 1.3, 1.3]


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
// Savings (front of stream) → green trees · Investments (back) → gold trees.
// Ordered most-prominent first so they fill in as the category grows.
// Savings orchard — a tight grove on the left rim, clear of every plot
const SAVINGS_ZONE_TREES = [
  { p: [-6.6, 0.95,  2.2], s: 0.85, r: 2.1 },
  { p: [-7.2, 0.95,  1.2], s: 0.90, r: 0.9 },
  { p: [-6.7, 0.95,  3.4], s: 0.95, r: 0.4 },
  { p: [-2.4, 0.95,  7.0], s: 0.80, r: 1.9 },
]
// Investment orchard — mirror grove on the right rim
const INVEST_ZONE_TREES = [
  { p: [ 6.6, 0.95,  2.2], s: 0.85, r: 2.1 },
  { p: [ 7.2, 0.95,  1.2], s: 0.90, r: 2.4 },
  { p: [ 6.7, 0.95,  3.4], s: 0.95, r: 0.4 },
  { p: [ 2.4, 0.95,  7.0], s: 0.80, r: 0.8 },
]
const SAVINGS_TONES = ['green', 'lime']  // variety within the green theme
const INVEST_TONES  = ['gold', 'orange'] // variety within the gold theme

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

// ─── Island group ─────────────────────────────────────────────────────────────
function IslandGroup({ goals, stage, weather, onSelectGoal, onAddGoal }) {
  const { darkClouds, windStrength, netWorthTier = 0,
          savingsTier = 0, investTier = 0 } = weather
  // Goals fill the quadrant slots in creation order (stable placement).
  const sortedGoals = [...goals].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  // Greenery, animals, and orchards all scale up with the plan stage.
  const bedCount    = stage < 2 ? 0 : stage < 4 ? 1 : FLOWER_BEDS.length
  const mushCount   = stage < 3 ? 0 : Math.min(2 + (netWorthTier >= 2 ? 2 : 0), MUSHROOM_DEFS.length)
  const birdCount   = stage < 2 ? 0 : (netWorthTier >= 4 ? 7 : netWorthTier >= 3 ? 5 : netWorthTier >= 2 ? 3 : 0)
  const savingsTreeCount = Math.min(2 + savingsTier, SAVINGS_ZONE_TREES.length)
  const investTreeCount  = Math.min(2 + investTier,  INVEST_ZONE_TREES.length)

  return (
    <group>
      <FloatingIsland stage={stage} netWorthTier={netWorthTier} />
      <GrassBlades stage={stage} windStrength={windStrength} />
      <Stream />
      <StreamDecor />
      <StreamBridge />
      <PathStones />
      <SceneRocks />
      <Fence />
      {LANTERN_POS.map((p, i) => <Lantern key={`ln${i}`} position={p} />)}

      {/* No zone labels — the garden is one growing landscape, not four labelled
          pillars. The four quadrants are goal plots (below). */}

      {/* Animals wander the lawns once the garden is thriving */}
      {stage >= 3 && <FarmLife />}

      {/* Goal plots fill all four quadrants in order — each goal plants a tree
          that grows with its progress and is cemented in stone once reached. The
          next free slot shows a single "Add a goal" invitation. */}
      {sortedGoals.slice(0, QUADRANT_SLOTS.length).map((g, i) => (
        <GoalSlot key={g.id} position={QUADRANT_SLOTS[i]} goal={g} yOffset={SLOT_SIGN_OFFSET[i]}
          onSelect={onSelectGoal ? () => onSelectGoal(g) : undefined} />
      ))}
      {sortedGoals.length < QUADRANT_SLOTS.length && (
        <EmptyPlot position={QUADRANT_SLOTS[sortedGoals.length]} onSelect={onAddGoal}
          signYOffset={SLOT_SIGN_OFFSET[sortedGoals.length]} />
      )}

      {/* Savings orchard (front) — green trees that grow with total savings */}
      {SAVINGS_ZONE_TREES.slice(0, savingsTreeCount).map((t, i) => (
        <LushTree key={`sv${i}`} position={t.p} scale={t.s} rotation={t.r}
          palette={savingsTier === 0 ? 'bare' : SAVINGS_TONES[i % SAVINGS_TONES.length]}
          fruit={savingsTier >= 3 && i % 3 === 0} />
      ))}
      {/* Investment orchard (back) — gold trees that grow with total investments */}
      {INVEST_ZONE_TREES.slice(0, investTreeCount).map((t, i) => (
        <LushTree key={`iv${i}`} position={t.p} scale={t.s} rotation={t.r}
          palette={investTier === 0 ? 'bare' : INVEST_TONES[i % INVEST_TONES.length]} />
      ))}
      {FLOWER_BEDS.slice(0, bedCount).map((p, i) => (
        <FlowerBed key={`fb${i}`} position={p} rotation={i * 0.8} windStrength={windStrength} />
      ))}
      {MUSHROOM_DEFS.slice(0, mushCount).map((m, i) => (
        <GltfToon key={i} url={m.url} position={m.p} rotation={[0, m.ry, 0]} scale={m.s} />
      ))}

      {birdCount > 0 && <Birds count={birdCount} />}

      {netWorthTier >= 3 && (
        <Sparkles count={24} scale={[10, 3, 10]} position={[0, 3.0, 0]}
          size={2.5} speed={0.18} color="#fbbf24" opacity={0.52} />
      )}
    </group>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ goals, debts, stage, weather, onSelectGoal, onAddGoal }) {
  const { cloudCount, darkClouds, hasDeficit, deficitSeverity, pollenCount, butterflyCount, netWorthTier = 0 } = weather
  return (
    <>
      <ResponsiveCamera />
      <color attach="background" args={[darkClouds ? '#1c262e' : TOD.bgColor]} />
      <hemisphereLight skyColor={TOD.skyTop} groundColor={TOD.skyGnd} intensity={TOD.ambInt} />
      <directionalLight
        position={TOD.sunPos}
        intensity={darkClouds ? TOD.sunInt * 0.4 : TOD.sunInt}
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
      <directionalLight position={[-8, 4, -10]} intensity={TOD.isNight ? 0.10 : 0.38} color="#b8d4ff" />
      {/* Stream glow — soft cool fill near the water (river runs along z = 0) */}
      <pointLight position={[0, 1.05, 0]} intensity={TOD.isNight ? 1.6 : 0.55} color="#5cc6f0" distance={9} decay={2.2} />
      {netWorthTier >= 2 && (
        <pointLight position={[3.6, 2.6, 3.4]} intensity={0.5 + netWorthTier*0.28} color="#f59e0b" distance={12} decay={2} />
      )}
      <fog attach="fog" args={[darkClouds ? '#1c262e' : TOD.isNight ? '#050d18' : '#0f2a30', 42, 115]} />

      <ContactShadows position={[0, 0.97, 0]} opacity={0.50} width={24} height={24} blur={2.2} far={4.5} color="#1a3808" />

      <Float speed={0.7} rotationIntensity={0.03} floatIntensity={0.55} floatingRange={[-0.12, 0.12]}>
        <IslandGroup goals={goals} stage={stage} weather={weather}
          onSelectGoal={onSelectGoal} onAddGoal={onAddGoal} />
      </Float>

      {stage >= 2 && (
        <Sparkles count={TOD.isNight ? 28 : 10} scale={[14, 6, 14]} position={[0, 1.8, 0]}
          size={TOD.isNight ? 3.5 : 2.2} speed={0.25}
          color={TOD.isNight ? '#fef08a' : '#c8f5a0'} opacity={TOD.isNight ? 0.80 : 0.42} />
      )}
      {pollenCount > 0 && (
        <Sparkles count={pollenCount} scale={[10, 4, 10]} position={[0, 2.0, 0]} size={1.5} speed={0.18} color="#fbbf24" opacity={0.42} />
      )}
      {BF_CONFIGS.slice(0, butterflyCount).map((b, i) => (
        <Butterfly key={i} startPos={b.start} colors={b.colors} t0={b.t0} />
      ))}
      {/* Decorative distant clouds — always present for sky depth */}
      <CloudShape position={[-23, 12, -15]} scale={1.5} dark={darkClouds} speed={0.5} />
      <CloudShape position={[ 22, 14, -18]} scale={1.2} dark={darkClouds} speed={0.6} />
      {cloudCount > 0 && (
        <>
          <CloudShape position={[-16, 10, -6]} scale={1.3} dark={darkClouds} speed={0.8} />
          {cloudCount > 1 && <CloudShape position={[14, 8, -10]} scale={1.1} dark={darkClouds} speed={1.2} />}
          {cloudCount > 2 && <CloudShape position={[-10, 12, 4]} scale={0.9} dark={darkClouds} speed={0.9} />}
          {cloudCount > 3 && <CloudShape position={[18, 9, 5]} scale={1.0} dark={darkClouds} speed={1.0} />}
        </>
      )}
      {hasDeficit && <RainSystem severity={deficitSeverity} />}
      {/* multisampling=0 — multisampled render targets flicker on mobile GLES
          (iOS Safari especially); the Canvas keeps antialias for edges */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.42} luminanceThreshold={0.60} luminanceSmoothing={0.85} mipmapBlur radius={0.66} />
        {/* Hay Day "candy" grade — lush saturation + gentle contrast */}
        <HueSaturation saturation={TOD.isNight ? 0.05 : 0.18} />
        <BrightnessContrast brightness={0.02} contrast={0.08} />
        <Vignette eskil={false} offset={0.26} darkness={TOD.isNight ? 0.80 : 0.40} />
      </EffectComposer>
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
      return (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #7ec8e3 0%, #a8dba8 60%, #79bd6a 100%)' }}>
          <div className="text-center text-white/90 drop-shadow">
            <div className="text-4xl mb-2">🌳</div>
            <div className="text-sm font-semibold">Your garden is resting</div>
            <div className="text-xs text-white/70 mt-1">3D view unavailable on this device</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
const Garden3D = memo(function Garden3D() {
  const { stage, weather, goals, debts } = useGarden()
  const navigate = useNavigate()
  const goToGoals = () => navigate('/plan#goals')
  return (
    <div className="w-full h-full">
      <GardenErrorBoundary>
        <Canvas
          orthographic
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance',
                toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: TOD.isNight ? 0.80 : 1.10 }}
          camera={{ position: [18, 28, 18], zoom: 21 }}
          onCreated={({ camera }) => { camera.lookAt(0, 0.5, 0); camera.updateProjectionMatrix() }}
        >
          <AdaptiveDpr pixelated />
          <PerformanceMonitor>
            <Suspense fallback={null}>
              <Scene goals={goals} debts={debts} stage={stage} weather={weather}
                onSelectGoal={goToGoals} onAddGoal={goToGoals} />
            </Suspense>
          </PerformanceMonitor>
        </Canvas>
      </GardenErrorBoundary>
    </div>
  )
})

export default Garden3D
