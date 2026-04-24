---
name: obj-3d-viewer
description: Skill para renderizar y visualizar archivos 3D en formato .obj dentro de la interfaz frontend.
---

# Visualización de Modelos 3D (.obj)

Este skill define la infraestructura y librerías para incrustar visores interactivos 3D (para mostrar las mallas `obj` de piezas u objetos a analizar/pintar) en la web.

## Requisitos y Dependencias

Si el frontend está basado en React (como se infiere del entorno de la UI), el framework estándar por eficiencia y fácil manejo es `React Three Fiber`.

- Instalación de librerías:
  ```bash
  npm install three @react-three/fiber @react-three/drei
  ```

## Estructura del Componente Visualizador (React + R3F)

La librería auxiliar `@react-three/drei` simplifica enormemente la gestión de la cámara y las luces ambientales sin necesidad de escribirlas manualmente.

```tsx
import React, { Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'; // Importación vital para OBJ

// Sub-Componente que carga asíncronamente la Malla
const ModelOBJ = ({ url }: { url: string }) => {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} scale={1} />; // Escala ajustable si el modelo es gigante
};

// Componente Visor Principal
export const Visor3D = ({ urlObjeto }: { urlObjeto: string }) => {
  return (
    // Es crítico definir el height y width al contenedor, 
    // de lo contrario el Canvas colapsa a 0px.
    <div style={{ width: '100%', height: '500px', backgroundColor: '#efefef' }}>
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
        
        {/* Suspense muestra algo mientras el loader descarga el OBJ de la red */}
        <Suspense fallback={<span>Cargando modelo 3D...</span>}>
          {/* Stage acomoda el modelo en el centro, agrega luces y crea entorno */}
          <Stage environment="city" intensity={0.5}>
            <ModelOBJ url={urlObjeto} />
          </Stage>
        </Suspense>
        
        {/* OrbitControls permite al usuario rotar, desplazar y hacer pan con el mouse */}
        <OrbitControls makeDefault />
        
      </Canvas>
    </div>
  );
};
```

### Implementación en Vainilla / HTML (Sin React)

Si no se dispone de React, la conexión directa usando el módulo `Three.js` es la siguiente:

```javascript
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('visor3d');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 2, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040)); // Luz suave universal

new OBJLoader().load('modelos/pieza.obj', function (object) {
    scene.add(object);
});

const controls = new OrbitControls(camera, renderer.domElement);
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
```

## Troubleshooting
- **Modelos oscuros o Negros**: Un `.obj` sin luces direccionales/ambientales en la escena generada se dibuja, pero se ve completamente negro oscuro. Si usas React `Stage` te soluciona esto automáticamente.
- **Ruta del Archivo NO Encontrada**: En frameworks (Vite/Next/CRA), los archivos estáticos en carga dinámica como un archivo `.obj`, no van importados como módulos. El `.obj` debe almacenarse físicamente en la carpeta `/public` y ser referenciado de forma absoluta ruta, i.e.: `urlObjeto="/pieza_valvula.obj"`.
