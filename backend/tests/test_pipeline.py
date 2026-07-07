import json
from pathlib import Path

from app.rag.corpus import load_chunks
from pipeline.chunk import chunk_docs
from pipeline.embed import embed_chunks
from pipeline.fetch import fetch_docs
from pipeline.parse import parse_docs


def test_fetch_parse_and_chunk_local_docs_snapshot(tmp_path: Path) -> None:
    source_dir = tmp_path / "vue-docs"
    docs_dir = source_dir / "src" / "guide" / "essentials"
    docs_dir.mkdir(parents=True)
    (docs_dir / "watchers.md").write_text(
        """---
title: Watchers
---
import Demo from './Demo.vue'

# 侦听器

## `watchEffect()`

watchEffect 会自动追踪同步回调中访问到的响应式依赖。

```ts
watchEffect(() => {
  console.log(count.value)
})
```

## watch

watch 适合监听明确的数据源。
""",
        encoding="utf-8",
    )
    (source_dir / "node_modules" / "ignored").mkdir(parents=True)
    (source_dir / "node_modules" / "ignored" / "skip.md").write_text(
        "# skip",
        encoding="utf-8",
    )

    raw_dir = tmp_path / "raw"
    copied = fetch_docs(
        source_dir=source_dir,
        output_dir=raw_dir,
        framework="vue",
        version="3.4",
    )

    assert len(copied) == 1
    assert (raw_dir / "vue" / "3.4" / "src" / "guide" / "essentials" / "watchers.md").exists()

    parsed_file = tmp_path / "parsed" / "vue-3.4.jsonl"
    documents = parse_docs(
        input_dir=raw_dir / "vue" / "3.4",
        output_file=parsed_file,
        framework="vue",
        version="3.4",
        base_url="https://cn.vuejs.org/",
    )

    assert len(documents) == 1
    document = documents[0]
    assert document.title == "侦听器"
    assert "title: Watchers" not in document.content
    assert "import Demo" not in document.content
    assert document.source_path == "src/guide/essentials/watchers.md"
    assert document.source_url == "https://cn.vuejs.org/guide/essentials/watchers.html"

    chunks_file = tmp_path / "chunks" / "vue-3.4.jsonl"
    chunks = chunk_docs(input_file=parsed_file, output_file=chunks_file, max_chars=180)

    assert len(chunks) >= 2
    first = chunks[0]
    assert first.framework == "vue"
    assert first.version == "3.4"
    assert first.heading_path == ["侦听器", "watchEffect()"]
    assert first.source_url == "https://cn.vuejs.org/guide/essentials/watchers.html#watcheffect"
    assert "```ts\nwatchEffect" in first.text

    persisted = [
        json.loads(line)
        for line in chunks_file.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert persisted[0]["id"].startswith(
        "vue@3.4:guide/essentials/watchers#watcheffect:0001"
    )

    loaded_chunks = load_chunks(chunks_file)
    assert loaded_chunks[0].id == chunks[0].id
    assert loaded_chunks[0].heading_path == ["侦听器", "watchEffect()"]

    vector_file = tmp_path / "vectors" / "vue-index.jsonl"
    vector_records = embed_chunks(input_file=chunks_file, output_file=vector_file)

    assert vector_file.exists()
    assert len(vector_records) == len(chunks)
    assert vector_records[0]["id"] == chunks[0].id
    assert vector_records[0]["vector"]
