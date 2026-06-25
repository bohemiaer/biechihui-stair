from pathlib import Path


def test_desktop_requirements_install_vendored_feedgrab():
    repo_root = Path(__file__).resolve().parents[2]
    requirements = repo_root / "backend" / "requirements.txt"
    vendor_pyproject = repo_root / "vendor" / "feedgrab" / "pyproject.toml"

    lines = [
        line.strip()
        for line in requirements.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]

    assert "./vendor/feedgrab" in "\n".join(lines)
    assert vendor_pyproject.exists()
