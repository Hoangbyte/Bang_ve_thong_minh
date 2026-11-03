import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { polylines, type Dims, type SolidKind } from '../solid/defs'

export interface CaptureResult { url: string; w: number; h: number }
interface Props {
  kind: SolidKind
  dims: Dims
  showHidden: boolean
  onReady: (capture: () => CaptureResult) => void
}

const INK = '#16231f'

function Geometry({ kind, d }: { kind: SolidKind; d: Dims }) {
  switch (kind) {
    case 'box': return <boxGeometry args={[d.a, d.c, d.b]} />
    case 'sphere': return <sphereGeometry args={[d.r, 48, 32]} />
    case 'cylinder': return <cylinderGeometry args={[d.r, d.r, d.h, 48]} />
    case 'cone': return <coneGeometry args={[d.r, d.h, 48]} />
    case 'pyramid': return <coneGeometry args={[d.a / Math.SQRT2, d.h, 4]} />
  }
}

/** Cho phép nút "Thả lên bảng" chụp khung nhìn hiện tại thành ảnh PNG. */
function CaptureBridge({ onReady }: { onReady: Props['onReady'] }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera)
      return { url: gl.domElement.toDataURL('image/png'), w: gl.domElement.width, h: gl.domElement.height }
    })
  }, [gl, scene, camera, onReady])
  return null
}

/**
 * Khối 3D kiểu hình vẽ sách giáo khoa: cạnh thấy được là nét liền, cạnh bị che là nét đứt.
 * Cách làm: một khối "chỉ ghi độ sâu" (không tô màu) che các nét liền ở phía sau; nét đứt vẽ không kiểm tra độ sâu
 * nên luôn hiện, rồi nét liền vẽ đè lên ở chỗ nhìn thấy.
 */
export default function Solid3D({ kind, dims, showHidden, onReady }: Props) {
  const lines = useMemo(() => polylines(kind, dims), [kind, dims])
  const spin = kind === 'pyramid' ? Math.PI / 4 : 0 // chóp 4 mặt của three.js có đỉnh đáy nằm trên trục, xoay 45° cho cạnh đáy song song trục

  return (
    <Canvas
      camera={{ position: [5, 4, 6.5], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ height: 300, touchAction: 'none' }}
    >
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />

      <mesh renderOrder={0} rotation={[0, spin, 0]}>
        <Geometry kind={kind} d={dims} />
        <meshBasicMaterial colorWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh renderOrder={3} rotation={[0, spin, 0]}>
        <Geometry kind={kind} d={dims} />
        <meshStandardMaterial color="#8fd0bb" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {showHidden &&
        lines.map((pts, i) => (
          <Line key={`h${i}`} points={pts} color={INK} lineWidth={1.2} dashed dashSize={0.12} gapSize={0.1} depthTest={false} transparent opacity={0.75} renderOrder={1} />
        ))}
      {lines.map((pts, i) => (
        <Line key={`s${i}`} points={pts} color={INK} lineWidth={2} renderOrder={2} />
      ))}

      <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={18} />
      <CaptureBridge onReady={onReady} />
    </Canvas>
  )
}
