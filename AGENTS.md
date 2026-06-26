# AGENTS.md

Contexto y reglas para los agentes que trabajan en este workspace.
Léelo al inicio de cada misión, antes de planificar o escribir código.

## Entorno e idioma

- Desarrollo en entorno industrial / planta de fabricación. Perfil mixto: software + ingeniería de planta (sensores, HMI, fabricación de chapa).
- GitHub: `franjoseestella-oss`.
- **Responde siempre en español.** Comentarios de código, docstrings y mensajes de commit, también en español.

## Aplicaciones de este workspace

### 1. MES-OEE-jaula
Aplicación interna de monitorización MES / OEE de planta.

- Objetivo: seguimiento de producción y de disponibilidad / rendimiento / calidad (OEE).
- Incluye una **pantalla de plan de producción** tipo *State Timeline*:
  - Eje Y = secuencias a fabricar en el día.
  - Eje X = tiempo (referencia teórica).
  - Color = estado de cada secuencia:
    - **Amarillo** = pendiente / le tocaba empezar y no inició / terminada dentro de tiempo.
    - **Verde** = proceso en marcha.
    - **Rojo** = error.
  - Si una secuencia se pasa del tiempo teórico, salta a la siguiente.
- Stack: <RELLENAR: p.ej. Python + Grafana (panel State Timeline) sobre InfluxDB / Postgres, o dashboard web propio>.

### 2. jaula-elevacion-hmi
HMI para la jaula de elevación.

- Sensor de distancia: **Wenglor time-of-flight (ToF) láser**, con útil de calibración asociado.
- Objetivo: interfaz de operación y visualización del estado de la jaula.
- Stack: <RELLENAR: framework HMI / lenguaje / pantalla destino>.

## Stack y herramientas

- Editor: VS Code. Contenedores: Docker. Control de versiones: Git / GitHub.
- Lenguaje principal: <RELLENAR: Python u otro>.
- <RELLENAR otras piezas clave: base de datos, broker (MQTT / OPC-UA), librerías, etc.>

## Convenciones de código

- Sigue el estilo del código que ya existe en el repo; no reformatees archivos enteros sin pedirlo.
- Nombres de módulos y archivos coherentes con lo que ya hay.
- Comentarios y docstrings en español.
- Commits en español, formato corto: `tipo: descripción` (p.ej. `feat: pantalla plan de producción`).

## Reglas y restricciones (entorno industrial)

- **Planifica antes de tocar código.** Enséñame el plan / artefacto antes de cambios grandes.
- No modifiques integraciones con hardware o sensores, ni esquemas de datos, sin avisar primero.
- Nunca metas credenciales, IPs de planta ni claves en el repo. Usa variables de entorno.
- Una tarea por misión. No mezcles las dos apps en el mismo cambio salvo que lo pida.
- Añade o actualiza tests cuando metas lógica nueva.

## Cómo trabajar conmigo

- Si te falta un dato (stack, fuente de datos, sensor, pin), pregunta 1-2 cosas concretas antes de asumir.
- Prefiero salidas visuales o en checklist cuando encaje.
