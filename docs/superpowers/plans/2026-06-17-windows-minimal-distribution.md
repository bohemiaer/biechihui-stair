# Windows Minimal Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-only minimal distributable desktop app that installs cleanly, launches without a user-managed Python runtime, starts a bundled backend automatically, and lets the user configure the minimum API key inside the app.

**Architecture:** Keep the current React + Tauri + FastAPI split, but separate development-mode startup from distribution-mode startup. Package the Python backend as a standalone Windows executable, include it in the Tauri bundle resources, switch runtime data/config/log paths to an app-owned writable directory, and make the desktop shell launch the bundled backend in release mode while preserving the current Python-based developer workflow in debug mode.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vitest, Python, FastAPI, PyInstaller, PowerShell

---

## File Structure

**Create**

- `backend/app/app_paths.py`
  Responsibility: Resolve writable runtime directories for config, logs, product data, and RAG data in both dev and distributable modes.
- `backend/build_windows_backend.ps1`
  Responsibility: Build the Python backend into a Windows executable using PyInstaller.
- `backend/desktop_backend.spec`
  Responsibility: PyInstaller spec file that includes the backend entrypoint and required package data.
- `backend/tests/test_app_paths.py`
  Responsibility: Verify runtime directory resolution for dev and distributable modes.
- `src-tauri/tests/backend_launch.rs`
  Responsibility: Verify release-mode backend path selection and dev-mode fallback logic in the desktop shell.
- `docs/windows-distribution.md`
  Responsibility: Short user-facing install/configure/use instructions for the packaged Windows app.

**Modify**

- `backend/app/runtime_config.py`
  Responsibility: Stop writing runtime config to the repo-local `backend/data/runtime_config.json`; use resolved app data directory instead.
- `backend/app/store.py`
  Responsibility: Stop writing product data to repo-local `backend/data/product_store.sqlite3`; use resolved app data directory instead.
- `backend/reference/local_rag/config.py`
  Responsibility: Stop defaulting release-mode RAG data to repo-local `local_rag_data`; use resolved app data directory when a packaged data dir is provided.
- `backend/tests/test_product_api.py`
  Responsibility: Add regression tests for runtime config path and store path overrides.
- `src-tauri/src/lib.rs`
  Responsibility: Launch bundled backend executable in release mode, preserve Python launch in debug mode, move logs to app data, and fail with clearer startup errors.
- `src-tauri/Cargo.toml`
  Responsibility: Add test/dev dependencies if needed for path and startup logic coverage.
- `src-tauri/tauri.conf.json`
  Responsibility: Enable Windows bundle output and include backend executable/resources.
- `package.json`
  Responsibility: Add scripts for backend packaging and end-to-end desktop distribution build.
- `README.md`
  Responsibility: Replace dev-first startup guidance with packaged Windows usage guidance while keeping a short contributor note if needed.
- `src/pages/Settings.tsx`
  Responsibility: Make the settings page clearly guide the user to configure `SILICONFLOW_API_KEY` as the minimum usable setup.

---

### Task 1: Move backend data, config, and log paths out of the repo tree

**Files:**
- Create: `backend/app/app_paths.py`
- Modify: `backend/app/runtime_config.py`
- Modify: `backend/app/store.py`
- Modify: `backend/reference/local_rag/config.py`
- Create: `backend/tests/test_app_paths.py`
- Modify: `backend/tests/test_product_api.py`

- [ ] **Step 1: Write the failing backend path tests**

```python
from pathlib import Path

from backend.app.app_paths import BackendPaths, resolve_backend_paths


def test_resolve_backend_paths_prefers_explicit_base_dir(tmp_path: Path):
    paths = resolve_backend_paths(base_dir=tmp_path)

    assert paths.base_dir == tmp_path
    assert paths.product_db_path == tmp_path / "product_store.sqlite3"
    assert paths.runtime_config_path == tmp_path / "runtime_config.json"
    assert paths.logs_dir == tmp_path / "logs"
    assert paths.rag_data_dir == tmp_path / "local_rag"


def test_resolve_backend_paths_uses_env_override(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))

    paths = resolve_backend_paths()

    assert paths.base_dir == tmp_path
    assert paths.product_db_path.parent == tmp_path
    assert paths.runtime_config_path.parent == tmp_path
```

