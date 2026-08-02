"""Sensor platform for FG2431 Body Metrics."""

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    PERCENTAGE,
    UnitOfElectricResistance,
    UnitOfMass,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import FG2431ProfileData
from .calculations import BodyMetrics, calculate_body_metrics
from .const import (
    CONF_HEART_RATE_ENTITY,
    CONF_HEIGHT,
    CONF_IMPEDANCE_ENTITY,
    CONF_PROFILE_NAME,
    CONF_SEX,
    CONF_WEIGHT_ENTITY,
    DOMAIN,
    SEX_MALE,
)


@dataclass(frozen=True, kw_only=True)
class FG2431SensorDescription(SensorEntityDescription):
    """Describe an FG2431 profile sensor."""

    source_key: str | None = None
    metric_getter: Callable[[BodyMetrics], float] | None = None


SENSOR_DESCRIPTIONS = (
    FG2431SensorDescription(
        key="weight",
        translation_key="weight",
        source_key=CONF_WEIGHT_ENTITY,
        native_unit_of_measurement=UnitOfMass.KILOGRAMS,
        device_class=SensorDeviceClass.WEIGHT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
    ),
    FG2431SensorDescription(
        key="heart_rate",
        translation_key="heart_rate",
        source_key=CONF_HEART_RATE_ENTITY,
        native_unit_of_measurement="bpm",
        device_class=SensorDeviceClass.HEART_RATE,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
    ),
    FG2431SensorDescription(
        key="impedance",
        translation_key="impedance",
        source_key=CONF_IMPEDANCE_ENTITY,
        native_unit_of_measurement=UnitOfElectricResistance.OHM,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
    ),
    FG2431SensorDescription(
        key="bmi",
        translation_key="bmi",
        metric_getter=lambda metrics: metrics.bmi,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        icon="mdi:human-male-height-variant",
    ),
    FG2431SensorDescription(
        key="body_fat",
        translation_key="body_fat",
        metric_getter=lambda metrics: metrics.body_fat_percentage,
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        icon="mdi:percent-circle-outline",
    ),
    FG2431SensorDescription(
        key="body_water",
        translation_key="body_water",
        metric_getter=lambda metrics: metrics.body_water_percentage,
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        icon="mdi:water-percent",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up one FG2431 profile's sensors."""
    profile: FG2431ProfileData = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        FG2431ProfileSensor(profile, description)
        for description in SENSOR_DESCRIPTIONS
    )


class FG2431ProfileSensor(SensorEntity):
    """A source or calculated body-profile sensor."""

    entity_description: FG2431SensorDescription
    _attr_has_entity_name = True

    def __init__(
        self, profile: FG2431ProfileData, description: FG2431SensorDescription
    ) -> None:
        self.profile = profile
        self.entity_description = description
        entry = profile.entry
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.data[CONF_PROFILE_NAME],
            manufacturer="CjonesLAB",
            model="FG2431 body profile",
        )

    async def async_added_to_hass(self) -> None:
        """Subscribe to final measurement updates."""
        await super().async_added_to_hass()
        self.async_on_remove(self.profile.async_add_listener(self._handle_update))

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()

    @property
    def available(self) -> bool:
        """Return whether the required source values are available."""
        if self.entity_description.source_key is not None:
            return self._source_value(self.entity_description.source_key) is not None
        return self._calculated_metrics() is not None

    @property
    def native_value(self) -> float | None:
        """Return the current source or calculated value."""
        if self.entity_description.source_key is not None:
            return self._source_value(self.entity_description.source_key)
        metrics = self._calculated_metrics()
        if metrics is None or self.entity_description.metric_getter is None:
            return None
        return self.entity_description.metric_getter(metrics)

    def _source_value(self, config_key: str) -> float | None:
        state = self.hass.states.get(self.profile.entry.data[config_key])
        if state is None or state.state in ("unknown", "unavailable"):
            return None
        try:
            return float(state.state)
        except ValueError:
            return None

    def _calculated_metrics(self) -> BodyMetrics | None:
        weight = self._source_value(CONF_WEIGHT_ENTITY)
        impedance = self._source_value(CONF_IMPEDANCE_ENTITY)
        if weight is None or impedance is None:
            return None
        return calculate_body_metrics(
            weight_kg=weight,
            impedance_ohm=impedance,
            height_cm=float(self.profile.entry.data[CONF_HEIGHT]),
            is_male=self.profile.entry.data[CONF_SEX] == SEX_MALE,
        )
