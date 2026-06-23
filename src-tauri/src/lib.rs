use std::env;
use std::fs::{self, OpenOptions};
use std::io::{Error as IoError, ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const BACKEND_HOST: &str = "127.0.0.1";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
const POLL_INTERVAL: Duration = Duration::from_millis(500);
const STARTUP_LOG_NAME: &str = "desktop-startup.log";
const BACKEND_LOG_NAME: &str = "desktop-backend.log";
const APP_DATA_DIR_ENV: &str = "BIECHIHUI_APP_DATA_DIR";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
struct BackendProcess {
  child: Mutex<Option<Child>>,
}

pub struct LaunchCommand {
  pub program: PathBuf,
  pub args: Vec<String>,
  pub envs: Vec<(String, String)>,
  pub current_dir: Option<PathBuf>,
}

pub enum BackendMode {
  Debug { port: u16 },
  Release {
    resources_dir: PathBuf,
    executable_dir: PathBuf,
    port: u16,
    app_data_dir: PathBuf,
  },
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  log_startup("desktop shell booting");
  tauri::Builder::default()
    .manage(BackendProcess::default())
    .setup(|app| {
      log_startup("tauri setup begin");
      let backend_port = ensure_backend(app)?;
      log_startup(&format!("backend ready on port {backend_port}"));

      let backend_origin = format!("http://{BACKEND_HOST}:{backend_port}");
      let init_script = format!("window.__BIECHIHUI_API_BASE__ = {:?};", backend_origin);
      let url = window_url()?;

      let window = WebviewWindowBuilder::new(app, "main", url)
        .title("别吃灰")
        .inner_size(1440.0, 960.0)
        .min_inner_size(1200.0, 800.0)
        .resizable(true)
        .visible(false)
        .initialization_script(init_script)
        .build()
        .map_err(|error| IoError::new(ErrorKind::Other, format!("failed to build main window: {error}")))?;

      window.show()?;
      window.set_focus()?;
      log_startup("main window shown");

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      match event {
        tauri::RunEvent::WindowEvent {
          label,
          event: WindowEvent::CloseRequested { api, .. },
          ..
        } if label == "main" => {
          api.prevent_close();
          log_startup("main window close requested; exiting application");
          cleanup_backend(app_handle);
          app_handle.exit(0);
        }
        tauri::RunEvent::Exit => {
          cleanup_backend(app_handle);
        }
        _ => {}
      }
    });
}

fn ensure_backend(app: &tauri::App) -> Result<u16, IoError> {
  let backend_port = reserve_backend_port().map_err(|message| IoError::new(ErrorKind::AddrNotAvailable, message))?;
  let child = spawn_backend(backend_port, app).map_err(|message| IoError::new(ErrorKind::NotFound, message))?;
  {
    let backend = app.state::<BackendProcess>();
    let mut slot = backend
      .child
      .lock()
      .map_err(|_| IoError::new(ErrorKind::Other, "failed to store backend process handle"))?;
    *slot = Some(child);
  }

  wait_for_backend(backend_port).map_err(|message| {
    cleanup_backend(app.handle());
    IoError::new(ErrorKind::TimedOut, message)
  })?;

  Ok(backend_port)
}

fn cleanup_backend(app: &tauri::AppHandle) {
  let backend = app.state::<BackendProcess>();
  let lock_result = backend.child.lock();
  if let Ok(mut slot) = lock_result {
    if let Some(mut child) = slot.take() {
      log_startup("stopping managed backend process");
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

fn reserve_backend_port() -> Result<u16, String> {
  let listener = TcpListener::bind((BACKEND_HOST, 0)).map_err(|error| format!("failed to reserve backend port: {error}"))?;
  let port = listener
    .local_addr()
    .map_err(|error| format!("failed to inspect reserved backend port: {error}"))?
    .port();
  drop(listener);
  log_startup(&format!("reserved backend port {port}"));
  Ok(port)
}

fn spawn_backend(port: u16, app: &tauri::App) -> Result<Child, String> {
  let mode = if cfg!(debug_assertions) {
    BackendMode::Debug { port }
  } else {
    let resources_dir = app
      .path()
      .resource_dir()
      .map_err(|error| format!("failed to resolve resource dir: {error}"))?;
    let app_data_dir = app
      .path()
      .app_data_dir()
      .map_err(|error| format!("failed to resolve app data dir: {error}"))?
      .join("backend");
    let executable_dir = current_executable_dir()?;
    BackendMode::Release {
      resources_dir,
      executable_dir,
      port,
      app_data_dir,
    }
  };

  let launch = backend_command_for_mode(mode)?;
  let backend_log_path = backend_log_path(&launch)?;
  if let Some(parent) = backend_log_path.parent() {
    fs::create_dir_all(parent).map_err(|error| format!("unable to create backend log dir {}: {error}", parent.display()))?;
  }
  let stdout = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&backend_log_path)
    .map_err(|error| format!("unable to open backend log {}: {error}", backend_log_path.display()))?;
  let stderr = stdout
    .try_clone()
    .map_err(|error| format!("unable to clone backend log handle {}: {error}", backend_log_path.display()))?;

  log_startup(&format!("launching backend executable {}", launch.program.display()));
  let mut command = Command::new(&launch.program);
  command
    .args(&launch.args)
    .stdin(Stdio::null())
    .stdout(Stdio::from(stdout))
    .stderr(Stdio::from(stderr));
  #[cfg(windows)]
  command.creation_flags(CREATE_NO_WINDOW);

  if let Some(current_dir) = &launch.current_dir {
    command.current_dir(current_dir);
  }
  for (key, value) in &launch.envs {
    command.env(key, value);
  }

  command
    .spawn()
    .map_err(|error| format!("failed to spawn backend {}: {error}", launch.program.display()))
}

fn project_root() -> Result<PathBuf, String> {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("..")
    .canonicalize()
    .map_err(|error| format!("unable to resolve project root: {error}"))
}

fn current_executable_dir() -> Result<PathBuf, String> {
  env::current_exe()
    .map_err(|error| format!("failed to resolve current desktop executable path: {error}"))?
    .parent()
    .map(|path| path.to_path_buf())
    .ok_or_else(|| "desktop executable has no parent directory".to_string())
}

struct PythonLaunchCandidate {
  program: PathBuf,
  description: String,
}

pub fn backend_command_for_mode(mode: BackendMode) -> Result<LaunchCommand, String> {
  match mode {
    BackendMode::Release {
      resources_dir,
      executable_dir,
      port,
      app_data_dir,
    } => Ok(LaunchCommand {
      program: resolve_bundled_backend_path(&resources_dir, &executable_dir)?,
      args: vec![],
      envs: vec![
        ("PORT".into(), port.to_string()),
        (APP_DATA_DIR_ENV.into(), app_data_dir.to_string_lossy().to_string()),
      ],
      current_dir: Some(app_data_dir),
    }),
    BackendMode::Debug { port } => {
      let project_root = project_root()?;
      let debug_data_dir = project_root.join("backend").join("data");
      let candidates = python_launch_candidates();
      let launch = candidates
        .into_iter()
        .find_map(|candidate| {
          let args = if candidate.description.contains("py launcher") {
            vec!["-3".into(), "-m".into(), "backend.app.run".into()]
          } else {
            vec!["-m".into(), "backend.app.run".into()]
          };

          Some(LaunchCommand {
            program: candidate.program,
            args,
            envs: vec![
              ("PORT".into(), port.to_string()),
              (APP_DATA_DIR_ENV.into(), debug_data_dir.to_string_lossy().to_string()),
            ],
            current_dir: Some(project_root.clone()),
          })
        })
        .ok_or_else(|| "unable to locate python runtime".to_string())?;

      Ok(launch)
    }
  }
}

fn resolve_bundled_backend_path(resources_dir: &Path, executable_dir: &Path) -> Result<PathBuf, String> {
  let mut candidate_paths = Vec::new();
  for backend_binary_name in bundled_backend_binary_names() {
    candidate_paths.extend([
      resources_dir.join("backend").join(backend_binary_name),
      resources_dir.join("backend").join("dist").join(backend_binary_name),
      resources_dir.join(backend_binary_name),
      resources_dir.join("_up_").join("backend").join(backend_binary_name),
      resources_dir.join("_up_").join("backend").join("dist").join(backend_binary_name),
      resources_dir.join("_up_").join(backend_binary_name),
      executable_dir.join("backend").join(backend_binary_name),
      executable_dir.join("backend").join("dist").join(backend_binary_name),
      executable_dir.join(backend_binary_name),
      executable_dir.join("_up_").join("backend").join(backend_binary_name),
      executable_dir.join("_up_").join("backend").join("dist").join(backend_binary_name),
      executable_dir.join("_up_").join(backend_binary_name),
    ]);
  }

  candidate_paths
    .iter()
    .find(|candidate| candidate.exists())
    .cloned()
    .ok_or_else(|| {
      let inspected_paths = candidate_paths
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");
      format!("unable to locate bundled backend executable; inspected: {inspected_paths}")
    })
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn bundled_backend_binary_names() -> [&'static str; 2] {
  ["desktop-backend-x86_64-pc-windows-msvc.exe", "desktop-backend.exe"]
}

#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
fn bundled_backend_binary_names() -> [&'static str; 2] {
  ["desktop-backend-aarch64-pc-windows-msvc.exe", "desktop-backend.exe"]
}

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
fn bundled_backend_binary_names() -> [&'static str; 2] {
  ["desktop-backend-x86_64-apple-darwin", "desktop-backend"]
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn bundled_backend_binary_names() -> [&'static str; 2] {
  ["desktop-backend-aarch64-apple-darwin", "desktop-backend"]
}

#[cfg(not(any(
  all(target_os = "windows", any(target_arch = "x86_64", target_arch = "aarch64")),
  all(target_os = "macos", any(target_arch = "x86_64", target_arch = "aarch64"))
)))]
fn bundled_backend_binary_names() -> [&'static str; 1] {
  ["desktop-backend"]
}

fn python_launch_candidates() -> Vec<PythonLaunchCandidate> {
  let mut candidates = Vec::new();

  if let Some(current_python) = discover_python_on_path("python") {
    candidates.push(PythonLaunchCandidate {
      description: format!("python on PATH ({})", current_python.display()),
      program: current_python,
    });
  }

  if let Some(py_launcher) = discover_python_on_path("py") {
    candidates.push(PythonLaunchCandidate {
      description: format!("py launcher on PATH ({})", py_launcher.display()),
      program: py_launcher,
    });
  }

  for path in common_python_locations() {
    if path.exists() {
      candidates.push(PythonLaunchCandidate {
        description: format!("common install path ({})", path.display()),
        program: path,
      });
    }
  }

  candidates
}

fn discover_python_on_path(command: &str) -> Option<PathBuf> {
  let output = Command::new("where").arg(command).output().ok()?;
  if !output.status.success() {
    return None;
  }

  let stdout = String::from_utf8_lossy(&output.stdout).to_string();
  let first = stdout.lines().map(str::trim).find(|line| !line.is_empty())?;

  Some(PathBuf::from(first))
}

fn common_python_locations() -> Vec<PathBuf> {
  let mut paths = Vec::new();

  if let Some(home) = env::var_os("USERPROFILE") {
    let userprofile = PathBuf::from(home);
    paths.push(userprofile.join("AppData").join("Local").join("Programs").join("Python").join("Python311").join("python.exe"));
    paths.push(userprofile.join("AppData").join("Local").join("Programs").join("Python").join("Python310").join("python.exe"));
    paths.push(userprofile.join("AppData").join("Roaming").join("uv").join("python").join("cpython-3.11-windows-x86_64-none").join("python.exe"));
  }

  if let Some(program_files) = env::var_os("ProgramFiles") {
    let program_files = PathBuf::from(program_files);
    paths.push(program_files.join("Python39").join("python.exe"));
    paths.push(program_files.join("Python310").join("python.exe"));
    paths.push(program_files.join("Python311").join("python.exe"));
  }

  dedupe_existing_paths(paths)
}

fn dedupe_existing_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
  let mut seen = Vec::<PathBuf>::new();
  let mut unique = Vec::new();

  for path in paths {
    if seen.iter().any(|existing| existing == &path) {
      continue;
    }
    seen.push(path.clone());
    unique.push(path);
  }

  unique
}

