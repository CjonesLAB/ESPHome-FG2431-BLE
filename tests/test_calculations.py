"""Tests for body-composition calculations."""

from custom_components.fg2431_body_metrics.calculations import (
    calculate_body_metrics,
)


def test_adult_sample_is_plausible() -> None:
    metrics = calculate_body_metrics(86.9, 469.0, 180.0, True, 45)
    assert metrics is not None
    assert metrics.bmi == 26.8
    assert 10.0 < metrics.body_fat_percentage < 35.0
    assert 40.0 < metrics.body_water_percentage < 70.0
    assert 0.0 < metrics.skeletal_muscle_mass_kg < metrics.fat_free_mass_kg
    assert metrics.muscle_mass_kg + metrics.bone_mass_kg == metrics.fat_free_mass_kg
    assert 1000 < metrics.basal_metabolic_rate_kcal < 2500


def test_female_profile_exposes_all_derived_metrics() -> None:
    metrics = calculate_body_metrics(63.5, 500.0, 170.0, False, 47)
    assert metrics is not None
    assert metrics.bmi == 22.0
    assert metrics.fat_free_mass_kg > 0
    assert metrics.skeletal_muscle_percentage > 0
    assert metrics.muscle_percentage > metrics.body_water_percentage
    assert metrics.protein_percentage > 0
    assert metrics.basal_metabolic_rate_kcal == 1302


def test_invalid_impedance_is_rejected() -> None:
    assert calculate_body_metrics(70.0, 0.0, 175.0, True, 40) is None


def test_non_finite_input_is_rejected() -> None:
    assert calculate_body_metrics(float("nan"), 500.0, 175.0, False, 40) is None


def test_age_outside_adult_range_is_rejected() -> None:
    assert calculate_body_metrics(70.0, 500.0, 175.0, True, 17) is None


def test_existing_profile_keeps_age_independent_metrics() -> None:
    metrics = calculate_body_metrics(70.0, 500.0, 175.0, True)
    assert metrics is not None
    assert metrics.bmi > 0
    assert metrics.fat_free_mass_kg > 0
    assert metrics.skeletal_muscle_mass_kg is None
    assert metrics.basal_metabolic_rate_kcal is None
