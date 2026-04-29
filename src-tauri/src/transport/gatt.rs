use async_std::future::timeout;
use futures::future::ready;
use futures::{channel::mpsc::channel, FutureExt};
use futures::{StreamExt, TryFutureExt};

use std::time::Duration;
use uuid::Uuid;

use bluest::{Adapter, ConnectionEvent, Device, DeviceId};

use tauri::{command, AppHandle, State};

fn parse_uuid(input: &str, label: &str) -> Result<Uuid, String> {
    Uuid::parse_str(input).map_err(|e| format!("Invalid {} UUID '{}': {}", label, input, e))
}

#[command]
pub async fn gatt_connect(
    id: String,
    service_uuid: String,
    char_uuid: String,
    app_handle: AppHandle,
    state: State<'_, super::commands::ActiveConnection<'_>>,
) -> Result<bool, String> {
    let svc_uuid = parse_uuid(&service_uuid, "service")?;
    let chrc_uuid = parse_uuid(&char_uuid, "characteristic")?;
    let adapter = Adapter::default().await.ok_or("Failed to access the BT adapter".to_string())?;

    adapter.wait_available().await.map_err(|e| format!("Failed to wait for the BT adapter access: {}", e.message()))?;

    let device_id: DeviceId = serde_json::from_str(&id).unwrap();
    let d = adapter.open_device(&device_id).await.map_err(|e| format!("Failed to open the device: {}", e.message()))?;

    if !d.is_connected().await {
        adapter.connect_device(&d).await.map_err(|e| format!("Failed to connect to the device: {}", e.message()))?;
    }

    let service = d
        .discover_services_with_uuid(svc_uuid)
        .await
        .map_err(|e| format!("Failed to find the device services: {}", e.message()))?
        .get(0)
        .cloned();

    if let Some(s) = service {
        let char = s
            .discover_characteristics_with_uuid(chrc_uuid)
            .await
            .map_err(|e| format!("Failed to find the studio service characteristics: {}", e.message()))?
            .get(0)
            .cloned();

        if let Some(c) = char {
            let c2 = c.clone();
            let ah1 = app_handle.clone();
            let notify_handle = tauri::async_runtime::spawn(async move {
                if let Ok(mut n) = c2.notify().await {
                    use tauri::Emitter;

                    while let Some(Ok(vn)) = n.next().await {
                        ah1.emit("connection_data", vn.clone());
                    }
                }
            });

            let ah2 = app_handle.clone();
            let disconnect_handle = tauri::async_runtime::spawn(async move {
                // Need to keep adapter from being dropped while active/connected
                let a = adapter;

                use tauri::Emitter;
                use tauri::Manager;

                if let Ok(mut events) = a.device_connection_events(&d).await {
                    while let Some(ev) = events.next().await {
                        if ev == ConnectionEvent::Disconnected {
                            let state = ah2.state::<super::commands::ActiveConnection>();
                            *state.conn.lock().await = None;

                            if let Err(e) = ah2.emit("connection_disconnected", ()) {
                                println!("ERROR RAISING! {:?}", e);
                            }

                            *state.conn.lock().await = None;
                        }
                    }
                };
            });

            let (send, mut recv) = channel(5);
            *state.conn.lock().await = Some(Box::new(send));
            tauri::async_runtime::spawn(async move {
                while let Some(data) = recv.next().await {
                    c.write(&data).await.expect("Write uneventfully");
                }

                disconnect_handle.abort();
                notify_handle.abort();
            });

            Ok(true)
        } else {
            Err("Failed to connect: Unable to locate the required studio GATT characteristic".to_string())
        }
    } else {
        Err("Failed to connect: Unable to locate the required studio GATT service".to_string())
    }
}

#[cfg(target_os = "macos")]
async fn check_connected(adapter: &Adapter, device: &Device) -> bool {
    if let Ok(()) = adapter.connect_device(&device).await {
        true
    } else {
        false
    }
}

#[cfg(not(target_os = "macos"))]
async fn check_connected(_: &Adapter, device: &Device) -> bool {
    device.is_connected().await
}

const ADAPTER_TIMEOUT: Duration = Duration::from_secs(2);

#[command]
pub async fn gatt_list_devices(
    service_uuid: String,
) -> Result<Vec<super::commands::AvailableDevice>, ()> {
    let svc_uuid = Uuid::parse_str(&service_uuid).map_err(|_| ())?;
    let adapter = Adapter::default()
        .map(|a| a.ok_or(()))
        .and_then(|a| async {
            timeout(ADAPTER_TIMEOUT, a.wait_available())
                .await
                .map_err(|_| ())
                .map(|_| a)
        })
        .await;

    let mut ret = vec![];

    if let Ok(a) = adapter {
        let svc_uuids = [svc_uuid];
        let devices = a
            .discover_devices(&svc_uuids)
            .await
            .expect("GET DEVICES!")
            .take_until(async_std::task::sleep(Duration::from_secs(2)))
            .filter_map(|d| ready(d.ok()));

        futures::pin_mut!(devices);

        while let Some(device) = devices.next().await {
            if check_connected(&a, &device).await {
                let label = device.name_async().await.unwrap_or("Unknown".to_string());
                let id = serde_json::to_string(&device.id()).unwrap();
                
                // For Bluetooth devices, we don't have the same level of detail as USB devices
                // Set these to None since they're not available in the same format
                let manufacturer = None;
                let serial_number = None;
                let vid = None;
                let pid = None;
                let communication = "Bluetooth".to_string();

                ret.push(super::commands::AvailableDevice { 
                    label, 
                    id,
                    manufacturer,
                    serial_number,
                    vid,
                    pid,
                    communication,
                });
            } else {
                println!("Device isn't connected: {:?}", device);
            }
        }
    }

    Ok(ret)
}
