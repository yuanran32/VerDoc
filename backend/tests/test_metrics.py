from eval.metrics import has_golden_hit, hit_rate_at_k


def test_hit_rate_at_k_empty() -> None:
    assert hit_rate_at_k([]) == 0.0


def test_hit_rate_at_k_counts_true_values() -> None:
    assert hit_rate_at_k([True, False, True, True]) == 0.75


def test_has_golden_hit_accepts_stable_prefixes() -> None:
    assert has_golden_hit(
        retrieved_ids=["vue@3.4:api/sfc-script-setup#definemodel:0014"],
        golden_ids=["vue@3.4:api/sfc-script-setup#definemodel"],
    )


def test_has_golden_hit_returns_false_without_overlap() -> None:
    assert not has_golden_hit(
        retrieved_ids=["vue@3.4:guide/essentials/forms#form-bindings:0001"],
        golden_ids=["vue@3.4:api/sfc-script-setup#definemodel"],
    )
