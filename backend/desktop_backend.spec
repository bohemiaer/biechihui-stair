from pathlib import Path
import importlib.util
import sys

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


repo_root = Path.cwd()
feedgrab_site_packages = repo_root / ".venv-feedgrab" / "Lib" / "site-packages"
pathex = [str(repo_root)]
if feedgrab_site_packages.exists() and importlib.util.find_spec("feedgrab") is None:
    pathex.append(str(feedgrab_site_packages))
    sys.path.insert(0, str(feedgrab_site_packages))

hiddenimports = (
    collect_submodules("backend.app")
    + collect_submodules("backend.reference.local_rag")
    + collect_submodules("feedgrab")
)
datas = (
    collect_data_files("backend.reference.local_rag")
    + collect_data_files("feedgrab")
    + collect_data_files("browserforge")
    + collect_data_files("apify_fingerprint_datapoints")
)

a = Analysis(
    [str(repo_root / "backend" / "desktop_backend_entry.py")],
    pathex=pathex,
    binaries=[],
    datas=datas,
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
    console=True,
)
