import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from app.rag.corpus import DEFAULT_CHUNKS_PATH, load_chunks
from app.rag.retriever import chunk_search_text, vectorize_text
from app.rag.schemas import DocumentChunk


DEFAULT_VECTOR_INDEX_PATH = (
    Path(__file__).resolve().parents[2] / ".verdoc-data" / "vectors" / "vue-index.jsonl"
)


def embed_chunks(
    input_file: str | Path = DEFAULT_CHUNKS_PATH,
    output_file: str | Path = DEFAULT_VECTOR_INDEX_PATH,
) -> list[dict[str, Any]]:
    """Generate a deterministic sparse vector index for local retrieval.

    The index format is intentionally simple JSONL so the retrieval layer can
    use it without extra services. A model-backed embedding provider or Chroma
    writer can replace this implementation behind the same pipeline boundary.
    """
    chunks = load_chunks(input_file)
    records = [build_vector_record(chunk) for chunk in chunks]
    write_vector_index(records=records, output_file=output_file)
    return records


def build_vector_record(chunk: DocumentChunk) -> dict[str, Any]:
    vector = vectorize_text(chunk_search_text(chunk))
    return {
        "id": chunk.id,
        "framework": chunk.framework,
        "version": chunk.version,
        "source_path": chunk.source_path,
        "source_url": chunk.source_url,
        "vector": normalize_vector(vector),
    }


def normalize_vector(vector: Counter[str]) -> dict[str, float]:
    total = sum(vector.values())
    if total <= 0:
        return {}

    return {
        term: round(value / total, 8)
        for term, value in sorted(vector.items())
        if value > 0
    }


def write_vector_index(
    records: list[dict[str, Any]],
    output_file: str | Path,
) -> None:
    output_path = Path(output_file).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build local vector index.")
    parser.add_argument("--input", default=str(DEFAULT_CHUNKS_PATH))
    parser.add_argument("--out", default=str(DEFAULT_VECTOR_INDEX_PATH))
    args = parser.parse_args()

    records = embed_chunks(input_file=args.input, output_file=args.out)
    print(f"Generated {len(records)} vector records.")


if __name__ == "__main__":
    main()
