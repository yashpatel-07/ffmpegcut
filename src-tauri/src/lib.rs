use serde_json::Value;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

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
        .invoke_handler(tauri::generate_handler![
            pick_video,
            pick_output_path,
            get_duration,
            get_file_size,
            get_frame_rate,
            cut_video,
            cut_video_segments
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
