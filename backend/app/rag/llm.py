from collections.abc import AsyncGenerator


async def stream_answer(prompt: str) -> AsyncGenerator[str, None]:
    """Placeholder LLM stream for the initial scaffold."""
    del prompt
    tokens = [
        "这是后端骨架的占位回答。",
        "真实实现会基于检索片段生成答案，",
        "并在关键结论后输出引用标记 [1]。",
    ]
    for token in tokens:
        yield token