```python
from pathlib import Path

from backend.app.runtime_config import runtime_config_status, save_runtime_config
from backend.app.schemas import RuntimeConfigUpdate
from backend.app.store import ProductStore


def test_runtime_config_uses_override_path(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))

    status = save_runtime_config(RuntimeConfigUpdate(siliconflowApiKey="sf-test"))

    assert Path(status.configPath) == tmp_path / "runtime_config.json"
    assert (tmp_path / "runtime_config.json").exists()


def test_product_store_uses_override_path(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))

    store = ProductStore()

    assert store.data_path == tmp_path / "product_store.sqlite3"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest backend/tests/test_app_paths.py backend/tests/test_product_api.py -q`
Expected: FAIL because `backend/app/app_paths.py` does not exist and current code still points at repo-local `backend/data`.

- [ ] **Step 3: Write the minimal path resolution module**

```python
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BackendPaths:
    base_dir: Path
    logs_dir: Path
    product_db_path: Path
    runtime_config_path: Path
    rag_data_dir: Path


def _default_dev_base_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "backend" / "data"


def resolve_backend_paths(base_dir: Path | None = None) -> BackendPaths:
    root = Path(
        base_dir
        or os.getenv("BIECHIHUI_APP_DATA_DIR")
        or _default_dev_base_dir()
    ).resolve()

    return BackendPaths(
        base_dir=root,
        logs_dir=root / "logs",
        product_db_path=root / "product_store.sqlite3",
        runtime_config_path=root / "runtime_config.json",
        rag_data_dir=root / "local_rag",
    )
```

```python
from .app_paths import resolve_backend_paths

BACKEND_PATHS = resolve_backend_paths()
CONFIG_PATH = BACKEND_PATHS.runtime_config_path
```

```python
from .app_paths import resolve_backend_paths

class ProductStore:
    def __init__(self, data_path: Optional[Path] = None) -> None:
        default_path = resolve_backend_paths().product_db_path
        self.data_path = data_path or Path(os.getenv("BIECHIHUI_DATA_PATH", str(default_path)))
```

```python
from backend.app.app_paths import resolve_backend_paths

data_dir = Path(os.getenv("DATA_DIR", str(resolve_backend_paths().rag_data_dir)))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest backend/tests/test_app_paths.py backend/tests/test_product_api.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/app_paths.py backend/app/runtime_config.py backend/app/store.py backend/reference/local_rag/config.py backend/tests/test_app_paths.py backend/tests/test_product_api.py
git commit -m "feat: move desktop backend data paths into app-owned directories"
```

### Task 2: Package the Python backend into a standalone Windows executable

**Files:**
- Create: `backend/build_windows_backend.ps1`
- Create: `backend/desktop_backend.spec`
- Modify: `package.json`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Write the failing packaging smoke test**

```powershell
$ErrorActionPreference = 'Stop'
Remove-Item -Recurse -Force backend\dist\desktop-backend -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File backend\build_windows_backend.ps1
if (-not (Test-Path backend\dist\desktop-backend\desktop-backend.exe)) {
  throw "desktop-backend.exe was not generated"
}
```

- [ ] **Step 2: Run the packaging command to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File backend/build_windows_backend.ps1`
Expected: FAIL because the script and PyInstaller spec do not exist yet.

- [ ] **Step 3: Write the minimal packaging script and spec**

```powershell
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $PSScriptRoot 'dist'
$buildDir = Join-Path $PSScriptRoot 'build'
$specPath = Join-Path $PSScriptRoot 'desktop_backend.spec'

python -m pip install pyinstaller
python -m PyInstaller `
  --noconfirm `
  --clean `
  --distpath $distDir `
  --workpath $buildDir `
  $specPath
```

```python
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = collect_submodules("backend.reference.local_rag")

a = Analysis(
    ["backend/app/run.py"],
    pathex=["."],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="desktop-backend",
    console=False,
)
```

