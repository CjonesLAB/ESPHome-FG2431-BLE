"""Config flow for FG2431 Body Metrics."""

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import Platform
from homeassistant.helpers import selector

from .const import (
    CONF_HEART_RATE_ENTITY,
    CONF_HEIGHT,
    CONF_IMPEDANCE_ENTITY,
    CONF_PROFILE_NAME,
    CONF_SEX,
    CONF_WEIGHT_ENTITY,
    DOMAIN,
    SEX_FEMALE,
    SEX_MALE,
)


class FG2431BodyMetricsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle an FG2431 body-profile config flow."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create one person profile."""
        errors = {}
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_WEIGHT_ENTITY])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=user_input[CONF_PROFILE_NAME], data=user_input
            )

        sensor_selector = selector.EntitySelector(
            selector.EntitySelectorConfig(domain=Platform.SENSOR)
        )
        data_schema = vol.Schema(
            {
                vol.Required(CONF_PROFILE_NAME): str,
                vol.Required(CONF_SEX, default=SEX_MALE): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=[SEX_MALE, SEX_FEMALE],
                        mode=selector.SelectSelectorMode.DROPDOWN,
                        translation_key="sex",
                    )
                ),
                vol.Required(CONF_HEIGHT, default=175): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=100,
                        max=230,
                        step=1,
                        unit_of_measurement="cm",
                        mode=selector.NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(CONF_WEIGHT_ENTITY): sensor_selector,
                vol.Required(CONF_HEART_RATE_ENTITY): sensor_selector,
                vol.Required(CONF_IMPEDANCE_ENTITY): sensor_selector,
            }
        )
        return self.async_show_form(
            step_id="user", data_schema=data_schema, errors=errors
        )
