import argparse
import json
import re
from pathlib import Path
from typing import Any

from app.rag.schemas import DocumentChunk


HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
FENCE_PATTERN = re.compile(r"^\s*```")
MAX_CHARS = 1400


def chunk_docs(
    input_file: str | Path = "data/parsed/vue-3.4.jsonl",
    output_file: str | Path = "data/chunks/vue-3.4.jsonl",
    max_chars: int = MAX_CHARS,
) -> list[DocumentChunk]:
    """Split parsed documents by Markdown heading while preserving code fences."""
    documents = read_jsonl(input_file)
    chunks: list[DocumentChunk] = []

    for document in documents:
        chunks.extend(chunk_document(document=document, max_chars=max_chars))

    write_chunks(chunks=chunks, output_file=output_file)
    return chunks


def chunk_document(document: dict[str, Any], max_chars: int = MAX_CHARS) -> list[DocumentChunk]:
    sections = split_sections(document["content"])
    chunks: list[DocumentChunk] = []

    for section in sections:
        text_blocks = pack_blocks(section["text"], max_chars=max_chars)
        for text in text_blocks:
            if not text.strip():
                continue
            heading_path = section["heading_path"]
            anchor = section["anchor"]
            chunk_index = len(chunks) + 1
            chunks.append(
                DocumentChunk(
                    id=build_chunk_id(
                        framework=document["framework"],
                        version=document["version"],
                        source_path=document["source_path"],
                        anchor=anchor,
                        index=chunk_index,
                    ),
                    text=text.strip(),
                    framework=document["framework"],
                    version=document["version"],
                    lang=document.get("lang", "zh"),
                    source_path=document["source_path"],
                    source_url=append_anchor(document.get("source_url"), anchor),
                    heading_path=heading_path,
                    chunk_type=detect_chunk_type(document["source_path"], text),
                )
            )

            if chunk_index > 9999:
                raise ValueError("Too many chunks generated for one document set.")

    return chunks


def split_sections(content: str) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    heading_stack: list[str] = []
    anchor_stack: list[str] = []
    current_lines: list[str] = []
    in_fence = False

    def flush() -> None:
        text = "\n".join(current_lines).strip()
        if text:
            sections.append(
                {
                    "heading_path": heading_stack.copy(),
                    "anchor": anchor_stack[-1] if anchor_stack else "root",
                    "text": text,
                }
            )
        current_lines.clear()

    for line in content.splitlines():
        if FENCE_PATTERN.match(line):
            in_fence = not in_fence

        heading_match = HEADING_PATTERN.match(line) if not in_fence else None
        if heading_match:
            flush()
            level = len(heading_match.group(1))
            title, anchor = parse_heading(heading_match.group(2))
            heading_stack = heading_stack[: level - 1]
            anchor_stack = anchor_stack[: level - 1]
            heading_stack.append(title)
            anchor_stack.append(anchor or slugify(title))
            continue

        current_lines.append(line)

    flush()
    return sections


def pack_blocks(text: str, max_chars: int) -> list[str]:
    blocks = split_blocks(text)
    packed: list[str] = []
    current = ""

    for block in blocks:
        candidate = f"{current}\n\n{block}".strip() if current else block
        if current and len(candidate) > max_chars:
            packed.append(current)
            current = block
        else:
            current = candidate

    if current:
        packed.append(current)

    return packed


def split_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    in_fence = False

    for line in text.splitlines():
        if FENCE_PATTERN.match(line):
            in_fence = not in_fence

        if not in_fence and not line.strip():
            if current:
                blocks.append("\n".join(current).strip())
                current.clear()
            continue

        current.append(line)

    if current:
        blocks.append("\n".join(current).strip())

    return blocks


def build_chunk_id(
    framework: str,
    version: str,
    source_path: str,
    anchor: str,
    index: int,
) -> str:
    normalized_path = source_path.replace("\\", "/")
    normalized_path = normalized_path.removeprefix("src/")
    normalized_path = re.sub(r"\.mdx?$", "", normalized_path)
    return f"{framework}@{version}:{normalized_path}#{anchor}:{index:04d}"


def append_anchor(source_url: str | None, anchor: str) -> str | None:
    if not source_url:
        return None
    if "#" in source_url:
        return source_url
    return f"{source_url}#{anchor}"


def detect_chunk_type(source_path: str, text: str) -> str:
    normalized_path = source_path.lower().replace("\\", "/")
    if "/api/" in f"/{normalized_path}" or normalized_path.startswith("api/"):
        return "api-ref"
    if "```" in text and text.strip().startswith("```"):
        return "code"
    return "text"


def slugify(value: str) -> str:
    value = clean_heading(value).lower()
    value = re.sub(r"[^\w\u4e00-\u9fff\s-]", "", value)
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "section"


def clean_heading(value: str) -> str:
    value = re.sub(r"\s*\{#[^}]+}\s*$", "", value)
    value = value.replace(r"\<", "<").replace(r"\>", ">")
    value = re.sub(r"</?sup[^>]*>", "", value)
    return re.sub(r"\s+", " ", value.replace("`", "")).strip()


def parse_heading(value: str) -> tuple[str, str | None]:
    anchor_match = re.search(r"\{#([^}]+)}\s*$", value)
    title = clean_heading(value)
    return title, anchor_match.group(1) if anchor_match else None


def read_jsonl(input_file: str | Path) -> list[dict[str, Any]]:
    input_path = Path(input_file).expanduser().resolve()
    with input_path.open("r", encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def write_chunks(chunks: list[DocumentChunk], output_file: str | Path) -> None:
    output_path = Path(output_file).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        for chunk in chunks:
            file.write(chunk.model_dump_json() + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Split parsed docs into chunks.")
    parser.add_argument("--input", default="data/parsed/vue-3.4.jsonl")
    parser.add_argument("--out", default="data/chunks/vue-3.4.jsonl")
    parser.add_argument("--max-chars", type=int, default=MAX_CHARS)
    args = parser.parse_args()

    chunks = chunk_docs(
        input_file=args.input,
        output_file=args.out,
        max_chars=args.max_chars,
    )
    print(f"Generated {len(chunks)} chunks.")


if __name__ == "__main__":
    main()
