mod video_server;

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent, TerminatedPayload};
use tauri_plugin_shell::ShellExt;

struct ServerPort(u16);
struct PreviewCache(Mutex<std::collections::HashMap<String, String>>);
struct PreviewProcess(Mutex<Option<(CommandChild, String)>>);
const NEEDS_REMUX: &[&str] = &["mkv", "avi", "wmv", "flv", "ts", "m2ts", "mts"];

fn needs_remux(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| NEEDS_REMUX.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[tauri::command]
async fn get_video_url(path: String, port: State<'_, ServerPort>) -> Result<String, String> {
    let encoded: String = urlencoding::encode(&path).to_string();
    Ok(format!("http://localhost:{}/?path={}", port.0, encoded))
}

#[tauri::command]
async fn cancel_preview(proc: State<'_, PreviewProcess>) -> Result<(), String> {
    let entry = {
        let mut guard = proc.0.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    if let Some((child, out_path)) = entry {
        // Ignore errors from killing an already-exited process.
        let _ = child.kill();
        let _ = tokio::fs::remove_file(&out_path).await;
    }
    Ok(())
}

#[tauri::command]
async fn generate_preview(
    app: tauri::AppHandle,
    path: String,
    cache: State<'_, PreviewCache>,
    proc: State<'_, PreviewProcess>,
) -> Result<String, String> {
    if !needs_remux(&path) {
        return Ok(path);
    }
 
    if let Some(cached) = {
        let map = cache.0.lock().map_err(|e| e.to_string())?;
        map.get(&path).cloned()
    } {
        if tokio::fs::metadata(&cached).await.is_ok() {
            return Ok(cached);
        }
        // Cached file vanished (e.g. temp dir cleared) — fall through and
        // regenerate it.
    }
 
    // Kill any previous in-flight remux before starting this one, and
    // clean up whatever partial file it had been writing.
    {
        let previous = {
            let mut guard = proc.0.lock().map_err(|e| e.to_string())?;
            guard.take()
        };
        if let Some((previous_child, previous_out_path)) = previous {
            let _ = previous_child.kill();
            let _ = tokio::fs::remove_file(&previous_out_path).await;
        }
    }
 
    let mut out_path: PathBuf = std::env::temp_dir();
    let stem = Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("preview");
    out_path.push(format!(
        "ffmpegcut_preview_{}_{}.mp4",
        std::process::id(),
        stem
    ));
    let out_str = out_path.to_string_lossy().to_string();
 
    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-i",
            &path,
            // Explicit stream mapping avoids ambiguity
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-c:v",
            "copy",
            // Force AAC stereo — sidesteps browsers failing to decode
            // unusual surround layouts (5.0/5.1/E-AC-3 etc.) even after
            // the codec itself is transcoded.
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            &out_str,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;
 
    {
        let mut guard = proc.0.lock().map_err(|e| e.to_string())?;
        *guard = Some((child, out_str.clone()));
    }
 
    let mut stderr_buf = String::new();
    let mut exited_with: Option<TerminatedPayload> = None;
 
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(bytes) => {
                stderr_buf.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Terminated(payload) => {
                exited_with = Some(payload);
            }
            _ => {}
        }
    }
 
    {
        let mut guard = proc.0.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
 
    let success = exited_with
        .as_ref()
        .and_then(|p| p.code)
        .map(|c| c == 0)
        .unwrap_or(false);
 
    if !success {
        // Clean up whatever partial file ffmpeg may have written before failing
        let _ = tokio::fs::remove_file(&out_str).await;
        return Err(format!("ffmpeg remux failed: {stderr_buf}"));
    }
 
    {
        let mut map = cache.0.lock().map_err(|e| e.to_string())?;
        map.insert(path, out_str.clone());
    }
 
    Ok(out_str)
}

#[tauri::command]
async fn pick_video(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Video", &["mp4", "mov", "mkv", "avi", "webm", "m4v", "mts", "m2ts", "ts", "wmv", "flv"])
        .blocking_pick_file();
    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
async fn pick_output_path(app: tauri::AppHandle, default_name: String) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("MP4 Video", &["mp4"])
        .set_file_name(default_name)
        .blocking_save_file();
    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
async fn get_duration(app: tauri::AppHandle, path: String) -> Result<f64, String> {
    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| e.to_string())?
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            &path,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    parsed["format"]["duration"]
        .as_str()
        .and_then(|d| d.parse::<f64>().ok())
        .ok_or_else(|| "Could not parse duration".to_string())
}

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_frame_rate(app: tauri::AppHandle, path: String) -> Result<f64, String> {
    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| e.to_string())?
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            &path,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;

    let streams = parsed["streams"]
        .as_array()
        .ok_or_else(|| "No streams found".to_string())?;

    for stream in streams {
        if stream["codec_type"].as_str() == Some("video") {
            let fps_str = stream["avg_frame_rate"]
                .as_str()
                .or_else(|| stream["r_frame_rate"].as_str())
                .ok_or_else(|| "No frame rate found".to_string())?;

            let parts: Vec<&str> = fps_str.split('/').collect();
            if parts.len() == 2 {
                let num: f64 = parts[0].parse().map_err(|_| "Invalid frame rate".to_string())?;
                let den: f64 = parts[1].parse().map_err(|_| "Invalid frame rate".to_string())?;
                if den == 0.0 {
                    return Err("Invalid frame rate denominator".to_string());
                }
                return Ok(num / den);
            }
            return fps_str
                .parse::<f64>()
                .map_err(|_| "Invalid frame rate".to_string());
        }
    }
    Err("No video stream found".to_string())
}

#[tauri::command]
async fn cut_video(
    app: tauri::AppHandle,
    input: String,
    output: String,
    start: f64,
    end: f64,
) -> Result<(), String> {
    let start_str = format!("{:.6}", start);
    let end_str = format!("{:.6}", end);

    let result = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-ss",
            &start_str,
            "-to",
            &end_str,
            "-i",
            &input,
            "-c",
            "copy",
            "-y",
            &output,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("ffmpeg failed: {}", stderr));
    }
    Ok(())
}

