"""
Publicador MQTT de estado de la jaula de elevacion.
Repo: jaula-elevacion-hmi

Publica cada cambio de estado a MES-OEE-jaula.
  - Topic estado:   planta/jaula/{JAULA_ID}/estado   (QoS 1, retained)
  - Topic conexion: planta/jaula/{JAULA_ID}/conexion (retained + LWT)

Estados (equivalente PackML entre parentesis, por si algun dia se estandariza):
  EN_ESPERA          (IDLE)
  SECUENCIA_INICIADA (STARTING)
  EN_PROCESO         (EXECUTE)
  PAUSADA            (HELD)
  ERROR              (ABORTED)
  FINALIZADA         (COMPLETE)

Requisitos: pip install "paho-mqtt>=2.0"
"""
import json
import os
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER_HOST = os.getenv("MQTT_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASS = os.getenv("MQTT_PASS")
JAULA_ID = os.getenv("JAULA_ID", "JAULA-01")

TOPIC_ESTADO = f"planta/jaula/{JAULA_ID}/estado"
TOPIC_CONEXION = f"planta/jaula/{JAULA_ID}/conexion"


def _ahora():
    return datetime.now(timezone.utc).isoformat()


class JaulaPublisher:
    def __init__(self):
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"jaula-{JAULA_ID}",
        )
        if MQTT_USER:
            self.client.username_pw_set(MQTT_USER, MQTT_PASS)

        # LWT: si el proceso de la jaula cae, el broker avisa a MES
        # -> se convierte en hueco de disponibilidad para el OEE.
        self.client.will_set(
            TOPIC_CONEXION,
            payload=json.dumps({"online": False, "ts": _ahora()}),
            qos=1,
            retain=True,
        )
        self.client.on_connect = self._on_connect

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            client.publish(
                TOPIC_CONEXION,
                json.dumps({"online": True, "ts": _ahora()}),
                qos=1,
                retain=True,
            )
            print(f"[jaula] conectado al broker, {JAULA_ID} online")
        else:
            print(f"[jaula] fallo de conexion: {reason_code}")

    def conectar(self):
        try:
            # Usar connect_async para evitar bloquear el arranque si el broker MQTT está caído
            self.client.connect_async(BROKER_HOST, BROKER_PORT)
            self.client.loop_start()
            print(f"[jaula] Conexión MQTT iniciada en segundo plano con {BROKER_HOST}:{BROKER_PORT}")
        except Exception as e:
            print(f"[jaula] [ADVERTENCIA] No se pudo iniciar la conexión asíncrona MQTT a {BROKER_HOST}:{BROKER_PORT}: {e}")


    def desconectar(self):
        # Cierre limpio: marca offline explicito antes de parar.
        self.client.publish(
            TOPIC_CONEXION,
            json.dumps({"online": False, "ts": _ahora()}),
            qos=1,
            retain=True,
        )
        self.client.loop_stop()
        self.client.disconnect()

    def publicar_estado(self, estado, evento, secuencia_id=None, **extra):
        payload = {
            "ts": _ahora(),
            "jaula_id": JAULA_ID,
            "estado": estado,
            "evento": evento,
            "secuencia_id": secuencia_id,
        }
        payload.update(extra)
        # retained: un MES que reconecta recibe el ultimo estado al instante.
        self.client.publish(TOPIC_ESTADO, json.dumps(payload), qos=1, retain=True)
        print(f"[jaula] -> {estado} ({evento}) seq={secuencia_id}")

    # --- Atajos por evento ---
    def inicio_secuencia(self, secuencia_id, tiempo_teorico_s=None):
        self.publicar_estado("SECUENCIA_INICIADA", "inicio_secuencia",
                             secuencia_id, tiempo_teorico_s=tiempo_teorico_s)

    def en_proceso(self, secuencia_id):
        self.publicar_estado("EN_PROCESO", "ejecucion", secuencia_id)

    def pausa(self, secuencia_id):
        self.publicar_estado("PAUSADA", "pausa", secuencia_id)

    def reanudacion(self, secuencia_id):
        self.publicar_estado("EN_PROCESO", "reanudacion", secuencia_id)

    def error(self, secuencia_id, codigo, descripcion, severidad="critico"):
        self.publicar_estado(
            "ERROR", "error", secuencia_id,
            error={"codigo": codigo, "descripcion": descripcion,
                   "severidad": severidad},
        )

    def fin_secuencia(self, secuencia_id, duracion_real_s, dentro_de_tiempo):
        self.publicar_estado(
            "FINALIZADA", "fin_secuencia", secuencia_id,
            duracion_real_s=duracion_real_s, dentro_de_tiempo=dentro_de_tiempo,
        )

    def en_espera(self):
        self.publicar_estado("EN_ESPERA", "reset", None)


if __name__ == "__main__":
    import time

    j = JaulaPublisher()
    j.conectar()
    time.sleep(1)

    # Ejemplo de un ciclo completo
    j.en_espera()
    j.inicio_secuencia("SEC-03", tiempo_teorico_s=420)
    j.en_proceso("SEC-03")
    j.pausa("SEC-03")
    j.reanudacion("SEC-03")
    j.fin_secuencia("SEC-03", duracion_real_s=405, dentro_de_tiempo=True)
    j.en_espera()

    time.sleep(1)
    j.desconectar()
