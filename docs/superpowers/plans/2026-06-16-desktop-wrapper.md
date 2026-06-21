# Desktop Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a development-machine desktop app that starts the existing Python backend and opens the current React UI inside a Tauri shell.

**Architecture:** Keep the web app and backend unchanged as the core product, and add a `src-tauri` shell that orchestrates startup. The desktop shell will probe the backend, launch it with the local Python runtime when needed, wait for readiness, then show the existing UI using either the Vite dev server or the built frontend assets.

**Tech Stack:** Tauri 2, Rust, React, Vite, Vitest, Python/FastAPI

---

### Task 1: Lock the desktop-facing frontend API behavior

**Files:**
- Modify: `src/api/client.test.ts`
- Modify: `src/api/client.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('prefers the desktop backend URL when running inside the Tauri shell', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '');
  vi.stubGlobal('__TAURI_INTERNALS__', {});

  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  });
  vi.stubGlobal('fetch', fetchSpy);

  await fetchJson('/api/home/summary');

  expect(fetchSpy).toHaveBeenCalledWith(
    'http://127.0.0.1:8001/api/home/summary',
    expect.objectContaining({ headers: expect.any(Headers) }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/api/client.test.ts`
Expected: FAIL because the client still resolves the built-app URL as relative instead of the desktop backend URL.

- [ ] **Step 3: Write minimal implementation**

```ts
const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (isTauriRuntime() ? 'http://127.0.0.1:8001' : import.meta.env.DEV ? 'http://127.0.0.1:8001' : '');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/api/client.test.ts`
Expected: PASS

### Task 2: Add desktop shell backend orchestration

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Write the failing shell-level behavior check**

```text
Expected shell behavior:
1. If `http://127.0.0.1:8001/health` responds, do not spawn a new backend.
2. If it does not respond, start `python -m backend.app.run` from the repo root.
3. Poll until `/health` returns success before showing the window.
4. Kill only the backend process started by the Tauri session on app exit.
```

- [ ] **Step 2: Run the desktop command to observe the missing shell**

Run: `npm run desktop:dev`
Expected: FAIL because there is no `desktop:dev` script or `src-tauri` project yet.

- [ ] **Step 3: Write minimal implementation**

```rust
fn main() {
  biechihui_desktop_lib::run();
}
```

```rust
async fn ensure_backend() -> Result<Option<CommandChild>, String> {
  if probe_health().await {
    return Ok(None);
  }

  let child = spawn_python_backend()?;
  wait_for_health().await?;
  Ok(Some(child))
}
```

- [ ] **Step 4: Run the desktop command to verify startup**

Run: `npm run desktop:dev`
Expected: The Tauri window opens after the backend becomes reachable.

### Task 3: Wire npm scripts and developer docs

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing command expectation**

```text
Developer workflow expectation:
- `npm run desktop:dev` starts the desktop shell against the local Vite dev server.
- `npm run desktop:build` builds the web app first, then packages the desktop shell.
```

- [ ] **Step 2: Run the command to verify it is missing**

Run: `npm run desktop:dev`
Expected: FAIL with "Missing script: desktop:dev"

- [ ] **Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "desktop:dev": "tauri dev",
    "desktop:build": "vite build && tauri build"
  }
}
```

- [ ] **Step 4: Run verification**

Run: `npm run build`
Expected: PASS

Run: `npm run test -- src/api/client.test.ts`
Expected: PASS

Run: `npm run desktop:dev`
Expected: PASS if local Rust/Tauri prerequisites are installed