fn backend_log_path(launch: &LaunchCommand) -> Result<PathBuf, String> {
  if let Some((_, data_dir)) = launch.envs.iter().find(|(key, _)| key == APP_DATA_DIR_ENV) {
    return Ok(PathBuf::from(data_dir).join(BACKEND_LOG_NAME));
  }

  project_root().map(|root| root.join("backend").join("data").join(BACKEND_LOG_NAME))
}

fn log_startup(message: &str) {
  let Some(log_path) = startup_log_path() else {
    return;
  };

  if let Some(parent) = log_path.parent() {
    let _ = fs::create_dir_all(parent);
  }

  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
    let _ = writeln!(file, "{}", message);
  }
}

fn startup_log_path() -> Option<PathBuf> {
  if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
    return Some(PathBuf::from(local_app_data).join("Biechihui").join("logs").join(STARTUP_LOG_NAME));
  }

  Some(project_root().ok()?.join("backend").join("data").join(STARTUP_LOG_NAME))
}

fn wait_for_backend(port: u16) -> Result<(), String> {
  let deadline = Instant::now() + STARTUP_TIMEOUT;
  while Instant::now() < deadline {
    if probe_backend(port) {
      return Ok(());
    }

    thread::sleep(POLL_INTERVAL);
  }

  Err(format!("backend did not become healthy on port {port} within {} seconds.", STARTUP_TIMEOUT.as_secs()))
}

fn probe_backend(port: u16) -> bool {
  let address = format!("{BACKEND_HOST}:{port}");
  let mut stream = match TcpStream::connect(&address) {
    Ok(stream) => stream,
    Err(_) => return false,
  };

  let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
  let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

  let request = format!("GET /health HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\nAccept: application/json\r\n\r\n");
  if stream.write_all(request.as_bytes()).is_err() {
    return false;
  }

  let mut response = String::new();
  if stream.read_to_string(&mut response).is_err() {
    return false;
  }

  response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

fn window_url() -> Result<WebviewUrl, IoError> {
  if cfg!(debug_assertions) {
    let dev_url = Url::parse("http://127.0.0.1:5173")
      .map_err(|error| IoError::new(ErrorKind::InvalidInput, format!("invalid dev url: {error}")))?;
    log_startup("loading frontend from Vite dev server");
    return Ok(WebviewUrl::External(dev_url));
  }

  log_startup("loading frontend from bundled dist assets");
  Ok(WebviewUrl::App("index.html".into()))
}
