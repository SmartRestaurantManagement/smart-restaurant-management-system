'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Rotate3d, Sparkles, RefreshCw, Play, Pause, Compass } from 'lucide-react'

export function PlatterCraft() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scatter, setScatter] = useState<number>(0.3) // spice float scatter distance
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [activeSpice, setActiveSpice] = useState<string | null>(null)

  const scatterRef = useRef(scatter)
  const autoRotateRef = useRef(autoRotate)

  useEffect(() => {
    scatterRef.current = scatter
  }, [scatter])

  useEffect(() => {
    autoRotateRef.current = autoRotate
  }, [autoRotate])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // 1. Scene Setup
    const scene = new THREE.Scene()
    scene.background = null

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 3.5, 6)
    camera.lookAt(0, 0, 0)

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3)
    scene.add(ambientLight)

    // Warm key light
    const dirLight = new THREE.DirectionalLight(0xffecd2, 2.0)
    dirLight.position.set(5, 8, 5)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    scene.add(dirLight)

    // Cool fill light
    const fillLight = new THREE.DirectionalLight(0xcedeff, 0.8)
    fillLight.position.set(-5, 2, -3)
    scene.add(fillLight)

    // 5. Create Parent Platter Group
    const platterGroup = new THREE.Group()
    scene.add(platterGroup)

    // --- Geometries & Materials ---

    // Platter Ceramic Material (clay-white matte)
    const platterMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f3f0,
      roughness: 0.4,
      metalness: 0.1,
    })

    // Platter Rim Accent (terracotta gold glaze)
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xc1633f, // Terracotta
      roughness: 0.2,
      metalness: 0.7,
    })

    // Spices Materials
    const chilliMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.3 }) // Kashmiri Red
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5, side: THREE.DoubleSide }) // Mint Green
    const starMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 }) // Star Anise Brown
    const cardamomMat = new THREE.MeshStandardMaterial({ color: 0x8d9b4c, roughness: 0.6 }) // Cardamom Pod Green
    const cinnamonMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 }) // Cinnamon Brown

    // 5a. The Serving Platter Plate
    const plateGeo = new THREE.CylinderGeometry(1.8, 1.7, 0.08, 32)
    const plate = new THREE.Mesh(plateGeo, platterMaterial)
    plate.position.y = -0.04
    plate.receiveShadow = true
    plate.castShadow = true
    platterGroup.add(plate)

    const rimGeo = new THREE.TorusGeometry(1.8, 0.05, 12, 48)
    const rim = new THREE.Mesh(rimGeo, rimMaterial)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.02
    rim.castShadow = true
    platterGroup.add(rim)

    // 5b. Spice groups that float above the plate
    const chilliGroup = new THREE.Group()
    const leafGroup = new THREE.Group()
    const starGroup = new THREE.Group()
    const cardamomGroup = new THREE.Group()
    const cinnamonGroup = new THREE.Group()

    platterGroup.add(chilliGroup)
    platterGroup.add(leafGroup)
    platterGroup.add(starGroup)
    platterGroup.add(cardamomGroup)
    platterGroup.add(cinnamonGroup)

    // 1. Kashmiri Red Chilli (Curved Tube/Cone)
    const chilliCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.2, 0.1, 0.4),
      new THREE.Vector3(0.5, 0.0, 0.7),
      new THREE.Vector3(0.8, -0.15, 0.85)
    ])
    const chilliGeo = new THREE.TubeGeometry(chilliCurve, 20, 0.08, 8, false)
    const chilliMesh = new THREE.Mesh(chilliGeo, chilliMat)
    chilliMesh.castShadow = true
    chilliGroup.add(chilliMesh)
    chilliGroup.position.set(-0.8, 0.25, -0.6)

    // Chilli Stem
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 })
    const stem = new THREE.Mesh(stemGeo, stemMat)
    stem.position.set(-0.06, 0.05, -0.05)
    stem.rotation.z = 0.5
    chilliGroup.add(stem)

    // 2. Fresh Mint Leaves (flat curved double sided sheets)
    const leafShape = new THREE.SphereGeometry(0.25, 8, 8)
    leafShape.scale(1, 0.2, 1.8) // flat leaf look
    const leaf1 = new THREE.Mesh(leafShape, leafMat)
    leaf1.rotation.set(0.2, 0, 0.4)
    leaf1.castShadow = true
    leafGroup.add(leaf1)

    const leaf2 = new THREE.Mesh(leafShape, leafMat)
    leaf2.position.set(0.22, -0.05, 0.15)
    leaf2.rotation.set(-0.3, 0.8, -0.2)
    leaf2.castShadow = true
    leafGroup.add(leaf2)
    leafGroup.position.set(0.6, 0.2, 0.7)

    // 3. Star Anise (brown star pattern)
    // Make 8 points/petals from capsules
    const petalGeo = new THREE.CapsuleGeometry(0.045, 0.22, 4, 8)
    for (let i = 0; i < 8; i++) {
      const petal = new THREE.Mesh(petalGeo, starMat)
      const angle = (i / 8) * Math.PI * 2
      petal.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18)
      petal.rotation.y = -angle
      petal.rotation.x = Math.PI / 2
      petal.castShadow = true
      starGroup.add(petal)
    }
    const centerGeo = new THREE.SphereGeometry(0.08, 8, 8)
    const center = new THREE.Mesh(centerGeo, starMat)
    starGroup.add(center)
    starGroup.position.set(-0.9, 0.28, 0.5)

    // 4. Green Cardamom Pods (ellipsoids)
    const cardGeo = new THREE.SphereGeometry(0.12, 12, 12)
    cardGeo.scale(1.5, 1, 1) // elongated look
    const card1 = new THREE.Mesh(cardGeo, cardamomMat)
    card1.castShadow = true
    cardamomGroup.add(card1)

    const card2 = new THREE.Mesh(cardGeo, cardamomMat)
    card2.position.set(0.18, -0.05, -0.15)
    card2.rotation.set(0.4, 0.8, 0.1)
    card2.castShadow = true
    cardamomGroup.add(card2)
    cardamomGroup.position.set(0.7, 0.2, -0.7)

    // 5. Cinnamon Sticks (rolled hollow cylinders)
    const stickGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12, 1, true)
    const stick1 = new THREE.Mesh(stickGeo, cinnamonMat)
    stick1.rotation.set(Math.PI / 2, 0.4, 0.3)
    stick1.castShadow = true
    cinnamonGroup.add(stick1)

    const stick2 = new THREE.Mesh(stickGeo, cinnamonMat)
    stick2.position.set(0.12, -0.06, 0.1)
    stick2.rotation.set(Math.PI / 2, 0.25, 0.5)
    stick2.castShadow = true
    cinnamonGroup.add(stick2)
    cinnamonGroup.position.set(-0.1, 0.3, 0.1)

    // --- Interactive Mouse Dragging (Rotation) ---
    let isDragging = false
    let previousMousePosition = { x: 0, y: 0 }

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true
      previousMousePosition = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y,
      }

      platterGroup.rotation.y += deltaMove.x * 0.007
      platterGroup.rotation.x += deltaMove.y * 0.007
      // Clamp x rotation so platter doesn't flip completely upside down
      platterGroup.rotation.x = Math.max(0.1, Math.min(1.2, platterGroup.rotation.x))

      previousMousePosition = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      isDragging = false
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaMove = {
        x: e.touches[0].clientX - previousMousePosition.x,
        y: e.touches[0].clientY - previousMousePosition.y,
      }

      platterGroup.rotation.y += deltaMove.x * 0.007
      platterGroup.rotation.x += deltaMove.y * 0.007
      platterGroup.rotation.x = Math.max(0.1, Math.min(1.2, platterGroup.rotation.x))

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleMouseUp)

    // Raycaster for click identification of spices
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const spices = [
        { name: 'Kashmiri Red Chilli', group: chilliGroup },
        { name: 'Fresh Mint Leaves', group: leafGroup },
        { name: 'Star Anise', group: starGroup },
        { name: 'Green Cardamom', group: cardamomGroup },
        { name: 'Ceylon Cinnamon', group: cinnamonGroup },
      ]

      let hitSpice: string | null = null
      for (const spice of spices) {
        const intersects = raycaster.intersectObjects(spice.group.children, true)
        if (intersects.length > 0) {
          hitSpice = spice.name
          break
        }
      }

      setActiveSpice(hitSpice)
    }

    container.addEventListener('click', handleCanvasClick)

    // --- Animation loop ---
    let animId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)

      const time = clock.getElapsedTime()
      const sc = scatterRef.current

      // Make Spices float above platter dynamically based on scatter slider
      // Chilli bobbing
      chilliGroup.position.y = 0.22 + Math.sin(time * 1.5) * 0.08 + sc * 0.8
      chilliGroup.rotation.y = time * 0.15
      
      // Mint leaves bobbing
      leafGroup.position.y = 0.18 + Math.cos(time * 1.2) * 0.06 + sc * 0.7
      leafGroup.rotation.y = -time * 0.25

      // Star anise bobbing
      starGroup.position.y = 0.25 + Math.sin(time * 1.8 + 1) * 0.05 + sc * 0.9
      starGroup.rotation.z = time * 0.1

      // Cardamom bobbing
      cardamomGroup.position.y = 0.18 + Math.cos(time * 1.4) * 0.07 + sc * 0.6
      cardamomGroup.rotation.x = time * 0.2

      // Cinnamon sticks bobbing
      cinnamonGroup.position.y = 0.28 + Math.sin(time * 0.9 + 2) * 0.06 + sc * 0.5
      cinnamonGroup.rotation.y = time * 0.08

      // Plate rotation
      if (autoRotateRef.current && !isDragging) {
        platterGroup.rotation.y += 0.005
        platterGroup.rotation.x = 0.45 + Math.sin(time * 0.5) * 0.03
      }

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleMouseUp)
      container.removeEventListener('click', handleCanvasClick)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      scene.clear()
      renderer.dispose()
    }
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-charcoal/95 border border-moss/20 p-6 md:p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden text-neutral-100">
      
      {/* Background soft blur gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-moss/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-terracotta/5 blur-[120px] pointer-events-none" />

      {/* 3D Canvas Container */}
      <div className="lg:col-span-7 relative flex flex-col justify-center items-center bg-black/45 rounded-2xl border border-neutral-900 p-4">
        <div 
          ref={containerRef} 
          className="w-full h-[320px] sm:h-[400px] cursor-grab active:cursor-grabbing relative z-10"
        />

        <div className="absolute bottom-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-neutral-800 text-[10px] font-semibold text-moss-foreground backdrop-blur-md">
          <Rotate3d className="h-3.5 w-3.5 text-moss animate-spin-slow" />
          <span>Rotate platter. Click floating spices to inspect their culinary details.</span>
        </div>

        {activeSpice && (
          <div className="absolute top-4 left-4 bg-charcoal/95 text-neutral-200 border border-moss/30 p-4 rounded-2xl text-xs backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-3 max-w-[260px] z-20">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-moss text-[10px] mb-1.5">
              <Sparkles className="h-3 w-3" />
              <span>Spice Profile</span>
            </div>
            <p className="font-extrabold text-sm text-white">{activeSpice}</p>
            <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
              {activeSpice.includes('Chilli') && 'Kashmiri Red Chilli is famed for its vibrant crimson color and mild heat. We infuse it in our Chicken 65 marinade and Butter Chicken curry base for that authentic crimson glow.'}
              {activeSpice.includes('Mint') && 'Fresh Spearmint/Pudina leaves are washed in iced spring water to preserve their refreshing essential oils. Ground daily to create our fresh starters chutneys and biryani garnish.'}
              {activeSpice.includes('Anise') && 'Ceylon Star Anise adds deep, warm licorice-like aroma notes. Tossed whole into our boiling Vegetable Biryani rice pots to flavor the grain and long basmati texture.'}
              {activeSpice.includes('Cardamom') && 'Elaichi pods add a sweet, floral herbal finish. Ground fresh into our slow-cooked Dal Makhani and simmered into every morning batch of hot Masala Chai.'}
              {activeSpice.includes('Cinnamon') && 'True rolled bark cinnamon yields sweet woody undertones. We slow-roast it in oil to extract aroma for our rich, slow-braised Mutton Rogan Josh gravy.'}
            </p>
            <button 
              onClick={() => setActiveSpice(null)}
              className="mt-3 text-[10px] text-moss hover:text-moss-foreground font-bold underline transition-colors"
            >
              Close Profile
            </button>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="lg:col-span-5 space-y-6 relative z-10">
        <div className="space-y-2">
          <span className="text-moss font-extrabold text-xs uppercase tracking-widest flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5" />
            Culinary Craft
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            The Spice Calibration Platter
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Interact with the five whole spices that form the aromatic signature of Kaizen. Elevate or disperse the spices to examine flavor layers.
          </p>
        </div>

        {/* Scatter range input */}
        <div className="space-y-3 bg-black/45 p-5 rounded-2xl border border-neutral-900">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">Spice Scatter Height</span>
            <span className="font-semibold text-moss">{Math.round(scatter * 100)}% Float</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={scatter}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setScatter(val)
              if (val > 0.05) setAutoRotate(false)
            }}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-moss my-3 focus:outline-none focus:ring-1 focus:ring-moss"
          />
          <div className="flex justify-between text-[10px] text-neutral-500 font-medium pt-1">
            <span>Resting on Plate</span>
            <span>Scattered Aroma</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setScatter(scatter === 0 ? 0.75 : 0)}
            className="flex-1 bg-terracotta hover:bg-terracotta/90 text-white rounded-xl font-bold text-xs py-5 cursor-pointer shadow-md transition-all active:scale-98 border border-terracotta/20"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {scatter === 0 ? 'Scatter Spices' : 'Rest Spices'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setAutoRotate(!autoRotate)}
            className="bg-black/20 border-neutral-800 text-white hover:bg-black/40 hover:text-white rounded-xl font-semibold text-xs py-5 cursor-pointer"
          >
            {autoRotate ? (
              <>
                <Pause className="mr-1.5 h-3.5 w-3.5 text-moss" />
                Stop Rotation
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                Auto Rotate
              </>
            )}
          </Button>
        </div>

        {/* Aromatic Profile Table */}
        <div className="grid grid-cols-2 gap-3 text-[10px] border-t border-neutral-900 pt-5">
          <div className="bg-black/25 p-3 rounded-xl border border-neutral-950">
            <span className="font-extrabold text-moss block uppercase mb-1">Aroma Profile</span>
            <span className="text-white font-bold text-sm">Rich & Herbal</span>
          </div>
          <div className="bg-black/25 p-3 rounded-xl border border-neutral-950">
            <span className="font-extrabold text-moss block uppercase mb-1">Extraction Style</span>
            <span className="text-white font-bold text-sm">Slow-roasted Oil</span>
          </div>
          <div className="bg-black/25 p-3 rounded-xl border border-neutral-950">
            <span className="font-extrabold text-moss block uppercase mb-1">Ingredient Sourcing</span>
            <span className="text-white font-bold text-sm">100% Organic</span>
          </div>
          <div className="bg-black/25 p-3 rounded-xl border border-neutral-950">
            <span className="font-extrabold text-moss block uppercase mb-1">Aroma Calibration</span>
            <span className="text-white font-bold text-sm">Live & Synced</span>
          </div>
        </div>
      </div>
    </div>
  )
}
