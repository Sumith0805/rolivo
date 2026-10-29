import { useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sparkles } from "@react-three/drei";

// A floating resume that a red beam scans. Lines light up as the beam passes them.
const PERIOD = 3.8; // seconds for one scan from top to bottom
const TOP = 1.75;
const BOTTOM = -1.75;

const BASE = new THREE.Color("#2a2956");
const LIT = new THREE.Color("#9d9ff5");
const KEY = new THREE.Color("#f32e35");

const scanProgress = (t) => (t % PERIOD) / PERIOD;
const beamY = (t) => TOP + (BOTTOM - TOP) * scanProgress(t);

// y = height on the paper, w = width, kind "key" lights up red (a matched keyword)
const LINES = [
  { y: 1.2, w: 1.0, h: 0.13, kind: "key" },
  { y: 0.98, w: 1.5 },
  { y: 0.6, w: 0.7, h: 0.09, kind: "key" },
  { y: 0.4, w: 1.95 },
  { y: 0.25, w: 1.7, kind: "key" },
  { y: 0.1, w: 1.85 },
  { y: -0.2, w: 0.8, h: 0.09, kind: "key" },
  { y: -0.4, w: 1.8 },
  { y: -0.55, w: 1.95, kind: "key" },
  { y: -0.7, w: 1.4 },
  { y: -1.05, w: 0.9, h: 0.09, kind: "key" },
  { y: -1.25, w: 1.7 },
  { y: -1.4, w: 1.2 },
];

function Line({ y, w, h = 0.07, kind }) {
  const mat = useRef();
  useFrame((state) => {
    if (!mat.current) return;
    const passed = beamY(state.clock.elapsedTime) < y;
    const target = !passed ? BASE : kind === "key" ? KEY : LIT;
    mat.current.color.lerp(target, 0.12);
  });
  return (
    <mesh position={[-1.05 + w / 2, y, 0.04]}>
      <boxGeometry args={[w, h, 0.02]} />
      <meshBasicMaterial ref={mat} color={BASE} />
    </mesh>
  );
}

function Scanner() {
  const group = useRef();
  const core = useRef();
  const glow = useRef();
  useFrame((state) => {
    if (!group.current || !core.current || !glow.current) return;
    const t = state.clock.elapsedTime;
    const fade = Math.sin(scanProgress(t) * Math.PI);
    group.current.position.y = beamY(t);
    core.current.opacity = 0.2 + fade * 0.8;
    glow.current.opacity = fade * 0.18;
  });
  return (
    <group ref={group} position={[0, TOP, 0.07]}>
      <mesh>
        <planeGeometry args={[2.9, 0.04]} />
        <meshBasicMaterial ref={core} color="#f32e35" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.9, 0.5]} />
        <meshBasicMaterial ref={glow} color="#f32e35" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// tilts the whole resume gently toward the mouse
function Rig({ children }) {
  const g = useRef();
  useFrame((state) => {
    if (!g.current) return;
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, state.pointer.x * 0.45, 0.06);
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, -state.pointer.y * 0.3, 0.06);
  });
  return <group ref={g}>{children}</group>;
}

export default function Hero3D() {
  // people who asked for less motion get a still scene
  const [reduce] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });

  return (
    <div aria-hidden="true" style={{ width: "100%", height: "100%", minHeight: 360 }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6.2], fov: 40 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={reduce ? "demand" : "always"}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[3, 3, 4]} intensity={30} color="#4e50de" />
        <pointLight position={[-3, -2, 3]} intensity={18} color="#f32e35" />
        <Sparkles count={36} scale={[6, 5, 2]} size={2.2} speed={0.35} color="#9d9ff5" position={[0, 0, -1]} />
        <Rig>
          <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
            <RoundedBox args={[2.5, 3.3, 0.06]} radius={0.05} smoothness={4}>
              <meshStandardMaterial color="#151429" roughness={0.5} metalness={0.2} />
            </RoundedBox>
            <RoundedBox args={[2.56, 3.36, 0.04]} radius={0.06} smoothness={4} position={[0, 0, -0.04]}>
              <meshBasicMaterial color="#4e50de" transparent opacity={0.55} />
            </RoundedBox>
            {LINES.map((l) => (
              <Line key={l.y} {...l} />
            ))}
            <Scanner />
          </Float>
        </Rig>
      </Canvas>
    </div>
  );
}