```json
{
  "scripts": {
    "backend:build-win": "powershell -ExecutionPolicy Bypass -File backend/build_windows_backend.ps1"
  }
}
```

- [ ] **Step 4: Run the packaging command to verify it passes**

Run: `npm run backend:build-win`
Expected: PASS and `backend/dist/desktop-backend/desktop-backend.exe` exists

- [ ] **Step 5: Validate the generated backend health endpoint**

Run: `cmd /c "set PORT=19001 && backend\\dist\\desktop-backend\\desktop-backend.exe"`
Expected: Process starts and keeps running

Run in a second terminal: `curl http://127.0.0.1:19001/health`
Expected: `{"ok":true}`

- [ ] **Step 6: Commit**

```bash
git add backend/build_windows_backend.ps1 backend/desktop_backend.spec package.json backend/requirements.txt
git commit -m "feat: package python backend as a windows executable"
```

### Task 3: Teach the Tauri shell to launch the bundled backend in release mode

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/tests/backend_launch.rs`

- [ ] **Step 1: Write the failing Rust launch-path tests**

```rust
use std::path::PathBuf;

use biechihui_desktop_lib::{backend_command_for_mode, BackendMode};

#[test]
fn release_mode_prefers_bundled_backend_executable() {
    let resources = PathBuf::from(r"C:\app\resources");
    let command = backend_command_for_mode(
        BackendMode::Release { resources_dir: resources.clone(), port: 18001 }
    ).unwrap();

    assert_eq!(command.program, resources.join("backend").join("desktop-backend.exe"));
    assert_eq!(command.args, Vec::<String>::new());
}

#[test]
fn debug_mode_keeps_python_module_launch() {
    let command = backend_command_for_mode(BackendMode::Debug { port: 18001 }).unwrap();

    assert!(command.program.ends_with("python.exe") || command.program.ends_with("py.exe"));
    assert!(command.args.iter().any(|item| item == "backend.app.run"));
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend_launch`
Expected: FAIL because `backend_command_for_mode` and `BackendMode` do not exist.

- [ ] **Step 3: Write the minimal desktop launch abstraction**

```rust
pub struct LaunchCommand {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub envs: Vec<(String, String)>,
}

pub enum BackendMode {
    Debug { port: u16 },
    Release { resources_dir: PathBuf, port: u16 },
}

pub fn backend_command_for_mode(mode: BackendMode) -> Result<LaunchCommand, String> {
    match mode {
        BackendMode::Release { resources_dir, port } => Ok(LaunchCommand {
            program: resources_dir.join("backend").join("desktop-backend.exe"),
            args: vec![],
            envs: vec![("PORT".into(), port.to_string())],
        }),
        BackendMode::Debug { port } => {
            let python = discover_python_on_path("python")
                .or_else(|| discover_python_on_path("py"))
                .ok_or_else(|| "unable to locate python runtime".to_string())?;
            let args = if python.ends_with("py.exe") {
                vec!["-3".into(), "-m".into(), "backend.app.run".into()]
            } else {
                vec!["-m".into(), "backend.app.run".into()]
            };

            Ok(LaunchCommand {
                program: python,
                args,
                envs: vec![("PORT".into(), port.to_string())],
            })
        }
    }
}
```

```rust
fn spawn_backend(port: u16, app: &tauri::App) -> Result<Child, String> {
    let mode = if cfg!(debug_assertions) {
        BackendMode::Debug { port }
    } else {
        let resources_dir = app
            .path()
            .resource_dir()
            .map_err(|error| format!("failed to resolve resource dir: {error}"))?;
        BackendMode::Release { resources_dir, port }
    };

    let launch = backend_command_for_mode(mode)?;
    let mut command = Command::new(&launch.program);
    command.args(&launch.args);
    for (key, value) in &launch.envs {
        command.env(key, value);
    }
    command.spawn().map_err(|error| format!("failed to spawn backend: {error}"))
}
```

- [ ] **Step 4: Run the Rust tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend_launch`
Expected: PASS

- [ ] **Step 5: Verify desktop startup still works in development mode**

Run: `npm run desktop:dev`
Expected: The Tauri window opens and the app remains reachable through the local backend

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/tests/backend_launch.rs
git commit -m "feat: launch bundled backend in desktop release mode"
```

### Task 4: Enable Windows bundle output and include backend resources

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `package.json`

- [ ] **Step 1: Write the failing bundle expectation**

```text
Distribution expectation:
- `npm run desktop:dist-win` builds the frontend
- packages the backend executable
- runs `tauri build`
- emits a Windows installer rather than only a raw target binary
```

- [ ] **Step 2: Run the missing distribution command to verify it fails**

Run: `npm run desktop:dist-win`
Expected: FAIL because the script does not exist yet.

- [ ] **Step 3: Write the minimal bundle configuration**

```json
{
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "resources": [
      "../backend/dist/desktop-backend/**"
    ]
  }
}
```

```json
{
  "scripts": {
    "desktop:dist-win": "npm run build && npm run backend:build-win && tauri build"
  }
}
```

- [ ] **Step 4: Run the Windows distribution build**

Run: `npm run desktop:dist-win`
Expected: PASS and a Windows installer appears under `src-tauri/target/release/bundle/`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json package.json
git commit -m "feat: enable windows installer bundling for desktop release"
```

