from eval.metrics import hit_rate_at_k


def test_hit_rate_at_k_empty() -> None:
    assert hit_rate_at_k([]) == 0.0


def test_hit_rate_at_k_counts_true_values() -> None:
    assert hit_rate_at_k([True, False, True, True]) == 0.75
