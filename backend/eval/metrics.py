def hit_rate_at_k(hits: list[bool]) -> float:
    if not hits:
        return 0.0
    return sum(1 for hit in hits if hit) / len(hits)


def has_golden_hit(retrieved_ids: list[str], golden_ids: list[str]) -> bool:
    """Return whether retrieved chunks include a golden chunk.

    Golden IDs may be stored as stable prefixes, because generated chunks carry
    per-file counters while the built-in fallback corpus uses shorter IDs.
    """
    if not retrieved_ids or not golden_ids:
        return False

    return any(
        retrieved_id == golden_id
        or retrieved_id.startswith(golden_id)
        or golden_id.startswith(retrieved_id)
        for retrieved_id in retrieved_ids
        for golden_id in golden_ids
    )
