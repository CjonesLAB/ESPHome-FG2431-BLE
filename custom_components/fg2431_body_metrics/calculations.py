"""Body-composition calculations based on weight and bioimpedance."""

from dataclasses import dataclass
import math


@dataclass(frozen=True, slots=True)
class BodyMetrics:
    """Calculated body metrics."""

    bmi: float
    body_fat_percentage: float
    body_water_percentage: float


def calculate_body_metrics(
    weight_kg: float, impedance_ohm: float, height_cm: float, is_male: bool
) -> BodyMetrics | None:
    """Calculate BMI, body fat and body water from a final scale measurement.

    The impedance equations are those published by Sun et al. (2003). Results
    are estimates for adult trend tracking and are not medical measurements.
    """
    values = (weight_kg, impedance_ohm, height_cm)
    if not all(math.isfinite(value) for value in values):
        return None
    if not 10.0 <= weight_kg <= 300.0:
        return None
    if not 100.0 <= height_cm <= 230.0:
        return None
    if not 100.0 <= impedance_ohm <= 1500.0:
        return None

    height_m = height_cm / 100.0
    height_squared_over_resistance = height_cm * height_cm / impedance_ohm
    bmi = weight_kg / (height_m * height_m)

    if is_male:
        fat_free_mass = (
            -10.68
            + 0.65 * height_squared_over_resistance
            + 0.26 * weight_kg
            + 0.02 * impedance_ohm
        )
        body_water_liters = (
            1.2 + 0.45 * height_squared_over_resistance + 0.18 * weight_kg
        )
    else:
        fat_free_mass = (
            -9.53
            + 0.69 * height_squared_over_resistance
            + 0.17 * weight_kg
            + 0.02 * impedance_ohm
        )
        body_water_liters = (
            3.75 + 0.45 * height_squared_over_resistance + 0.11 * weight_kg
        )

    body_fat_percentage = (1.0 - fat_free_mass / weight_kg) * 100.0
    body_water_kg = 0.99513 * body_water_liters
    body_water_percentage = body_water_kg / weight_kg * 100.0

    if not 0.0 <= body_fat_percentage <= 75.0:
        return None
    if not 20.0 <= body_water_percentage <= 80.0:
        return None

    return BodyMetrics(
        bmi=round(bmi, 1),
        body_fat_percentage=round(body_fat_percentage, 1),
        body_water_percentage=round(body_water_percentage, 1),
    )
