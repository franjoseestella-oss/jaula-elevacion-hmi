
try:
    from pypylon import pylon
    PYPYLON_AVAILABLE = True
except ImportError:
    PYPYLON_AVAILABLE = False

# =====================================================================
# CONFIGURACIÓN DE CÁMARA BASLER
# Edita estos parámetros para ajustarlos a la cámara real en planta
# =====================================================================
CAMERA_CONFIG = {
    "IPAddress": "",              # Dejar en blanco para autodetectar, o poner ej. "192.168.0.100"
    "Width": 640,                 # Resolución horizontal (ej. 640, 1920, 2448...)
    "Height": 480,                # Resolución vertical (ej. 480, 1080, 2048...)
    "ExposureAuto": "Off",        # "Off", "Once", "Continuous"
    "ExposureTime": 10000,        # Tiempo de exposición en microsegundos
    "GainAuto": "Off",            # "Off", "Once", "Continuous"
    "Gain": 0.0,                  # Ganancia cruda (valor flotante)
    "EnableFrameRate": True,      # Activar control de fotogramas por segundo
    "FrameRate": 5.0,             # Límite de fotogramas por segundo
}
# =====================================================================

def check_connection():
    """ Comprueba si la cámara Basler está disponible sin extraer imagen. """
    if not PYPYLON_AVAILABLE:
        return False, "pypylon no instalado"
    try:
        factory = pylon.TlFactory.GetInstance()
        ip = CAMERA_CONFIG.get("IPAddress", "").strip()
        
        if ip:
            info = pylon.DeviceInfo()
            info.SetPropertyValue('IpAddress', ip)
            devices = factory.EnumerateDevices([info])
        else:
            devices = factory.EnumerateDevices()
            
        if len(devices) > 0:
            return True, f"Cámara detectada ({devices[0].GetFriendlyName()})"
        return False, "No se encontraron cámaras conectadas"
    except Exception as e:
        return False, str(e)

def capture_basler_frame():
    """ Conecta a la cámara Basler, reajusta resolución/exposición y extrae 1 Frame. """
    if not PYPYLON_AVAILABLE:
        raise Exception("La librería pypylon no está instalada.")
        
    try:
        # 1. Iniciar fábrica e identificar cámara
        factory = pylon.TlFactory.GetInstance()
        ip = CAMERA_CONFIG.get("IPAddress", "").strip()
        
        if ip:
            info = pylon.DeviceInfo()
            info.SetPropertyValue('IpAddress', ip)
            devices = factory.EnumerateDevices([info])
            if len(devices) == 0:
                print(f"[WARN] No se encontró cámara Basler en la IP {ip}.")
                return None
            cam = pylon.InstantCamera(factory.CreateFirstDevice(info))
        else:
            devices = factory.EnumerateDevices()
            if len(devices) == 0:
                print("[WARN] No se encontraron cámaras Basler conectadas.")
                return None
            cam = pylon.InstantCamera(factory.CreateFirstDevice())

        cam.Open()

        # 3. Configuración Inicial (basada en el diccionario CAMERA_CONFIG)
        try:
            cam.Width.Value = CAMERA_CONFIG["Width"]
            cam.Height.Value = CAMERA_CONFIG["Height"]
        except Exception as e:
            print(f"[WARN] Error seteando resolución: {e}")
        
        try:
            cam.ExposureAuto.Value = CAMERA_CONFIG["ExposureAuto"]
            cam.ExposureTimeAbs.Value = CAMERA_CONFIG["ExposureTime"]
        except Exception:
            # Compatibilidad si no existe TimeAbs
            try: cam.ExposureTime.Value = CAMERA_CONFIG["ExposureTime"]
            except: pass

        try:
            cam.GainAuto.Value = CAMERA_CONFIG["GainAuto"]
            cam.Gain.Value = CAMERA_CONFIG["Gain"]
        except Exception:
            try: cam.GainRaw.Value = int(CAMERA_CONFIG["Gain"])
            except: pass
            
        try:
            cam.AcquisitionFrameRateEnable.Value = CAMERA_CONFIG["EnableFrameRate"]
            cam.AcquisitionFrameRateAbs.Value = CAMERA_CONFIG["FrameRate"]
        except Exception: 
            try: cam.AcquisitionFrameRate.Value = CAMERA_CONFIG["FrameRate"]
            except: pass
            
        # 4. Iniciar la captura en estrategia "solo el último"
        cam.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
        
        # 5. Configurar el conversor formato para inyectar en Front/OpenCV
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
