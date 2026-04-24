from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import random
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datos de prueba del ERP (Mock NG6OF1)
mock_erp_data = {
    "fecha_montaje": "20260424",
    "secuencia": "0001",
    "modelo": "FB16A-12",
    "bastidor": "LOG-1234567890-ESP",
    "mastil": "TF500",
    "altura_max_interm": 5000,
    "capac_interm_1": 1600,
    "tpo_elevac_min": 5.0,
    "tpo_elevac_max": 7.0,
    "tpo_descenso_min": 4.5,
    "tpo_descenso_max": 6.0,
    "tpo_incl_adel_max": 2.5,
    "tpo_incl_atras_max": 3.0,
    "tpo_elev_min_scarga": 4.0,
    "tpo_elev_max_scarga": 5.5,
    "tpo_desc_min_scarga": 3.5,
    "tpo_desc_max_scarga": 5.0
}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Send ERP data immediately
    await websocket.send_json({
        "type": "erp",
        "data": mock_erp_data
    })
    
    start_time = time.time()
    distance = 0.0
    direction = 1 # 1 para subir, -1 para bajar
    state = "ASCENDIENDO"

    try:
        while True:
            # Simular telemetría del láser (0 a 5000mm)
            distance += (random.uniform(50, 150) * direction)
            if distance >= 5000:
                distance = 5000
                direction = -1
                state = "DESCENDIENDO"
            elif distance <= 0:
                distance = 0
                direction = 1
                state = "ASCENDIENDO"
                
            elapsed = time.time() - start_time
            
            await websocket.send_json({
                "type": "telemetry",
                "distance": distance,
                "timer": elapsed,
                "state": state
            })
            
            # 10 Hz refresh rate for smooth animation
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
