import esphome.codegen as cg
from esphome.components import ble_client, sensor
import esphome.config_validation as cv
from esphome.const import (
    CONF_ID,
    DEVICE_CLASS_WEIGHT,
    STATE_CLASS_MEASUREMENT,
    UNIT_BEATS_PER_MINUTE,
    UNIT_KILOGRAM,
    UNIT_OHM,
)

DEPENDENCIES = ["ble_client"]
AUTO_LOAD = ["sensor"]

CONF_PERSONS = "persons"
CONF_MIN_WEIGHT = "min_weight"
CONF_MAX_WEIGHT = "max_weight"
CONF_WEIGHT = "weight"
CONF_HEART_RATE = "heart_rate"
CONF_IMPEDANCE = "impedance"

fg2431_ns = cg.esphome_ns.namespace("fg2431_ble")
FG2431BLE = fg2431_ns.class_(
    "FG2431BLE", cg.Component, ble_client.BLEClientNode
)

PERSON_SCHEMA = cv.Schema(
    {
        cv.Required(CONF_MIN_WEIGHT): cv.float_range(min=1.0, max=300.0),
        cv.Required(CONF_MAX_WEIGHT): cv.float_range(min=1.0, max=300.0),
        cv.Required(CONF_WEIGHT): sensor.sensor_schema(
            unit_of_measurement=UNIT_KILOGRAM,
            accuracy_decimals=2,
            device_class=DEVICE_CLASS_WEIGHT,
            state_class=STATE_CLASS_MEASUREMENT,
        ),
        cv.Required(CONF_HEART_RATE): sensor.sensor_schema(
            unit_of_measurement=UNIT_BEATS_PER_MINUTE,
            accuracy_decimals=0,
            state_class=STATE_CLASS_MEASUREMENT,
        ),
        cv.Required(CONF_IMPEDANCE): sensor.sensor_schema(
            unit_of_measurement=UNIT_OHM,
            accuracy_decimals=0,
            state_class=STATE_CLASS_MEASUREMENT,
        ),
    }
)


def validate_persons(config):
    persons = sorted(config[CONF_PERSONS], key=lambda person: person[CONF_MIN_WEIGHT])
    for index, person in enumerate(persons):
        if person[CONF_MIN_WEIGHT] >= person[CONF_MAX_WEIGHT]:
            raise cv.Invalid("min_weight must be lower than max_weight")
        if index and person[CONF_MIN_WEIGHT] <= persons[index - 1][CONF_MAX_WEIGHT]:
            raise cv.Invalid("person weight ranges must not overlap")
    return config


CONFIG_SCHEMA = cv.All(
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(FG2431BLE),
            cv.Required(CONF_PERSONS): cv.All(
                cv.ensure_list(PERSON_SCHEMA), cv.Length(min=1)
            ),
        }
    )
    .extend(cv.COMPONENT_SCHEMA)
    .extend(ble_client.BLE_CLIENT_SCHEMA),
    validate_persons,
)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await ble_client.register_ble_node(var, config)

    for person in config[CONF_PERSONS]:
        weight = await sensor.new_sensor(person[CONF_WEIGHT])
        heart_rate = await sensor.new_sensor(person[CONF_HEART_RATE])
        impedance = await sensor.new_sensor(person[CONF_IMPEDANCE])
        cg.add(
            var.add_person(
                person[CONF_MIN_WEIGHT],
                person[CONF_MAX_WEIGHT],
                weight,
                heart_rate,
                impedance,
            )
        )