#[tauri::command]
async fn cut_video_segments(
    app: tauri::AppHandle,
    input: String,
    output: String,
    segments: Vec<(f64, f64)>,
) -> Result<(), String> {
    if segments.is_empty() {
        return Err("No segments to cut".to_string());
    }

    let mut concat_path = std::env::temp_dir();
    concat_path.push(format!("ffmpegcut_concat_{}.txt", std::process::id()));

    let mut content = String::from("ffconcat version 1.0\n");
    for (start, end) in &segments {
        content.push_str(&format!("file '{}'\n", input.replace('\'', "'\\''")));
        content.push_str(&format!("inpoint {:.6}\n", start));
        content.push_str(&format!("outpoint {:.6}\n", end));
    }

    std::fs::write(&concat_path, &content).map_err(|e| e.to_string())?;

    let concat_str = concat_path.to_string_lossy().to_string();
    let result = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-f", "concat",
            "-safe", "0",
            "-i", &concat_str,
            "-c", "copy",
            "-f", "mp4",
            "-y",
            &output,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(&concat_path);

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("ffmpeg failed: {}", stderr));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            // let port = tauri::async_runtime::block_on(async move {
            //     video_server::start_server().await
            // });
            let port = tauri::async_runtime::block_on(video_server::start_server());
            handle.manage(ServerPort(port));
            handle.manage(PreviewCache(Mutex::new(std::collections::HashMap::new())));
            handle.manage(PreviewProcess(Mutex::new(None)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_video,
            pick_output_path,
            get_duration,
            get_file_size,
            get_frame_rate,
            cut_video,
            cut_video_segments,
            get_video_url,
            generate_preview,
            cancel_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}