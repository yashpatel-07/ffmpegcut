use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use percent_encoding::percent_decode_str;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::net::TcpListener;
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

const MIME_TYPES: &[(&str, &str)] = &[
    ("mp4", "video/mp4"),
    ("mov", "video/quicktime"),
    ("mkv", "video/x-matroska"),
    ("avi", "video/x-msvideo"),
    ("webm", "video/webm"),
    ("m4v", "video/mp4"),
    ("mts", "video/mp2t"),
    ("m2ts", "video/mp2t"),
    ("ts", "video/mp2t"),
    ("wmv", "video/x-ms-wmv"),
    ("flv", "video/x-flv"),
];

fn mime_for_path(path: &str) -> &'static str {
    match path.rfind('.') {
        Some(pos) => {
            let ext = &path[pos + 1..].to_lowercase();
            MIME_TYPES
                .iter()
                .find(|(e, _)| e == ext)
                .map(|(_, m)| *m)
                .unwrap_or("application/octet-stream")
        }
        None => "application/octet-stream",
    }
}

#[derive(serde::Deserialize)]
struct ServeParams {
    path: String,
}

async fn serve_video(
    Query(params): Query<ServeParams>,
    headers: HeaderMap,
) -> Response {
    let decoded: String = match percent_decode_str(&params.path).decode_utf8() {
        Ok(s) => s.into_owned(),
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };

    let file_meta: std::fs::Metadata = match tokio::fs::metadata(&decoded).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::NOT_FOUND, "File not found").into_response(),
    };

    let file_len: u64 = file_meta.len();
    let mime: &str = mime_for_path(&decoded);

    let range: Option<(u64, u64)> = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| parse_range(v, file_len));

    match range {
        Some((start, end)) => {
            let chunk_size: u64 = end - start + 1;
            let mut file: File = File::open(&decoded).await.unwrap();
            file.seek(std::io::SeekFrom::Start(start)).await.unwrap();
            let limited = file.take(chunk_size);

            let response_headers: HeaderMap = HeaderMap::from_iter([
                (
                    header::CONTENT_RANGE,
                    format!("bytes {}-{}/{}", start, end, file_len)
                        .parse()
                        .unwrap(),
                ),
                (header::CONTENT_TYPE, mime.parse().unwrap()),
                (header::ACCEPT_RANGES, "bytes".parse().unwrap()),
                (header::CONTENT_LENGTH, chunk_size.to_string().parse().unwrap()),
            ]);

            (
                StatusCode::PARTIAL_CONTENT,
                response_headers,
                Body::from_stream(ReaderStream::new(limited)),
            )
                .into_response()
        }
        None => {
            let file: File = File::open(&decoded).await.unwrap();
            let response_headers: HeaderMap = HeaderMap::from_iter([
                (header::CONTENT_TYPE, mime.parse().unwrap()),
                (header::ACCEPT_RANGES, "bytes".parse().unwrap()),
                (header::CONTENT_LENGTH, file_len.to_string().parse().unwrap()),
            ]);

            (
                StatusCode::OK,
                response_headers,
                Body::from_stream(ReaderStream::new(file)),
            )
                .into_response()
        }
    }
}

fn parse_range(range: &str, file_len: u64) -> Option<(u64, u64)> {
    let range = range.strip_prefix("bytes=")?;
    let (start_str, end_str) = range.split_once('-')?;
    let start: u64 = start_str.parse().ok()?;
    let end: u64 = if end_str.is_empty() {
        file_len - 1
    } else {
        end_str.parse().ok()?
    };
    if start >= file_len || end >= file_len || start > end {
        return None;
    }
    Some((start, end))
}

pub async fn start_server() -> u16 {
    let app: Router = Router::new()
        .route("/", get(serve_video))
        .layer(CorsLayer::permissive());

    let listener: TcpListener = TcpListener::bind("localhost:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let port: u16 = addr.port();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    port
}