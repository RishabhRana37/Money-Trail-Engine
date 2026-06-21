import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

import dashboardScreenshot from '../assets/dashboard_screenshot.png';
import graphScreenshot from '../assets/graph_screenshot.png';
import loginScreenshot from '../assets/login_screenshot.png';

gsap.registerPlugin(ScrollTrigger);

/* ── MOCK DATA FOR TACTICAL TARGETS ─────────────────────────────────────── */
const TARGETS_DATA = [
  { id: 'TGT-A01', name: 'OP RADIANT FALCON', type: 'Vessel', lat: 0.26, lon: 1.00, status: 'FIX', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0042', name: 'Quikfix Traders', type: 'Shell Comp.', lat: 0.50, lon: 1.35, status: 'ENGAGE', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0118', name: 'Neel Sharma', type: 'Mule Node', lat: 0.48, lon: 1.36, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'TGT-I05', name: '#0a196b / SA-5', type: 'IADS', lat: 0.55, lon: 0.80, status: 'ENGAGE', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'TGT-V12', name: 'CONTAINER VESSEL ALPHA', type: 'Vessel', lat: -0.10, lon: 1.20, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0091', name: 'Maya Holdings', type: 'Business Mule', lat: 0.70, lon: -1.30, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
];

/* ── GLSL SHADER SOURCES FOR VOLUMETRIC SPHERE ──────────────────────────── */
const sphereVertexShader = `
  uniform float uTime;
  uniform float uScroll;
  uniform float uMouseSpeed;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;

  void main() {
    vNormal = normal;
    vPosition = position;
    
    // Wave coordinate setup based on scroll
    float scrollScale = 1.0 + uScroll * 1.5;
    vec3 coord = position * scrollScale;
    float timeFactor = uTime * 1.2 + uScroll * 2.5;
    
    // Stable, gorgeous sinusoidal displacement
    float noiseVal = sin(coord.x + timeFactor) * cos(coord.y + timeFactor) +
                     sin(coord.y * 1.5 - timeFactor) * cos(coord.z * 1.2 + timeFactor) +
                     sin(coord.z * 2.0 + timeFactor) * cos(coord.x * 1.8 - timeFactor);
    noiseVal = noiseVal * 0.35;
    vNoise = noiseVal;
    
    // Displace vertices to morph volumetric sphere organically
    float displacement = noiseVal * (0.24 + uMouseSpeed * 0.15 + uScroll * 0.1);
    vec3 displacedPosition = position + normal * displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const sphereFragmentShader = `
  uniform vec3 uColorLow;
  uniform vec3 uColorHigh;
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;

  void main() {
    // Gradient mix based on noise value
    vec3 color = mix(uColorLow, uColorHigh, vNoise * 0.5 + 0.5);
    
    // Add glowing atmosphere rim (Fresnel reflection)
    vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0));
    float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 3.5);
    
    // Pulse glow based on time
    vec3 glowColor = mix(vec3(0.0, 0.9, 1.0), vec3(0.88, 0.29, 0.29), uScroll);
    color += glowColor * fresnel * (0.8 + 0.2 * sin(uTime * 1.5));
    
    gl_FragColor = vec4(color, 0.85);
  }
