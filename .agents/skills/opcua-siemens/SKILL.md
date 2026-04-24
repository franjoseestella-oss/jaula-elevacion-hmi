---
name: opcua-siemens
description: Skill para conexión bidireccional (lectura y escritura de componentes y estados) con PLCs Siemens S7-1200 utilizando el protocolo OPC UA estándar desde Python.
---

# Integración con PLC Siemens S7-1200 vía OPC UA

Este skill define cómo el Backend en Python debe implementar la comunicación industrial directa y con control de variables expuestas (e.g., estados de encendido, alarmas de pintura) que provee el PLC de Siemens actuando como Servidor OPC UA.

## Requisitos y Dependencias

- **Backend (Python)**: Utilizaremos la librería `asyncua` (la implementación oficial asíncrona de OPC UA para Python).
  ```bash
  pip install asyncua
  ```
- **PLC Siemens S7-1200**:
  - En *TIA Portal*, el servidor OPC UA debe estar activado.
  - En los Bloques de Datos (DB), las variables que se requieran leer/escribir deben tener marcada la casilla "Accessible/Writable from HMI/OPC UA".

## Pipeline de Conexión (asyncua)

La interacción en python se basa en usar el módulo `asyncio` dado que OPC UA es altamente de red y asíncrono.

### Código Base de Lectura y Escritura

```python
import asyncio
from asyncua import Client, ua

# La dirección por defecto de un server OPC UA suele exponerse en el puerto 4840.
OPC_URL = "opc.tcp://192.168.0.1:4840" 

async def intercambiar_datos_plc():
    # Instanciamos Cliente
    client = Client(url=OPC_URL)
    
    try:
        # 1. Establecer conexión con PLC SIEMENS
        await client.connect()
        print("[OK] Conectado exitosamente al Servidor OPC UA del PLC S7-1200")

        # 2. Localizar el Nodo deseado.
        # En ecosistemas Siemens TIA Portal, las variables casi siempre están 
        # en el NameSpace 3 o 4 (ns=3) y se referencian por String (s=).
        # Ejemplo Siemens: s="DB_App"."arranque_motor"
        node_path_lectura = 'ns=3;s="BloqueDeDatos_A"."variable_estado"'
        nodo_estado = client.get_node(node_path_lectura)
        
        # 3. LECTURA DE DATOS (READ)
        # Permite leer enteros, boleanos, floats e incluso Arrays.
        valor_estado = await nodo_estado.read_value()
        print(f"[INFO] El valor del Nodo en el PLC es: {valor_estado}")

        # 4. ESCRITURA DE DATOS (WRITE)
        # E.g. Mandar señal para activar o cambiar una variable en el PLC
        node_path_escritura = 'ns=3;s="BloqueDeDatos_A"."forzar_actuador"'
        nodo_actuador = client.get_node(node_path_escritura)
        
        # Para escribir en OPC UA, debemos empaquetar el valor en un objeto DataValue
        # Aquí forzamos un valor Booleano a True.
        nuevo_valor = ua.DataValue(ua.Variant(True, ua.VariantType.Boolean))
        
        await nodo_actuador.write_value(nuevo_valor)
        print(f"[OK] Se ha escrito el valor True a la variable del actuador en el PLC.")

    except Exception as e:
        print("[ERROR] Fallo en la comunicación u operación: ", e)
    finally:
        # Siempre cerrar conexión para no agotar el límite de sesiones del PLC.
        await client.disconnect()
        print("[INFO] Conexión OPC UA Terminada.")

# Entrypoint asíncrono temporal
if __name__ == "__main__":
    asyncio.run(intercambiar_datos_plc())
```

## Tips Claves / Troubleshooting
- **NodeID Correcto**: Si no consigues conectar al nodo en Python que creaste en Siemens, usa el programa gratuito **UaExpert**. Al conectarlo a la IP del S7-1200, podrás arrastrar las variables y ver textualmente su ruta (`ns=3;s="Nombre_del_Bloque"."Tag_Siemens"`) para hacer copy/paste literal al script de Python. Esto evita cientos de dolores de cabeza sintácticos.
- **Persistencia Múltiple**: Si la aplicación web/backend está operando constantemente, re-estructurarás el código para dejar el cliente "abierto". Crea una clase que en inicialización lance conectividad ( `await client.connect()` ), y lee/escribe con métodos aislados de tu API REST/WebSocket. No abras ni cierres el cliente en cada Request para evitar lentitud y timeout.
