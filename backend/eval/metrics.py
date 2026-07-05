def hit_rate_at_k(hits: list[bool]) -> float:
    if not hits:
        return 0.0
    return sum(1 for hit in hits if hit) / len(hits)
