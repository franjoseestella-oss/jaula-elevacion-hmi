import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Agregar directorios al path para importar correctamente
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from jaula_publisher import JaulaPublisher
import backend.main as main
from database.models import ErpCarretilla, ReferenciaEnCiclo, LogTabla, LogAlarma


class TestMqttIntegration(unittest.TestCase):
    def setUp(self):
        # Mockear main.mqtt_publisher
        self.mock_pub = MagicMock(spec=JaulaPublisher)
        main.mqtt_publisher = self.mock_pub

    def test_jaula_publisher_methods(self):
        # Probar métodos del publicador directamente
        pub = JaulaPublisher()
        pub.client = MagicMock()
        
        # Probar inicio_secuencia
        pub.inicio_secuencia("SEC-123", tiempo_teorico_s=420)
        pub.client.publish.assert_called()
        
        # Probar en_espera
        pub.en_espera()
        pub.client.publish.assert_called()

    def test_start_cycle_endpoint(self):
        # Mockear sesión de base de datos
        db_mock = MagicMock()
        
        # Mockear consultas
        ref_mock = ReferenciaEnCiclo(id=1, REFERENCIA_ACTUAL="0", FECHA_INICIO_CICLO="0")
        erp_mock = ErpCarretilla(
            bastidor="B-123",
            tpo_elev_max_scarga=1000.0, # 10s
            tpo_desc_max_scarga=1000.0, # 10s
            tpo_elevac_max=1000.0,      # 10s
            tpo_descenso_max=1000.0     # 10s
        )
        
        # Simular retornos de query según el modelo
        def query_side_effect(model):
            q = MagicMock()
            if model == ReferenciaEnCiclo:
                q.filter.return_value.first.return_value = ref_mock
            elif model == ErpCarretilla:
                q.filter.return_value.first.return_value = erp_mock
            return q
            
        db_mock.query.side_effect = query_side_effect
        
        params = MagicMock()
        params.nsecuencia = "SEC-123"
        params.nbastidor = "B-123"
        params.nmodelo = "M-123"
        params.nmastil = "MAS-123"
        params.operario = "OP-1"
        params.fecha_montaje = "2026-06-21"
        params.referencia = "REF-1"
        
        res = main.start_cycle(params, db=db_mock)
        
        # Verificar que se calcularon y publicaron correctamente los datos en MQTT
        # (1000 + 1000 + 1000 + 1000) / 100 = 40.0s. Tiempo total = 40.0 + 300.0 + 120.0 = 460.0s
        self.mock_pub.inicio_secuencia.assert_called_with(
            secuencia_id="SEC-123",
            tiempo_teorico_s=460
        )
        self.mock_pub.en_proceso.assert_called_with(secuencia_id="SEC-123")
        self.assertEqual(res["status"], "success")

    def test_save_log_endpoint(self):
        # Mockear sesión y retorno de create_log
        db_mock = MagicMock()
        log_mock = LogTabla(
            FECHA_HORA_INICIO_SEC="2026-06-21T10:00:00.000Z",
            FECHA_HORA_FIN_SEC="2026-06-21T10:05:00.000Z",
            OK_NOK="OK",
            NSECUENCIA="SEC-123",
            id=12.0
        )
        
        with patch('backend.main.create_log', return_value=log_mock):
            res = main.save_log({}, db=db_mock)
            
            # Verificar duración real calculada a partir de los timestamps (5 minutos = 300 segundos)
            self.mock_pub.fin_secuencia.assert_called_with(
                secuencia_id="SEC-123",
                duracion_real_s=300,
                dentro_de_tiempo=True
            )
            self.mock_pub.en_espera.assert_called()
            self.assertEqual(res["status"], "success")

    def test_reset_cycle_endpoint(self):
        db_mock = MagicMock()
        ref_mock = ReferenciaEnCiclo(id=1)
        db_mock.query.return_value.filter.return_value.first.return_value = ref_mock
        
        res = main.reset_cycle(db=db_mock)
        
        self.mock_pub.en_espera.assert_called()
        self.assertEqual(res["status"], "success")

    def test_save_alarm_endpoint(self):
        db_mock = MagicMock()
        alarm_mock = LogAlarma(
            id=1,
            FECHA_Y_HORA="2026-06-21T10:00:00.000Z",
            TIPO="Alarma",
            DESCRIPCION="Sobrecarga",
            DURACION="Activa"
        )
        
        ref_mock = ReferenciaEnCiclo(id=1, NSECUENCIA="SEC-123")
        
        def query_side_effect(model):
            q = MagicMock()
            if model == ReferenciaEnCiclo:
                q.filter.return_value.first.return_value = ref_mock
            return q
            
        db_mock.query.side_effect = query_side_effect
        
        alarm_data_mock = MagicMock()
        alarm_data_mock.dict.return_value = {}
        alarm_data_mock.plcVar = "ERR_01"
        
        with patch('database.crud.create_alarm', return_value=alarm_mock):
            res = main.save_alarm(alarm_data_mock, db=db_mock)
            
            self.mock_pub.error.assert_called_with(
                secuencia_id="SEC-123",
                codigo="ERR_01",
                descripcion="Sobrecarga",
                severidad="critico"
            )
            self.assertEqual(res["status"], "success")

    def test_resolve_alarm_endpoint(self):
        db_mock = MagicMock()
        alarm_mock = LogAlarma(id=1, DURACION="Resuelta")
        
        # Retornar recuento 0 al comprobar si quedan alarmas activas
        db_mock.query.return_value.filter.return_value.count.return_value = 0
        
        resolve_data_mock = MagicMock()
        resolve_data_mock.plcVar = "ERR_01"
        resolve_data_mock.endTime = 12345678
        resolve_data_mock.duration = "Resuelta"
        
        with patch('database.crud.resolve_alarm', return_value=alarm_mock):
            res = main.update_alarm_resolved(resolve_data_mock, db=db_mock)
            
            self.mock_pub.en_espera.assert_called()
            self.assertEqual(res["status"], "success")

if __name__ == '__main__':
    unittest.main()
