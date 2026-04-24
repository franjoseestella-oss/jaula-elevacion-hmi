---
name: roboflow-integration
description: Describe los pasos y el código necesario para establecer la conexión entre la aplicación en Python y Roboflow para inferencia y automatización de la visión artificial.
---

# Integración con Roboflow (Inferencia Serverless)

Este skill define la manera estandarizada de conectarse con el workspace de Roboflow del proyecto (`VISION-PINTURA`) y ejecutar inferencias sobre los frames usando el SDK en Python de Roboflow.

## Requisitos Previos

- Tener instalada la librería del SDK:
  ```bash
  pip install inference_sdk
  ```

## Implementación Base

Para integrarse correctamente, se debe:
1. Importar `InferenceHTTPClient`.
2. Instanciar el cliente usando la URL `https://serverless.roboflow.com` y la **API Key**.
3. Ejecutar la función para el workflow respectivo del proyecto.

### Snippet de Conexión y Ejecución

```python
from inference_sdk import InferenceHTTPClient

def run_roboflow_inference(image_path: str):
    """
    Se conecta a Roboflow, envía una imagen y devuelve el JSON de predicción.
    """
    try:
        # Configuración del Cliente HTTP
        client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key="K6YHioHqtuwbsNmR2n7O" # *Recomendable aislar en variables de entorno en Prod
        )
        
        # Ejecutar Workflow del proyecto original encontrado
        result = client.run_workflow(
            workspace_name="welding-hqci3",           # Nombre del workspace
            workflow_id="detect-count-and-visualize-2", # Workflow específico
            images={"image": image_path},             # Ruta de la captura a inferir
            use_cache=True                            # Cacheo optimizado
        )
        
        print("[OK] Inferencia con Roboflow finalizada con éxito.")
        return result
        
    except Exception as e:
        print(f"[ERROR] Conectando a Roboflow: {e}")
        return None
```

## Estructura de Respuesta
El `result` que devuelve la petición es típicamente un diccionario JSON. Por defecto de este workflow, contendrá contadores, confidencia e inyecciones de cuadros delimitadores de resultados. 
Cuando se solicita integrarlo a la Web, este dict devuelto debe ser envíado del backend (`camera_server.py`) al Frontend.
