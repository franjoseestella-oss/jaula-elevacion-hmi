---
name: basler-camera
description: Describe los requisitos y la implementación oficial basada en pypylon para la conexión, configuración y captura de imágenes usando cámaras industriales Basler asociadas al proyecto.
---

# Integración y Manejo de Cámaras Basler

Este skill establece cómo debe utilizarse `pypylon` para conectar, configurar y leer frames de las cámaras industriales Basler (por ejemplo, el modelo especificado *Basler acA1920-48gm* o análogos) usadas en el entorno.

## Requisitos y Dependencias

- **Librería de manipulación oficial**: `pypylon`. (Instalable vía pip: `pip install pypylon`)
- **OpenCV**: `opencv-python` (`cv2`) para transformar el array capturado al framework o guardarlo localmente.
- **Conectividad Mínima**: Cámara Basler conectada directamente a la tarjeta de red (frecuentemente configurando en la NIC el rango 192.168.0.x / 255.255.255.0).

## Conexión Básica e Implementación

Para asegurar que todo funcione de maravillas, el proceso consta de:
1. Enumerar si hay dispositivos (`TlFactory`).
2. Conectar al primero.
3. Ajustes de Exposición y Framerate.
4. Convertir al formato `BGR8packed` con ImageFormatConverter.

### Snippets de Código Estándar

```python
from pypylon import pylon
import cv2

def capture_basler_frame():
    """ Conecta a la cámara Basler, reajusta resolución/exposición y extrae 1 Frame. """
    try:
        # 1. Iniciar fábrica e identificar cámara
        factory = pylon.TlFactory.GetInstance()
        devices = factory.EnumerateDevices()
        
        if len(devices) == 0:
            print("[WARN] No se encontraron cámaras Basler conectadas.")
            return None

        # 2. Conexión instanciada
        cam = pylon.InstantCamera(factory.CreateFirstDevice())
        cam.Open()

        # 3. Configuración Inicial
        # Ajuste de resolución y tiempo de exposición (ej: 10ms = 10000us)
        cam.Width.Value  = 640 
        cam.Height.Value = 480
        
        try:
            cam.ExposureAuto.Value = "Off"
            cam.ExposureTimeAbs.Value = 10000 
        except Exception:
            # Compatibilidad si no existe TimeAbs
            try: cam.ExposureTime.Value = 10000
            except: pass
            
        try:
            cam.AcquisitionFrameRateEnable.Value = True
            cam.AcquisitionFrameRateAbs.Value = 5.0
        except Exception: pass
            
        # 4. Iniciar la captura en estrategia "solo el último"
        cam.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
        
        # 5. Configurar el conversor formato para inyectar en Front/OpenCV OpenCV
        converter = pylon.ImageFormatConverter()
        converter.OutputPixelFormat = pylon.PixelType_BGR8packed

        # 6. Extracción y Parsing
        result = cam.RetrieveResult(3000, pylon.TimeoutHandling_ThrowException)
        arr = None
        if result.GrabSucceeded():
            img = converter.Convert(result)
            arr = img.GetArray()  # <--- Este numpy array es procesable por CV2 o Roboflow
            
        result.Release()
        cam.StopGrabbing()
        cam.Close()

        return arr

    except Exception as e:
        print("[ERROR] Fallo crítico con la cámara Basler:", e)
        return None
```

## Troubleshooting
- Si `EnumerateDevices()` devuelve 0, revisa los rangos IP y el cableado PoE. Tratar de hacer Ping a la cámara.
- A veces el nodo `ExposureTimeAbs` viene nombrado diferente (`ExposureTime` plano) según el firmware en los modelos más antiguos, por lo que debes usar try-except al setear parámetros de Exposición.