### Task 5: Make minimum API configuration understandable for packaged users

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `README.md`
- Create: `docs/windows-distribution.md`

- [ ] **Step 1: Write the failing settings-page behavior test**

```tsx
it('highlights SiliconFlow API key as the minimum usable packaged configuration', async () => {
  render(<Settings />);

  expect(
    await screen.findByText('先填写 SiliconFlow API Key，即可开始使用导入、摘要、搜索和问答')
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the settings test to verify it fails**

Run: `npm run test -- src/pages/Settings.test.tsx`
Expected: FAIL because the current settings page explains several model fields but does not clearly prioritize the minimum packaged-user path.

- [ ] **Step 3: Write the minimal user-facing guidance**

```tsx
<div className="mt-4 rounded-xl border border-[#D0EBFF] bg-[#EEF7FF] px-4 py-3 text-[13px] text-[#1864AB]">
  先填写 SiliconFlow API Key，即可开始使用导入、摘要、搜索和问答。其余配置只在你需要独立 Chat、Embedding 或 Rerank 服务时再填写。
</div>
```

```md
## Windows 安装版快速使用

1. 安装应用
2. 打开桌面应用
3. 进入“设置”
4. 填写 `SILICONFLOW_API_KEY`
5. 返回首页开始导入和搜索
```

```md
# Windows 安装版说明

- 安装后直接打开应用
- 首次使用先去设置页填写 `SILICONFLOW_API_KEY`
- 如果未配置 API key，应用仍可打开，但导入、摘要、搜索和问答不会正常工作
```

- [ ] **Step 4: Run the frontend test to verify it passes**

Run: `npm run test -- src/pages/Settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Do a manual packaged-user walkthrough**

Run: `npm run desktop:dist-win`
Expected: PASS

Manual check:
- Install the generated Windows package
- Launch the app
- Confirm the app opens before API keys are configured
- Confirm the settings page clearly points to `SILICONFLOW_API_KEY`

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx README.md docs/windows-distribution.md
git commit -m "docs: guide packaged users through minimum api setup"
```

## Self-Review

### Spec coverage

- Windows installer output: covered by Task 4
- No user-managed Python requirement: covered by Tasks 2 and 3
- Bundled backend startup: covered by Task 3
- Writable app-owned data/config/log directories: covered by Task 1
- Minimum API key flow: covered by Task 5
- Preserve current architecture and dev workflow: covered by Tasks 1, 3, and 4

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain
- Every code-changing step includes concrete snippets
- Every verification step includes an exact command and expected result

### Type consistency

- `BackendPaths` and `resolve_backend_paths()` are used consistently across backend tasks
- `LaunchCommand` and `BackendMode` are introduced before later Rust steps depend on them
- `desktop:dist-win` is introduced once and reused consistently in later verification steps
