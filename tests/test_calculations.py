"""Tests for body-composition calculations."""

from custom_components.fg2431_body_metrics.calculations import (
    calculate_body_metrics,
)


def test_adult_sample_is_plausible() -> None:
    metrics = calculate_body_metrics(86.9, 469.0, 180.0, True)
    assert metrics is not None
    assert metrics.bmi == 26.8
    assert 10.0 < metrics.body_fat_percentage < 35.0
    assert 40.0 < metrics.body_water_percentage < 70.0


def test_invalid_impedance_is_rejected() -> None:
    assert calculate_body_metrics(70.0, 0.0, 175.0, True) is None


def test_non_finite_input_is_rejected() -> None:
    assert calculate_body_metrics(float("nan"), 500.0, 175.0, False) is None
