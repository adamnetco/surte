// SistecPOS Core — runtime Tauri v2.
// El binario es genérico: NO contiene identidad de tenant. La organización se
// resuelve en runtime vía licencia (ver docs/desktop/multitenant-runtime.md).
//
// Comandos expuestos al frontend (ESC/POS crudo, sin diálogo del sistema):
//   - escpos_print_tcp(host, port, bytes)  → impresoras de red (RAW 9100)
//   - escpos_print_device(path, bytes)     → \\\\host\\share (Windows) o /dev/usb/lp0 (Linux)
//   - desktop_runtime_info()               → plataforma + versión

#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(serde::Serialize)]
struct RuntimeInfo {
    runtime: &'static str,
    platform: &'static str,
    version: &'static str,
}

#[tauri::command]
fn desktop_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        runtime: "tauri",
        platform: std::env::consts::OS,
        version: env!("CARGO_PKG_VERSION"),
    }
}

/// Envía bytes ESC/POS directamente al puerto RAW de una impresora térmica.
#[tauri::command]
fn escpos_print_tcp(host: String, port: Option<u16>, bytes: Vec<u8>) -> Result<usize, String> {
    let port = port.unwrap_or(9100);
    let addr = format!("{host}:{port}")
        .to_socket_addrs()
        .map_err(|e| format!("Host inválido: {e}"))?
        .next()
        .ok_or_else(|| "No se resolvió la dirección de la impresora".to_string())?;

    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("No se pudo conectar a {addr}: {e}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    stream
        .write_all(&bytes)
        .map_err(|e| format!("Error escribiendo en la impresora: {e}"))?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(bytes.len())
}

/// Escribe bytes ESC/POS en un dispositivo/recurso compartido de impresión.
#[tauri::command]
fn escpos_print_device(path: String, bytes: Vec<u8>) -> Result<usize, String> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .map_err(|e| format!("No se pudo abrir {path}: {e}"))?;
    file.write_all(&bytes)
        .map_err(|e| format!("Error escribiendo en {path}: {e}"))?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(bytes.len())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_runtime_info,
            escpos_print_tcp,
            escpos_print_device
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar SistecPOS Core");
}
