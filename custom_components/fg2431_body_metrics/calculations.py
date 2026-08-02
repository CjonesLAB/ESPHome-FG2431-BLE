"""Body-composition calculations based on weight and bioimpedance."""

from dataclasses import dataclass
import math


@dataclass(frozen=True, slots=True)
class BodyMetrics:
    """Calculated body metrics."""

    bmi: float
    body_fat_percentage: float
    body_water_percentage: float
    fat_free_mass_kg: float
    skeletal_muscle_mass_kg: float | None
    skeletal_muscle_percentage: float | None
    muscle_mass_kg: float
    muscle_percentage: float
    bone_mass_kg: float
    protein_percentage: float
    basal_metabolic_rate_kcal: float | None


def calculate_body_metrics(
    weight_kg: float,
    impedance_ohm: float,
    height_cm: float,
    is_male: bool,
    age: int | None = None,
) -> BodyMetrics | None:
    """Calculate body-composition estimates from a final scale measurement.

    Fat-free mass and body water use Sun et al. (2003), skeletal muscle uses
    Janssen et al. (2000), and BMR uses Mifflin-St Jeor (1990). Remaining
    composition values are transparent derivations from those estimates.
    Results are intended for adult trend tracking, not medical use.
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
    if age is not None and not 18 <= age <= 120:
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

    skeletal_muscle_mass = None
    skeletal_muscle_percentage = None
    if age is not None:
        sex_factor = 1.0 if is_male else 0.0
        skeletal_muscle_mass = (
            0.401 * height_squared_over_resistance
            + 3.825 * sex_factor
            - 0.071 * age
            + 5.102
        )
        skeletal_muscle_percentage = skeletal_muscle_mass / weight_kg * 100.0

    bone_mass = fat_free_mass * (0.057 if is_male else 0.05)
    muscle_mass = fat_free_mass - bone_mass
    muscle_percentage = muscle_mass / weight_kg * 100.0
    protein_percentage = muscle_percentage - body_water_percentage

    basal_metabolic_rate = None
    if age is not None:
        sex_offset = 5.0 if is_male else -161.0
        basal_metabolic_rate = (
            10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + sex_offset
        )

    if not 0.0 <= body_fat_percentage <= 75.0:
        return None
    if not 20.0 <= body_water_percentage <= 80.0:
        return None
    if skeletal_muscle_mass is not None and not 0.0 < skeletal_muscle_mass < fat_free_mass:
        return None
    if not 0.0 <= protein_percentage <= 40.0:
        return None

    return BodyMetrics(
        bmi=round(bmi, 1),
        body_fat_percentage=round(body_fat_percentage, 1),
        body_water_percentage=round(body_water_percentage, 1),
        fat_free_mass_kg=round(fat_free_mass, 1),
        skeletal_muscle_mass_kg=(
            round(skeletal_muscle_mass, 1)
            if skeletal_muscle_mass is not None
            else None
        ),
        skeletal_muscle_percentage=(
            round(skeletal_muscle_percentage, 1)
            if skeletal_muscle_percentage is not None
            else None
        ),
        muscle_mass_kg=round(muscle_mass, 1),
        muscle_percentage=round(muscle_percentage, 1),
        bone_mass_kg=round(bone_mass, 1),
        protein_percentage=round(protein_percentage, 1),
        basal_metabolic_rate_kcal=(
            round(basal_metabolic_rate)
            if basal_metabolic_rate is not None
            else None
        ),
    )
