import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Bounds } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { Maximize2, Minimize2, Loader2, AlertTriangle } from 'lucide-react';
import * as THREE from 'three';

const ModelOBJ = ({ objUrl, mtlUrl, onLoad, onError }) => {
  const [obj, setObj] = useState(null);

  useEffect(() => {
    if (!objUrl) return;
    let isMounted = true;
    
    const loadModel = async () => {
      let materials = null;
      
      if (mtlUrl) {
        try {
          const mtlLoader = new MTLLoader();
          materials = await mtlLoader.loadAsync(mtlUrl);
          materials.preload();
        } catch (mtlErr) {
          console.warn("No se pudo cargar el archivo MTL. Cargando malla base...", mtlErr);
        }
      }
      
      try {
        const objLoader = new OBJLoader();
        if (materials) {
          objLoader.setMaterials(materials);
        }
        
        objLoader.load(
          objUrl,
          (loadedObj) => {
            if (!isMounted) return;
            
            // Auto-escalado y centrado manual para evitar dependencias externas
            const box = new THREE.Box3().setFromObject(loadedObj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (maxDim > 0) {
              const scale = 5 / maxDim; // Escalar para que encaje en la vista de la cámara
              loadedObj.scale.set(scale, scale, scale);
              
              const center = box.getCenter(new THREE.Vector3());
              loadedObj.position.x = -center.x * scale;
              loadedObj.position.y = -center.y * scale;
              loadedObj.position.z = -center.z * scale;
            }

            // Reparación de mallas CAD: Forzar pintado por ambos lados (DoubleSide)
            // Esto soluciona el problema de que el modelo sea invisible si las normales están invertidas
            loadedObj.traverse((child) => {
              if (child.isMesh) {
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => { m.side = THREE.DoubleSide; });
                  } else {
                    child.material.side = THREE.DoubleSide;
                  }
                } else {
                   // Si el OBJ no tiene material asignado y no hay MTL, asignamos uno gris visible
                   child.material = new THREE.MeshStandardMaterial({
                     color: 0xaaaaaa,
                     side: THREE.DoubleSide,
                     roughness: 0.5,
                     metalness: 0.5
                   });
                }
              }
            });

            setObj(loadedObj);
            if (onLoad) onLoad();
          },
          (xhr) => {},
          (error) => {
            console.error("Error cargando/parseando OBJ:", error);
            if (isMounted && onError) onError('Error al parsear el archivo OBJ.');
          }
        );
      } catch (err) {
        console.error("Error crítico en 3D model:", err);
        if (isMounted && onError) onError(err.message || 'Error crítico al cargar el modelo');
      }
    };
    
    loadModel();
    
    return () => { isMounted = false; };
  }, [objUrl, mtlUrl]);

  if (!obj) return null;
  return <primitive object={obj} />;
};

export const ObjViewer = ({ objFile, mtlFile }) => {
  const [urls, setUrls] = useState({ objUrl: null, mtlUrl: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const objUrl = objFile ? URL.createObjectURL(objFile) : null;
    const mtlUrl = mtlFile ? URL.createObjectURL(mtlFile) : null;
    setUrls({ objUrl, mtlUrl });
    
    if (objUrl) {
      setLoading(true);
      setError(null);
    }

    return () => {
      if (objUrl) URL.revokeObjectURL(objUrl);
      if (mtlUrl) URL.revokeObjectURL(mtlUrl);
    };
  }, [objFile, mtlFile]);

  if (!urls.objUrl) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#0a0f12]/50 border border-dashed border-[#2e404a] rounded-xl text-logisnext-lightslate text-xs font-bold uppercase tracking-widest">
        Selecciona un archivo .OBJ para visualizar
      </div>
    );
  }

  const ViewerContent = () => (
    <div className={`relative bg-[#1d2930] ${isFullscreen ? 'fixed inset-0 z-[100] w-full h-full' : 'w-full h-full rounded-xl overflow-hidden border border-[#2e404a]'}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1d2930]/80 backdrop-blur-sm">
          <Loader2 size={32} className="text-logisnext-magenta animate-spin mb-2" />
          <span className="text-white text-xs font-bold uppercase tracking-widest">Procesando Modelo 3D...</span>
          <span className="text-logisnext-lightslate text-[10px] mt-1">Calculando geometría y mallas. Por favor, espere.</span>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1d2930]/90 backdrop-blur-sm">
          <AlertTriangle size={32} className="text-red-500 mb-2" />
          <span className="text-white text-xs font-bold uppercase tracking-widest text-center px-4">Error al cargar el archivo</span>
          <span className="text-red-400 text-[10px] mt-1 text-center px-4 max-w-md">{error}</span>
        </div>
      )}

      <Canvas 
        shadows 
        camera={{ position: [0, 5, 10], fov: 50, near: 0.1, far: 5000 }}
        gl={{ powerPreference: "high-performance", alpha: true, antialias: false }}
        onCreated={({ gl }) => {
          // Manejo de errores de WebGL
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.error("Contexto WebGL perdido");
            setError("La tarjeta gráfica se ha quedado sin memoria. El modelo es demasiado grande o complejo.");
            setLoading(false);
          }, false);
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[100, 100, 100]} intensity={1.5} castShadow />
        <directionalLight position={[-100, -100, -100]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <Center>
            <ModelOBJ 
              objUrl={urls.objUrl} 
              mtlUrl={urls.mtlUrl} 
              onLoad={() => setLoading(false)}
              onError={(msg) => { setLoading(false); setError(msg); }}
            />
          </Center>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
      
      <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur rounded text-[10px] text-white font-mono uppercase tracking-widest border border-[#2e404a]/50">
        Visor 3D Interactivo
      </div>
      
      <button 
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-logisnext-magenta/80 backdrop-blur rounded text-white border border-[#2e404a]/50 hover:border-logisnext-magenta transition-colors"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );

  return <ViewerContent />;
};

export default ObjViewer;
