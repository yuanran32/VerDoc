import argparse
import shutil
from pathlib import Path


DOC_EXTENSIONS = {".md", ".mdx"}
IGNORED_DIRS = {".git", ".github", "node_modules", ".next", "dist", "build"}


def fetch_docs(
    source_dir: str | Path,
    output_dir: str | Path = "data/raw",
    framework: str = "vue",
    version: str = "3.4",
) -> list[Path]:
    """Copy a local documentation snapshot into the raw data directory.

    The network-backed fetch step can be layered on top of this later. Keeping
    the first implementation local makes the indexing pipeline reproducible in
    tests and usable with manually downloaded official docs snapshots.
    """
    source_root = Path(source_dir).expanduser().resolve()
    if not source_root.exists() or not source_root.is_dir():
        raise FileNotFoundError(f"Documentation source directory not found: {source_root}")

    target_root = Path(output_dir).expanduser().resolve() / framework / version
    target_root.mkdir(parents=True, exist_ok=True)

    copied: list[Path] = []
    for source_path in iter_doc_files(source_root):
        relative_path = source_path.relative_to(source_root)
        target_path = target_root / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
        copied.append(target_path)

    return copied


def iter_doc_files(source_root: Path) -> list[Path]:
    docs: list[Path] = []
    for path in source_root.rglob("*"):
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        relative_parts = path.relative_to(source_root).parts
        if any(part.startswith(".") for part in relative_parts):
            continue
        if not relative_parts or relative_parts[0] != "src":
            continue
        if path.is_file() and path.suffix.lower() in DOC_EXTENSIONS:
            docs.append(path)
    return sorted(docs)


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy docs into data/raw.")
    parser.add_argument("--source", required=True, help="Local docs snapshot directory.")
    parser.add_argument("--out", default="data/raw", help="Raw data output directory.")
    parser.add_argument("--framework", default="vue")
    parser.add_argument("--version", default="3.4")
    args = parser.parse_args()

    copied = fetch_docs(
        source_dir=args.source,
        output_dir=args.out,
        framework=args.framework,
        version=args.version,
    )
    print(f"Copied {len(copied)} documentation files.")


if __name__ == "__main__":
    main()
