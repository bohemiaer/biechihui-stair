from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the desktop backend with PyInstaller.")
    parser.add_argument(
        "--output-name",
        required=True,
        help="Final file name to place in backend/dist, including extension when needed.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    build_python = _build_python(repo_root)
    dist_dir = script_dir / "dist"
    build_dir = script_dir / "build"
    spec_path = script_dir / "desktop_backend.spec"
    pyinstaller_name = "desktop-backend.exe" if os.name == "nt" else "desktop-backend"
    built_binary = dist_dir / pyinstaller_name
    output_binary = dist_dir / args.output_name

    if os.name == "nt":
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-Process desktop-backend -ErrorAction SilentlyContinue | Stop-Process -Force",
            ],
            check=False,
        )

    if output_binary.exists():
        output_binary.unlink()

    subprocess.run([str(build_python), "-m", "pip", "install", "-r", str(script_dir / "requirements.txt")], cwd=repo_root, check=True)
    _assert_feedgrab_available(build_python, repo_root)
    subprocess.run(
        [
            str(build_python),
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--distpath",
            str(dist_dir),
            "--workpath",
            str(build_dir),
            str(spec_path),
        ],
        cwd=repo_root,
        check=True,
    )

    if not built_binary.exists():
        raise FileNotFoundError(f"Expected bundled backend at {built_binary}")

    if built_binary != output_binary:
        shutil.copy2(built_binary, output_binary)

    return 0


def _build_python(repo_root: Path) -> Path:
    if os.name == "nt":
        feedgrab_python = repo_root / ".venv-feedgrab" / "Scripts" / "python.exe"
    else:
        feedgrab_python = repo_root / ".venv-feedgrab" / "bin" / "python"

    if feedgrab_python.exists():
        return feedgrab_python

    return Path(sys.executable)


def _assert_feedgrab_available(python_executable: Path, cwd: Path) -> None:
    result = subprocess.run(
        [
            str(python_executable),
            "-c",
            "import feedgrab, pathlib; print(pathlib.Path(feedgrab.__file__).resolve())",
        ],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(
            "feedgrab is required for desktop packaging. "
            "Install it into .venv-feedgrab or set up the build Python environment first. "
            f"Details: {detail}"
        )


if __name__ == "__main__":
    raise SystemExit(main())
