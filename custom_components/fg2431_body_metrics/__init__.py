"""FG2431 Body Metrics integration."""

from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from .const import (
    CONF_HEART_RATE_ENTITY,
    CONF_IMPEDANCE_ENTITY,
    CONF_WEIGHT_ENTITY,
    DOMAIN,
    UPDATE_DELAY_SECONDS,
)

PLATFORMS = [Platform.SENSOR]
CARD_URL = "/fg2431_body_metrics/fg2431-body-card.js"
CARD_PATH = Path(__file__).parent / "www" / "fg2431-body-card.js"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the bundled Lovelace card."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), True)]
    )
    add_extra_js_url(hass, f"{CARD_URL}?v=1.1.1")
    return True


class FG2431ProfileData:
    """Coordinate one person's source values and calculated sensors."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.source_entity_ids = (
            entry.data[CONF_WEIGHT_ENTITY],
            entry.data[CONF_HEART_RATE_ENTITY],
            entry.data[CONF_IMPEDANCE_ENTITY],
        )
        self._listeners: list[Callable[[], None]] = []
        self._cancel_state_listener: Callable[[], None] | None = None
        self._cancel_pending_update: Callable[[], None] | None = None

    @callback
    def async_start(self) -> None:
        """Start listening for ESPHome sensor updates."""
        self._cancel_state_listener = async_track_state_change_event(
            self.hass, self.source_entity_ids, self._source_state_changed
        )

    @callback
    def async_add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Register a calculated-sensor update listener."""
        self._listeners.append(listener)

        @callback
        def remove_listener() -> None:
            self._listeners.remove(listener)

        return remove_listener

    @callback
    def _source_state_changed(self, event: Event) -> None:
        """Debounce the three values published by one final BLE packet."""
        if self._cancel_pending_update is not None:
            self._cancel_pending_update()
        self._cancel_pending_update = async_call_later(
            self.hass, UPDATE_DELAY_SECONDS, self._notify_listeners
        )

    @callback
    def _notify_listeners(self, now: datetime) -> None:
        self._cancel_pending_update = None
        for listener in self._listeners:
            listener()

    @callback
    def async_stop(self) -> None:
        """Stop all listeners."""
        if self._cancel_pending_update is not None:
            self._cancel_pending_update()
            self._cancel_pending_update = None
        if self._cancel_state_listener is not None:
            self._cancel_state_listener()
            self._cancel_state_listener = None


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up an FG2431 body profile from a config entry."""
    profile = FG2431ProfileData(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = profile
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    profile.async_start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload an FG2431 body profile."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    profile: FG2431ProfileData = hass.data[DOMAIN].pop(entry.entry_id)
    profile.async_stop()
    return True
