use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use biechihui_desktop_lib::{backend_command_for_mode, BackendMode};

#[test]
fn release_mode_prefers_bundled_backend_executable() {
    let resources = unique_temp_dir("release-direct");
    let executable = resources.clone();
    let app_data_dir = PathBuf::from(r"C:\Users\Example\AppData\Local\Biechihui\backend");
    let direct_backend = resources.join("backend").join("desktop-backend.exe");
    fs::create_dir_all(direct_backend.parent().unwrap()).unwrap();
    fs::write(&direct_backend, b"stub").unwrap();
    let command = backend_command_for_mode(BackendMode::Release {
        resources_dir: resources.clone(),
        executable_dir: executable,
        port: 18001,
        app_data_dir: app_data_dir.clone(),
    })
    .unwrap();

    assert_eq!(command.program, direct_backend);
    assert_eq!(command.args, Vec::<String>::new());
    assert_eq!(command.current_dir, Some(app_data_dir));

    let _ = fs::remove_dir_all(resources);
}

#[test]
fn release_mode_supports_nsis_installed_backend_layout() {
    let install_root = unique_temp_dir("release-nsis");
    let resources = install_root.clone();
    let app_data_dir = PathBuf::from(r"C:\Users\Example\AppData\Local\Biechihui\backend");
    let nsis_backend = install_root
        .join("_up_")
        .join("backend")
        .join("dist")
        .join("desktop-backend.exe");
    fs::create_dir_all(nsis_backend.parent().unwrap()).unwrap();
    fs::write(&nsis_backend, b"stub").unwrap();

    let command = backend_command_for_mode(BackendMode::Release {
        resources_dir: resources,
        executable_dir: install_root.clone(),
        port: 18001,
        app_data_dir,
    })
    .unwrap();

    assert_eq!(command.program, nsis_backend);

    let _ = fs::remove_dir_all(install_root);
}

#[test]
fn release_mode_supports_backend_executable_at_install_root() {
    let install_root = unique_temp_dir("release-root-backend");
    let resources = install_root.clone();
    let app_data_dir = PathBuf::from(r"C:\Users\Example\AppData\Local\Biechihui\backend");
    let backend = install_root.join("desktop-backend.exe");
    fs::create_dir_all(&install_root).unwrap();
    fs::write(&backend, b"stub").unwrap();

    let command = backend_command_for_mode(BackendMode::Release {
        resources_dir: resources,
        executable_dir: install_root.clone(),
        port: 18001,
        app_data_dir,
    })
    .unwrap();

    assert_eq!(command.program, backend);

    let _ = fs::remove_dir_all(install_root);
}

#[test]
fn debug_mode_keeps_python_module_launch() {
    let command = backend_command_for_mode(BackendMode::Debug { port: 18001 }).unwrap();

    assert!(command.program.ends_with("python.exe") || command.program.ends_with("py.exe"));
    assert!(command.args.iter().any(|item| item == "backend.app.run"));
}

fn unique_temp_dir(label: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    env::temp_dir().join(format!("biechihui-backend-launch-{label}-{millis}"))
}