`;

/* ── WEBGL 3D CANVAS COMPONENT ──────────────────────────────────────────── */
function ThreeCanvas({ selectedTarget }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sphereRef = useRef(null);
  const particlesRef = useRef(null);
  const mouseSpeedRef = useRef(0);
  const prevMousePosRef = useRef({ x: 0.5, y: 0.5 });

  const scrollRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Listen to scroll progress locally
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      scrollRef.current = progress;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Listen to mouse movements locally
    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight
      };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Create scene, camera, renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00E5FF, 1.2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Create Volumetric Liquid Sphere
    const geometry = new THREE.SphereGeometry(1.8, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uMouseSpeed: { value: 0 },
        uColorLow: { value: new THREE.Color(0x00E5FF) }, // cyber cyan
        uColorHigh: { value: new THREE.Color(0x10141D) }, // dark backdrop
      }
    });

    const sphere = new THREE.Mesh(geometry, material);
    // Shift position to right side
    sphere.position.x = 2.0;
    scene.add(sphere);
    sphereRef.current = sphere;

    // Create Interactive 3D Particle Cloud
    const particleCount = 1200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(0x00E5FF);
    const secondaryColor = new THREE.Color(0xE24B4A);

    for (let i = 0; i < particleCount; i++) {
      // Scatter in a sphere around the mesh
      const radius = 2.2 + Math.random() * 3.5;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x + 2.0;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x + 2.0;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;

      // Color mix based on position
      const mixedColor = baseColor.clone().lerp(secondaryColor, Math.random() * 0.35);
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circular glowing particle map
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(0, 229, 255, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);

    const particleTexture = new THREE.CanvasTexture(canvas);
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.12,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // Handle resizing
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    const clock = new THREE.Clock();
    let animId;

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      const currentScroll = scrollRef.current;
      const currentMouse = mouseRef.current;

      // 1. Update Volumetric Shader uniform parameters
      if (sphere.material.uniforms) {
        sphere.material.uniforms.uTime.value = elapsedTime;
        sphere.material.uniforms.uScroll.value = currentScroll;
        
        // Calculate mouse movement speed for organic displacement
        const dx = currentMouse.x - prevMousePosRef.current.x;
        const dy = currentMouse.y - prevMousePosRef.current.y;
        const speed = Math.sqrt(dx*dx + dy*dy) * 20;
        mouseSpeedRef.current = mouseSpeedRef.current * 0.95 + speed * 0.05;
        sphere.material.uniforms.uMouseSpeed.value = Math.min(mouseSpeedRef.current, 1.5);
        prevMousePosRef.current = { ...currentMouse };
      }

      // Rotate sphere slowly
      sphere.rotation.y = elapsedTime * 0.08 + currentScroll * Math.PI * 0.6;
      sphere.rotation.x = elapsedTime * 0.04;

      // 2. Animate 3D Particles + Interactive Fluid Displacement
      const posAttr = particles.geometry.attributes.position;
      const posArray = posAttr.array;

      // Project 2D mouse position to WebGL normalized 3D space
      const mouse3D = new THREE.Vector3(
        (currentMouse.x * 2 - 1) * 4,
        -(currentMouse.y * 2 - 1) * 3,
        0
      );

      for (let i = 0; i < particleCount; i++) {
        const xIdx = i * 3;
        const yIdx = i * 3 + 1;
        const zIdx = i * 3 + 2;

        let px = posArray[xIdx];
        let py = posArray[yIdx];
        let pz = posArray[zIdx];

        const ox = originalPositions[xIdx];
        const oy = originalPositions[yIdx];
        const oz = originalPositions[zIdx];

        // Wave turbulence
        const turbX = Math.sin(elapsedTime * 0.5 + oy) * 0.003;
        const turbY = Math.cos(elapsedTime * 0.5 + ox) * 0.003;

        // Push away from cursor if close (Interactive Fluid effect)
        const dx = px - mouse3D.x;
        const dy = py - mouse3D.y;
        const dz = pz - mouse3D.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < 1.8) {
          const pushForce = (1.8 - dist) * 0.04;
          velocities[xIdx] += (dx / dist) * pushForce;
          velocities[yIdx] += (dy / dist) * pushForce;
          velocities[zIdx] += (dz / dist) * pushForce;
        }

        // Return force towards original positions (spring physics)
        const rx = ox - px;
        const ry = oy - py;
        const rz = oz - pz;
        velocities[xIdx] += rx * 0.015;
        velocities[yIdx] += ry * 0.015;
        velocities[zIdx] += rz * 0.015;

        // Apply friction
        velocities[xIdx] *= 0.94;
        velocities[yIdx] *= 0.94;
        velocities[zIdx] *= 0.94;

        // Apply velocity to position
        posArray[xIdx] += velocities[xIdx] + turbX;
        posArray[yIdx] += velocities[yIdx] + turbY;
        posArray[zIdx] += velocities[zIdx];
      }

      posAttr.needsUpdate = true;

      // Adjust camera and sphere positioning based on scroll progress
      // Zoom and slide components visually
      camera.position.z = 8.0 - currentScroll * 2.8;
      
      const targetSphereX = 2.0 - currentScroll * 3.5;
      const targetSphereY = -currentScroll * 1.5;
      sphere.position.x = sphere.position.x * 0.92 + targetSphereX * 0.08;
      sphere.position.y = sphere.position.y * 0.92 + targetSphereY * 0.08;
      particles.position.x = sphere.position.x;
      particles.position.y = sphere.position.y;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0" />;
}

/* ── WEBGL DISTORTION IMAGE REVEAL COMPONENT ───────────────────────────── */
function WebGLImageReveal({ src, title, description, badge }) {
  const canvasContainerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  
  const hoverRef = useRef(hovered);
  const revealRef = useRef(revealed);
  
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    revealRef.current = revealed;
  }, [revealed]);

  const revealProgressRef = useRef(0);
  const hoverProgressRef = useRef(0);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    // Load texture
    const textureLoader = new THREE.TextureLoader();
    let texture;
    
    // WebGL scene inside the card slot
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Custom wave reveal and ripple fragment shader
    const vertex = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragment = `
      uniform sampler2D uTexture;
      uniform float uProgress;
      uniform float uHover;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        
        // Fluid wave ripples on hover
        float waveX = sin(uv.y * 12.0 + uTime * 2.5) * 0.02 * uHover;
        float waveY = cos(uv.x * 12.0 + uTime * 2.5) * 0.02 * uHover;
        
        // Reveals bottom to top using custom sweep
        float sweep = smoothstep(0.0, 0.18, uProgress - (1.0 - uv.y) * 0.82);
        
        vec2 distortedUv = vec2(
          uv.x + waveX * sweep,
          uv.y + waveY * sweep
        );
        
        // Ripple ripple distortion during reveal phase
        distortedUv.y += sin(uv.x * 15.0 + uTime * 3.5) * 0.04 * (1.0 - uProgress) * sweep;
        
        // Keep in bounds
        distortedUv = clamp(distortedUv, 0.0, 1.0);
        
        vec4 texColor = texture2D(uTexture, distortedUv);
        
        // Volumetric lighting border highlight
        float borderGlow = smoothstep(0.01, 0.0, abs(uv.x - 0.5) - 0.495) + 
                            smoothstep(0.01, 0.0, abs(uv.y - 0.5) - 0.495);
        
        vec3 finalColor = mix(texColor.rgb, vec3(0.0, 0.9, 1.0), borderGlow * uHover * 0.5);
        
        gl_FragColor = vec4(finalColor, texColor.a * sweep);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      uniforms: {
        uTexture: { value: new THREE.Texture() },
        uProgress: { value: 0 },
        uHover: { value: 0 },
        uTime: { value: 0 }
      }
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    scene.add(mesh);

    textureLoader.load(src, (loadedTexture) => {
      texture = loadedTexture;
      mat.uniforms.uTexture.value = loadedTexture;
      mat.needsUpdate = true;
    });

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Reveal trigger using IntersectionObserver
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setRevealed(true);
      }
    }, { threshold: 0.15 });
    observer.observe(container);

    // Anim loop
    const clock = new THREE.Clock();
    let animId;

    const tick = () => {
      const elapsed = clock.getElapsedTime();
      mat.uniforms.uTime.value = elapsed;

      // Lerp uniforms towards targets
      const targetReveal = revealRef.current ? 1.0 : 0.0;
      const targetHover = hoverRef.current ? 1.0 : 0.0;

      revealProgressRef.current = THREE.MathUtils.lerp(revealProgressRef.current, targetReveal, 0.08);
      hoverProgressRef.current = THREE.MathUtils.lerp(hoverProgressRef.current, targetHover, 0.12);

      mat.uniforms.uProgress.value = revealProgressRef.current;
      mat.uniforms.uHover.value = hoverProgressRef.current;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      mesh.geometry.dispose();
      mat.dispose();
      if (texture) texture.dispose();
    };
  }, [src]);

  return (
    <div 
      className="glass-panel rounded-xl overflow-hidden border border-white/5 flex flex-col h-full pointer-events-auto transform hover:-translate-y-2 duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div 
        ref={canvasContainerRef} 
        className="w-full h-56 bg-black/40 relative overflow-hidden" 
      />
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] text-cyan-400 tracking-widest uppercase">// {badge}</span>
            <span className="text-[10px] text-slate-500 font-mono">2026.06_R1</span>
          </div>
          <h4 className="text-lg font-bold text-white tracking-tight">{title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-light">{description}</p>
        </div>
        <div className="pt-2 flex items-center text-cyan-400 font-mono text-[10px] gap-1 group cursor-pointer font-bold">
          <span>DISCOVER PORTAL MODULE</span>
          <span className="group-hover:translate-x-1 duration-200">➔</span>
        </div>
      </div>
    </div>
  );
}

