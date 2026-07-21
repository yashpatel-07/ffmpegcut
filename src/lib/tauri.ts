import { invoke } from "@tauri-apps/api/core";

export async function pickVideo(): Promise<string | null> {
  return invoke("pick_video");
}

export async function pickOutputPath(defaultName: string): Promise<string | null> {
  return invoke("pick_output_path", { defaultName });
}

export async function getDuration(path: string): Promise<number> {
  return invoke("get_duration", { path });
}

export async function getFileSize(path: string): Promise<number> {
  return invoke("get_file_size", { path });
}

export async function getFrameRate(path: string): Promise<number> {
  return invoke("get_frame_rate", { path });
}

export async function getVideoUrl(path: string): Promise<string> {
  return invoke("get_video_url", { path });
}

export async function generatePreview(path: string): Promise<string> {
  return invoke("generate_preview", { path });
}

export async function cancelPreview(): Promise<void> {
  return invoke("cancel_preview");
}

export async function cutVideoSegments(
  input: string,
  output: string,
  segments: [number, number][],
): Promise<void> {
  return invoke("cut_video_segments", { input, output, segments });
}