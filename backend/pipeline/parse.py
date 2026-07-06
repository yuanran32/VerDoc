import argparse
import json
import re
from pathlib import Path

from pydantic import BaseModel


FRONTMATTER_PATTERN = re.compile(r"\A---\s*\n.*?\n---\s*\n", re.DOTALL)
MDX_IMPORT_EXPORT_PATTERN = re.compile(
    r"^\s*(?:import\s.+?from\s+['\"].+?['\"];?|export\s+(?:const|default).*)\s*$",
    re.MULTILINE,
)
HTML_COMMENT_PATTERN = re.compile(r"<!--.*?-->", re.DOTALL)
HEADING_PATTERN = re.compile(r"^#\s+(.+?)\s*#*\s*$", re.MULTILINE)


class ParsedDocument(BaseModel):
    framework: str
    version: str
    lang: str = "zh"
    source_path: str
    source_url: str | None = None
    title: str | None = None
    content: str


def parse_docs(
    input_dir: str | Path = "data/raw/vue/3.4",
    output_file: str | Path = "data/parsed/vue-3.4.jsonl",
    framework: str = "vue",
    version: str = "3.4",
    base_url: str | None = "https://cn.vuejs.org/",
    lang: str = "zh",
) -> list[ParsedDocument]:
    """Parse Markdown and MDX documents into normalized JSONL records."""
    input_root = Path(input_dir).expanduser().resolve()
    if not input_root.exists() or not input_root.is_dir():
        raise FileNotFoundError(f"Raw documentation directory not found: {input_root}")

    documents = [
        parse_markdown_file(
            path=path,
            source_root=input_root,
            framework=framework,
            version=version,
            base_url=base_url,
            lang=lang,
        )
        for path in sorted(input_root.rglob("*"))
        if path.is_file() and path.suffix.lower() in {".md", ".mdx"}
    ]

    write_jsonl(documents, output_file)
    return documents


def parse_markdown_file(
    path: Path,
    source_root: Path,
    framework: str,
    version: str,
    base_url: str | None,
    lang: str,
) -> ParsedDocument:
    raw = path.read_text(encoding="utf-8")
    content = normalize_markdown(raw)
    relative_path = path.relative_to(source_root).as_posix()
    return ParsedDocument(
        framework=framework,
        version=version,
        lang=lang,
        source_path=relative_path,
        source_url=build_source_url(base_url=base_url, source_path=relative_path),
        title=extract_title(content),
        content=content,
    )


def normalize_markdown(content: str) -> str:
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    content = FRONTMATTER_PATTERN.sub("", content)
    content = HTML_COMMENT_PATTERN.sub("", content)
    content = MDX_IMPORT_EXPORT_PATTERN.sub("", content)
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.strip()


def extract_title(content: str) -> str | None:
    match = HEADING_PATTERN.search(content)
    return clean_heading(match.group(1)) if match else None


def clean_heading(value: str) -> str:
    value = re.sub(r"\s*\{#[^}]+}\s*$", "", value)
    value = value.replace(r"\<", "<").replace(r"\>", ">")
    value = re.sub(r"</?sup[^>]*>", "", value)
    return re.sub(r"\s+", " ", value.replace("`", "")).strip()


def build_source_url(base_url: str | None, source_path: str) -> str | None:
    if not base_url:
        return None

    url_path = source_path.replace("\\", "/")
    if url_path.startswith("src/"):
        url_path = url_path.removeprefix("src/")

    if url_path.endswith((".md", ".mdx")):
        url_path = str(Path(url_path).with_suffix(".html")).replace("\\", "/")

    if url_path.endswith("/index.html"):
        url_path = url_path.removesuffix("index.html")

    return f"{base_url.rstrip('/')}/{url_path.lstrip('/')}"


def write_jsonl(documents: list[ParsedDocument], output_file: str | Path) -> None:
    output_path = Path(output_file).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        for document in documents:
            file.write(json.dumps(document.model_dump(), ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse raw Markdown docs into JSONL.")
    parser.add_argument("--input", default="data/raw/vue/3.4")
    parser.add_argument("--out", default="data/parsed/vue-3.4.jsonl")
    parser.add_argument("--framework", default="vue")
    parser.add_argument("--version", default="3.4")
    parser.add_argument("--base-url", default="https://cn.vuejs.org/")
    parser.add_argument("--lang", default="zh")
    args = parser.parse_args()

    documents = parse_docs(
        input_dir=args.input,
        output_file=args.out,
        framework=args.framework,
        version=args.version,
        base_url=args.base_url,
        lang=args.lang,
    )
    print(f"Parsed {len(documents)} documentation files.")


if __name__ == "__main__":
    main()