/* ── INTERACTIVE GLASS TEXT EFFECT (AURA HERO) — PREMIUM REWRITE ─────────── */
function AuraTextEffect() {
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef(null);
  const offRef   = useRef(null);   // off-screen canvas for compositing
  const hoverRef = useRef(false);
  const rafRef   = useRef(null);
  const containerRef = useRef(null);

  // Keep hoverRef in sync without triggering re-renders inside rAF
  useEffect(() => { hoverRef.current = isHovered; }, [isHovered]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Off-screen canvas used for glow-shadow compositing
    const off = document.createElement('canvas');
    offRef.current = off;

    /* ── RESIZE ─────────────────────────────────────────── */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width  = rect.width  + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);
      off.width  = rect.width;
      off.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    /* ── FONT METRICS ────────────────────────────────────── */
    const getMetrics = () => {
      const W = canvas.width  / (Math.min(window.devicePixelRatio || 1, 2));
      const H = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
      const fs = Math.round(W * 0.235);           // ~23.5% of width → big letters
      return { W, H, fs };
    };

    /* ── PARTICLE SYSTEM ─────────────────────────────────── */
    const PRISMATIC = [
      [0,   240, 255],   // cyan
      [226,  75,  74],   // magenta / red
      [ 63, 185,  80],   // emerald green
      [147,  51, 234],   // deep violet
      [255, 200,  50],   // warm gold flare
    ];

    class Mote {
      constructor(W, H) {
        // Spawn anywhere across the full text band (vertical center ±30%)
        this.x   = W * 0.05 + Math.random() * W * 0.90;
        this.y   = H * 0.3  + Math.random() * H * 0.45;
        this.vx  = (Math.random() - 0.5) * 0.5;
        this.vy  = -(0.3 + Math.random() * 0.9);
        this.r   = 0.6 + Math.random() * 1.8;
        this.a   = 0.12 + Math.random() * 0.55;
        this.dec = 0.003 + Math.random() * 0.009;
        const c  = PRISMATIC[Math.floor(Math.random() * PRISMATIC.length)];
        this.rgb = `${c[0]},${c[1]},${c[2]}`;
      }
      tick(spd) {
        this.x  += this.vx * spd;
        this.y  += this.vy * spd;
        this.a  -= this.dec * spd;
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.rgb},${Math.max(0, this.a)})`;
        ctx.fill();
      }
    }

    let motes = [];

    /* ── ANIMATION STATE ─────────────────────────────────── */
    let t     = 0;          // global time in seconds
    let lerpH = 0;          // smooth hover 0→1
    let last  = performance.now();

    /* ── DRAW PASS ───────────────────────────────────────── */
    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t   += dt;

      const { W, H, fs } = getMetrics();
      lerpH = lerpH + ((hoverRef.current ? 1 : 0) - lerpH) * 0.07;

      ctx.clearRect(0, 0, W, H);

      /* ── Font string (shared) ── */
      const FONT = `bold ${fs}px 'Inter', 'Outfit', 'Arial', sans-serif`;
      const cx   = W / 2;
      const cy   = H / 2 + fs * 0.08;   // slight downward nudge

      /* ── 1. DEEP GREEN LIGHT SHADOW (background glow pool) ── */
      const shadowBlur = 55 + lerpH * 30;
      ctx.save();
      ctx.filter    = `blur(${shadowBlur}px)`;
      ctx.globalAlpha = 0.55 + lerpH * 0.3;
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = '#013a1e';
      ctx.fillText('AURA', cx, cy + 14);
      ctx.restore();

      /* ── 2. SECONDARY GLOW (teal halo) ── */
      ctx.save();
      ctx.filter      = `blur(${18 + lerpH * 12}px)`;
      ctx.globalAlpha = 0.28 + lerpH * 0.22;
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = '#00c9a7';
      ctx.fillText('AURA', cx, cy + 4);
      ctx.restore();

      /* ── 3. CHROMATIC ABERRATION ── */
      const aberration = (2.8 + lerpH * 4.2);   // px spread

      // MAGENTA left-shifted
      ctx.save();
      ctx.globalAlpha = 0.60 + lerpH * 0.35;
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      const mgGrad = ctx.createLinearGradient(cx - W * 0.4, 0, cx + W * 0.4, 0);
      mgGrad.addColorStop(0,   'rgba(236, 72, 153, 0.95)');
      mgGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.6)');
      mgGrad.addColorStop(1,   'rgba(59, 130, 246, 0.1)');
      ctx.fillStyle = mgGrad;
      ctx.fillText('AURA', cx - aberration, cy - 0.8);
      ctx.restore();

      // CYAN right-shifted
      ctx.save();
      ctx.globalAlpha = 0.60 + lerpH * 0.35;
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      const cyGrad = ctx.createLinearGradient(cx - W * 0.4, 0, cx + W * 0.4, 0);
      cyGrad.addColorStop(0,   'rgba(0, 240, 255, 0.1)');
      cyGrad.addColorStop(0.5, 'rgba(0, 200, 255, 0.7)');
      cyGrad.addColorStop(1,   'rgba(99, 102, 241, 0.9)');
      ctx.fillStyle = cyGrad;
      ctx.fillText('AURA', cx + aberration, cy + 0.8);
      ctx.restore();

      // DEEP BLUE bottom-shifted (third aberration axis)
      ctx.save();
      ctx.globalAlpha = 0.30 + lerpH * 0.20;
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = 'rgba(30, 60, 220, 0.6)';
      ctx.fillText('AURA', cx + aberration * 0.5, cy + aberration * 0.7);
      ctx.restore();

      /* ── 4. CORE EMERALD-TO-TEAL GRADIENT (internal pulse) ── */
      const pulseSpeed = 0.5 + lerpH * 1.4;
      const pulse      = Math.sin(t * pulseSpeed) * 0.5 + 0.5;   // 0→1

      // animated gradient stops mimic internal light ripple
      const g0r = Math.round(5   + pulse * 10);
      const g0g = Math.round(150 + pulse * 30);
      const g0b = Math.round(105 + pulse * 60);

      const g1r = Math.round(13  + pulse * 40);
      const g1g = Math.round(148 + pulse * 10);
      const g1b = Math.round(136 + pulse * 80);

      const g2r = Math.round(8   + pulse * 80);
      const g2g = Math.round(145 + pulse * 20);
      const g2b = Math.round(178 + pulse * 30);

      const coreGrad = ctx.createLinearGradient(
        cx - W * 0.38, cy - fs * 0.5,
        cx + W * 0.38, cy + fs * 0.5
      );
      coreGrad.addColorStop(0,    `rgb(${g0r},${g0g},${g0b})`);
      coreGrad.addColorStop(0.42, `rgb(${g1r},${g1g},${g1b})`);
      coreGrad.addColorStop(0.72 + pulse * 0.08, `rgba(80,220,210,${0.7 + pulse*0.2})`);
      coreGrad.addColorStop(1,    `rgb(${g2r},${g2g},${g2b})`);

      ctx.save();
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = coreGrad;
      ctx.fillText('AURA', cx, cy);
      ctx.restore();

      /* ── 5. FACETED MINERAL TEXTURE OVERLAY ── */
      // Draw a clipping mask of the text, then stroke a diamond grid inside it
      ctx.save();
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      // Re-use text as a clip region
      ctx.globalCompositeOperation = 'source-atop';

      // Draw facet lines tiled across the text area
      const facetSize = fs * 0.22;
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + pulse * 0.04})`;
      ctx.lineWidth   = 0.7;
      ctx.beginPath();
      for (let fx = cx - W * 0.45; fx < cx + W * 0.45; fx += facetSize) {
        for (let fy = cy - fs * 0.65; fy < cy + fs * 0.65; fy += facetSize) {
          const hf = facetSize / 2;
          ctx.moveTo(fx,      fy);
          ctx.lineTo(fx + hf, fy + hf);
          ctx.lineTo(fx + facetSize, fy);
          ctx.moveTo(fx,      fy);
          ctx.lineTo(fx + hf, fy - hf * 0.5);
        }
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      /* ── 6. SPECULAR HIGHLIGHT / BEVEL EDGE ── */
      // Thin bright top-edge highlight — simulate bevelled glass edge
      ctx.save();
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + lerpH * 0.35})`;
      ctx.lineWidth   = 1.2 + lerpH * 0.8;
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeText('AURA', cx, cy);
      ctx.restore();

      // Intense teal outline edge
      ctx.save();
      ctx.font        = FONT;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = `rgba(0,${Math.round(200 + pulse * 55)},255,${0.45 + lerpH * 0.45})`;
      ctx.lineWidth   = 2.2 + lerpH * 1.8;
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeText('AURA', cx + aberration * 0.15, cy - 0.4);
      ctx.restore();

      /* ── 7. PRISMATIC DUST MOTES ── */
      const spd   = 0.9 + lerpH * 0.7;
      const spawn = hoverRef.current ? 0.50 : 0.14;
      if (Math.random() < spawn) motes.push(new Mote(W, H));
      motes = motes.filter(m => m.a > 0);
      motes.forEach(m => { m.tick(spd); m.draw(ctx); });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);   // single mount — hoverRef keeps state live

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full max-w-5xl mx-auto pointer-events-auto select-none cursor-pointer"
      style={{ height: '240px' }}
    >
      {/* Deep background prismatic radial glow pool */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
          isHovered ? 'opacity-100' : 'opacity-50'
        }`}
        style={{
          background: isHovered
            ? 'radial-gradient(ellipse 75% 55% at 50% 60%, rgba(6,182,100,0.18) 0%, rgba(6,182,212,0.10) 45%, rgba(99,51,200,0.07) 70%, transparent 100%)'
            : 'radial-gradient(ellipse 65% 45% at 50% 60%, rgba(6,182,100,0.10) 0%, rgba(6,182,212,0.05) 50%, transparent 100%)',
        }}
      />

      {/* Main rendering canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

/* ── MAIN LANDING PAGE ──────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [selectedTarget, setSelectedTarget] = useState(TARGETS_DATA[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeStr, setTimeStr] = useState('');

  // Lenis scroll initialization
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync Lenis scroll with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    return () => {
      lenis.destroy();
    };
  }, []);

  // System time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toISOString().substring(11, 19));
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  // GSAP Entrance reveals and scroll-linked opacity animations
  useEffect(() => {
    // 1. HUD overlay fade out on scroll
    gsap.to('.hud-overlay', {
      opacity: 0,
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: '+=15%',
        scrub: true,
        onUpdate: (self) => {
          const overlay = document.querySelector('.hud-overlay');
          if (overlay) {
            overlay.style.visibility = self.progress >= 0.99 ? 'hidden' : 'visible';
          }
        }
      }
    });

    // 2. Main content fade in on scroll
    gsap.to('.main-content-scroll', {
      opacity: 1,
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: '+=20%',
        scrub: true,
        onUpdate: (self) => {
          const content = document.querySelector('.main-content-scroll');
          if (content) {
            content.style.pointerEvents = self.progress > 0.4 ? 'auto' : 'none';
          }
        }
      }
    });

    // 3. Split text reveal timelines
    const headings = document.querySelectorAll('.reveal-text');
    headings.forEach(el => {
      gsap.to(el.querySelectorAll('.reveal-word'), {
        translateY: 0,
        stagger: 0.08,
        duration: 1.2,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        }
      });
    });

    // 4. Parallax panels
    gsap.fromTo('.parallax-panel', 
      { translateY: 40 },
      { 
        translateY: -40,
        scrollTrigger: {
          trigger: '.parallax-panel',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      }
    );

    // 5. Sync HUD mouse coordinates directly without React state re-renders
    const handleHUDMouseMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      const latEl = document.getElementById('hud-lat-angle');
      const lonEl = document.getElementById('hud-lon-angle');
      if (latEl) latEl.textContent = `LAT_ANGLE: ${(y * 180 - 90).toFixed(2)}°`;
      if (lonEl) lonEl.textContent = `LON_ANGLE: ${(x * 360 - 180).toFixed(2)}°`;
    };
    window.addEventListener('mousemove', handleHUDMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleHUDMouseMove);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  const filteredTargets = TARGETS_DATA.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Play custom local audio feedback cleanly
  const playClickSound = () => {
    try {
      const audio = new Audio('/click.mp3');
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Audio playback failed or was blocked by browser:', err);
      });
    } catch (e) {
      console.error('Audio initialization failed:', e);
    }
  };

  // Trigger imploding visual effect on authenticate click
  const handleAuthenticate = () => {
    // Zoom camera in (handled by temporary transition before navigating)
    gsap.to(window, {
      duration: 0.8,
      scrollTo: 0,
      onComplete: () => {
        navigate('/login');
      }
    });
  };

  // Relocated Get Started button click handler
  const handleGetStarted = () => {
    playClickSound();
    handleAuthenticate();
  };

  return (
    <div className="relative min-h-[280vh] text-slate-300 font-sans select-none overflow-x-hidden bg-[#07090D] lenis-smooth">
      {/* 3D WebGL Scene backdrop */}
      <ThreeCanvas 
        selectedTarget={selectedTarget}
      />

      {/* ── STICKY TOP TELEMETRY BAR (Nav) ── */}
      <header className="fixed top-0 left-0 w-full z-40 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md pointer-events-auto">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 401 494" fill="none" className="animate-pulse">
            <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF"/>
          </svg>
          <span className="font-mono text-sm font-bold tracking-[0.25em] text-white">AURA</span>
          <div className="h-4 w-px bg-white/10 mx-2 hidden sm:block" />
          <span className="hidden sm:inline font-mono text-[9px] text-slate-500 uppercase tracking-widest">// TARGET GATEWAY</span>
        </div>

        <div className="flex items-center gap-6">
          <span className="font-mono text-[10px] text-cyan-400/50 tracking-wider hidden md:block">
            // COORDINATE_NODE: {timeStr} Z [DEL: 28.61° N, 77.20° E]
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="System Menu"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* ── SCREEN 1: GOTHAM HUD OVERLAY (Fades out on scroll) ── */}
      <div 
        className="fixed inset-0 z-10 flex flex-col justify-between pt-24 pb-6 pointer-events-none hud-overlay"
        style={{ opacity: 1, visibility: 'visible' }}
      >
        {/* Middle contents: Sidebar & coordinates legend */}
        <div className="flex-1 flex overflow-hidden px-8 py-2 justify-between items-stretch">
          
          {/* Relocated Primary Action Area */}
          <div className="w-80 flex flex-col justify-center items-start pointer-events-auto select-none">
            <button
              onClick={handleGetStarted}
              className="group flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.2em] px-8 py-4 border border-cyan-400/50 text-cyan-400 bg-cyan-950/15 hover:bg-cyan-400/20 active:scale-95 active:bg-cyan-400/30 duration-200 rounded shadow-[0_0_15px_rgba(0,229,255,0.08)] hover:shadow-[0_0_25px_rgba(0,229,255,0.3)] hover:border-cyan-400 transition-all ease-in-out cursor-pointer"
            >
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping group-hover:bg-white group-hover:shadow-[0_0_8px_#00E5FF] transition-all" />
              Get Started
            </button>
          </div>

          {/* Coordinate Readout overlay */}
          <div className="hidden lg:flex flex-col justify-between items-end p-4 text-right font-mono text-[9px] text-slate-500">
            <div className="space-y-1">
              <div id="hud-lat-angle">LAT_ANGLE: 0.00°</div>
              <div id="hud-lon-angle">LON_ANGLE: 0.00°</div>
              <div className="text-cyan-400">DEC_RETICLE: LOCKED</div>
            </div>
          </div>
        </div>

        {/* Footer watermark & telemetry details */}
        <div className="w-full px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-7xl mx-auto w-full border-t border-white/5 pt-4 mb-2 font-mono text-[9px] text-slate-500 pointer-events-auto">
            <div>
              <div className="text-slate-600 uppercase tracking-widest mb-0.5">// INTERFACE STATUS</div>
              <div className="text-cyan-400 font-bold">CENTRALIZED TELEMETRY STREAM</div>
            </div>
            <div>
              <div className="text-slate-600 uppercase tracking-widest mb-0.5">// SCROLL INSTRUCTIONS</div>
              <div className="text-white">SCROLL DOWN TO INGEST SYSTEM DECK</div>
            </div>
            <div>
              <div className="text-slate-600 uppercase tracking-widest mb-0.5">// OPERATIONAL DESIGN</div>
              <div className="text-white">MULTI-HOP LAUNDERING TRAIL DETECTION</div>
            </div>
            <div>
              <div className="text-slate-600 uppercase tracking-widest mb-0.5">// LICENSED AGENT</div>
              <div className="text-slate-600">COPYRIGHT © 2026 AURA INTEL CORP.</div>
            </div>
          </div>

          <div className="text-center overflow-visible mt-6">
            <AuraTextEffect />
          </div>
        </div>
      </div>

      {/* ── SCREEN 2: SCROLLABLE LANDING INFORMATION VIEW ── */}
      <div 
        className="relative z-20 w-full pt-[100vh] pb-32 main-content-scroll"
        style={{ opacity: 0, pointerEvents: 'none' }}
      >
        <div className="max-w-7xl mx-auto px-8 space-y-32">
          
          {/* 1. HERO HEADER INTRO */}
          <div className="max-w-4xl space-y-6 pt-16">
            <span className="font-mono text-[10px] text-cyan-400 tracking-[0.25em] uppercase block">// FORENSIC LEDGER ANALYZER</span>
            
            <h2 className="text-5xl sm:text-7xl font-bold text-white leading-[0.9] tracking-tight premium-headline reveal-text">
              <span className="reveal-word">The</span> <span className="reveal-word">Operating</span> <span className="reveal-word">System</span> <span className="reveal-word">for</span> <br />
              <span className="reveal-word text-cyan-400 glow-text-cyan">Financial</span> <span className="reveal-word text-cyan-400 glow-text-cyan">Crime</span> <span className="reveal-word text-cyan-400 glow-text-cyan">Detection</span>
            </h2>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl font-light">
              AURA combines network graph telemetry with continuous machine learning anomaly pipelines to track multi-hop money trails, uncover shell accounts, and compile forensic dockets.
            </p>
          </div>

          {/* 2. WEBGL IMAGE REVEAL GRID (Shopify-inspired reveals) */}
          <div className="space-y-12">
            <div>
              <span className="font-mono text-[9px] text-cyan-400 tracking-[0.2em] uppercase block">// SYSTEM PREVIEWS</span>
              <h3 className="text-2xl font-bold text-white tracking-tight">Interactive Modules</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <WebGLImageReveal 
                src={dashboardScreenshot} 
                title="System Threat Directory" 
                description="Monitor total accounts, transactions, flagged volumes, and track pattern counters in real-time."
                badge="DASHBOARD_MATRIX"
              />
              <WebGLImageReveal 
                src={graphScreenshot} 
                title="Targeted Graph Canvas" 
                description="Visualise multi-hop routing paths, suspicious vectors, and trace circular loop assemblies."
                badge="FORCE_GRAPH"
              />
              <WebGLImageReveal 
                src={loginScreenshot} 
                title="Classification Gateway" 
                description="Secure AES-256 boot gateway for credential authentication and role delegation."
                badge="SECURE_GATEWAY"
              />
            </div>
          </div>

          {/* 3. PARALLAX STATS DECK */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 parallax-panel">
            {[
              { val: '200+', label: 'Accounts Logged' },
              { val: '2,500', label: 'Ledger Transfers' },
              { val: '₹1.28 Cr', label: 'Flagged Capital' },
              { val: '99.2%', label: 'Trace Accuracy' }
            ].map((stat, i) => (
              <div key={i} className="glass-panel p-8 text-center rounded-xl border border-white/5">
                <div className="font-mono text-3xl font-bold text-cyan-400 mb-2 glow-text-cyan">{stat.val}</div>
                <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 4. CORE PLATFORM CAPABILITIES */}
          <div className="space-y-12">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="font-mono text-[10px] text-cyan-400 tracking-[0.2em] uppercase">// OPERATIONAL SPECS</span>
              <h3 className="text-3xl font-bold text-white tracking-tight">Advanced Forensic Ledger Capabilities</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-8 rounded-xl border border-white/5 space-y-4">
                <div className="text-2xl">🕸️</div>
                <h4 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">// Multi-Hop Path Tracking</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-light">Trace layering chains and structured transactions across multiple bank nodes instantly, keeping existing layout positions pinned.</p>
              </div>

              <div className="glass-panel p-8 rounded-xl border border-white/5 space-y-4">
                <div className="text-2xl">🧠</div>
                <h4 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">// Machine Learning Ontology</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-light">Our neural processing pipeline flags circular, smurfing, fan-in, and rapid pass-through mule profiles automatically.</p>
              </div>

              <div className="glass-panel p-8 rounded-xl border border-white/5 space-y-4">
                <div className="text-2xl">📁</div>
                <h4 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">// Automated Case Dossiers</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-light">Generate comprehensive intelligence slates with 'Why flagged?' contribution charts, inflow/outflow metrics, and timestamp timelines.</p>
              </div>
            </div>
          </div>

          {/* 5. GOTHAM QUOTE BLOCK */}
          <div className="glass-panel p-10 max-w-4xl mx-auto text-center rounded-xl border border-white/5 space-y-4">
            <span className="text-4xl text-cyan-400/20 font-serif block">“</span>
            <p className="text-lg text-slate-300 font-light italic leading-relaxed max-w-2xl mx-auto">
              AURA allows compliance divisions to visualise complex money flows instantly, reducing typical case triage times from days to a few simple clicks.
            </p>
            <div className="font-mono text-[9px] text-slate-500 uppercase tracking-widest font-bold">
              // FINANCIAL CRIME TRIAGE UNIT REPORT (2026)
            </div>
          </div>

          {/* 6. CALL TO ACTION - AUTHENTICATE CONSOLE */}
          <div className="glass-panel p-12 text-center max-w-3xl mx-auto rounded-xl border border-white/5 space-y-6 relative overflow-hidden">
            <span className="font-mono text-[10px] text-cyan-400 tracking-[0.25em] uppercase block">// SYSTEM INITIALIZATION</span>
            <h3 className="text-3xl font-bold text-white tracking-tight">Access System Gateway</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-light">
              Authenticate credentials to unlock the real-time financial forensic graph console.
            </p>
            
            <div>
              <button
                onClick={handleAuthenticate}
                className="font-mono text-xs font-bold uppercase tracking-widest px-10 py-4 bg-cyan-400 text-slate-900 hover:bg-cyan-300 active:scale-95 duration-200 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)]"
              >
                Launch Console Gateway
              </button>
            </div>
          </div>

          {/* 7. MINIMALIST SYSTEM FOOTER */}
          <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-8 font-mono text-[9px] text-slate-600">
            <span>© 2026 AURA FINANCIAL INTELLIGENCE GROUP · SYSTEM ACCESS CLASSIFIED</span>
            <span>DATA TRANSIT INTEGRITY: AES-256 CONTEXT</span>
          </footer>

        </div>
      </div>
    </div>
  );
}
