# macOS 安装版说明

## 当前状态

仓库已经补齐 macOS 打包配置，但必须在 macOS 机器上执行构建。

原因有两个：

- Tauri 的 `.app` / `.dmg` 打包需要 macOS 目标环境。
- Python 后端当前通过 PyInstaller 打包，产物也是宿主平台相关的。

## 产物类型

当前配置会生成：

- `.app`
- `.dmg`

## 构建命令

在 Apple Silicon Mac 上：

```bash
npm run desktop:dist-macos:arm64
```

在 Intel Mac 上：

```bash
npm run desktop:dist-macos:x64
```

## 前置条件

构建机器需要先安装：

- Node.js
- Rust
- Python 3
- Xcode Command Line Tools

并确保 `python -m pip install pyinstaller` 可以正常执行。

`feedgrab` 已经随仓库放在 `vendor/feedgrab`，打包脚本会通过
`backend/requirements.txt` 自动安装，不需要在 macOS 上额外手动准备。

## 输出位置

默认输出目录在：

- `src-tauri/target/aarch64-apple-darwin/release/bundle/`
- `src-tauri/target/x86_64-apple-darwin/release/bundle/`

## 签名与公证

当前脚本默认带 `--no-sign`，也就是先产出未签名安装包，方便本地验证。

如果后续要发给普通 macOS 用户，通常还需要继续补：

- Apple Developer 签名
- notarization 公证
- DMG 最终分发验证
