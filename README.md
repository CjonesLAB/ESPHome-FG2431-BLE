# ESPHome FG2431 BLE

Independent community support for FG2431WB-B / FG2431 BLE body scales advertising as `JEETIF2431`. The implementation has been tested with a Runstar-branded FG2431WB-B, but it is not produced, supported, sponsored or endorsed by the device manufacturer.

The repository contains:

- an ESPHome external component for final BLE measurements;
- an optional Home Assistant integration for body metrics and personal profiles;
- a ready-to-use, brand-neutral three-person dashboard.

No manufacturer source code, firmware, encryption keys, photographs, logos, app screenshots or website content are included. Product and company names are used only where necessary to describe device compatibility.

## ESPHome external component

The component connects locally over BLE, completes the FFB0 handshake, subscribes to FFB3 and publishes only valid final A3 measurements. It decodes weight from bytes 5-7, heart rate from byte 8 and impedance from bytes 9-10.

```yaml
external_components:
  - source: github://CjonesLAB/ESPHome-FG2431-BLE@main
    components: [fg2431_ble]
```

Configure the BLE client and non-overlapping person ranges:

```yaml
esp32_ble_tracker:

ble_client:
  - mac_address: "AA:BB:CC:DD:EE:FF"  # Replace with your scale's MAC
    id: fg2431_scale_client
    auto_connect: true

sensor:
  - platform: fg2431_ble
    ble_client_id: fg2431_scale_client
    persons:
      - min_weight: 78.0
        max_weight: 120.0
        weight:
          name: "Person 1 Weight"
        heart_rate:
          name: "Person 1 Heart Rate"
        impedance:
          name: "Person 1 Impedance"
      - min_weight: 50.0
        max_weight: 77.9
        weight:
          name: "Person 2 Weight"
        heart_rate:
          name: "Person 2 Heart Rate"
        impedance:
          name: "Person 2 Impedance"
      - min_weight: 10.0
        max_weight: 49.9
        weight:
          name: "Person 3 Weight"
        heart_rate:
          name: "Person 3 Heart Rate"
        impedance:
          name: "Person 3 Impedance"
```

The MAC address is configurable in `ble_client`; the address above is only an example. See [`example.yaml`](example.yaml) for a complete ESPHome node.

### Person detection and validation

`min_weight` and `max_weight` are inclusive kilograms and must not overlap. An unmatched final weight is logged and not published. Packets are accepted only on FFB3 when they contain the `00 A3` final marker and plausible values. A zero pulse or impedance means that metric was unavailable.

## Home Assistant integration

The optional `FG2431 Body Metrics` helper uses the final ESPHome weight and impedance values to estimate:

- BMI;
- body-fat percentage;
- body-water percentage.

It also mirrors weight, pulse and impedance into one Home Assistant device per person. Updates are briefly grouped so the values from one final BLE packet appear together.

### Installation with HACS

1. In HACS, add `https://github.com/CjonesLAB/ESPHome-FG2431-BLE` as a custom **Integration** repository.
2. Install `FG2431 BLE for ESPHome and Home Assistant` and restart Home Assistant.
3. Open **Settings → Devices & services → Add integration → FG2431 Body Metrics**.
4. Create one profile for each person and select its ESPHome weight, pulse and impedance sensors, height and calculation profile.

For manual installation, copy `custom_components/fg2431_body_metrics` into `/config/custom_components/` and restart Home Assistant.

### Calculations and limitations

The impedance equations are the adult fat-free-mass and total-body-water equations published by [Sun et al. (2003)](https://ajcn.nutrition.org/article/S0002-9165%2823%2905611-3/fulltext), also implemented by the open-source [openScale project](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bluetooth/libs/StandardImpedanceLib.kt). This project contains an independent implementation.

Bioimpedance values from consumer foot scales are estimates affected by hydration, recent exercise, meals and contact quality. They are intended for consistent personal trend tracking and are not medical measurements, diagnoses or treatment advice.

## Three-person dashboard

[`dashboard/fg2431_dashboard.yaml`](dashboard/fg2431_dashboard.yaml) contains a Home Assistant Sections dashboard using only built-in cards.

1. Copy [`dashboard/fg2431-scale-hero.svg`](dashboard/fg2431-scale-hero.svg) to `/config/www/fg2431-scale-hero.svg`.
2. Create a dashboard, open its raw configuration editor and paste the YAML.
3. Replace the example `sensor.person_1_*`, `sensor.person_2_*` and `sensor.person_3_*` entity IDs if Home Assistant generated different ones.

The illustration is an original, unbranded project asset. It does not reproduce a manufacturer product image, logo or application interface.

## Legal and trademark notice

This is an unofficial, independently developed interoperability project. It is not affiliated with, authorized by, maintained by or endorsed by the manufacturer or any related app provider. All product names and trademarks belong to their respective owners and are referenced solely to identify compatible hardware.

The software communicates with a user's own device through its ordinary Bluetooth interface. It does not contain manufacturer software or provide a mechanism intended to bypass encryption, access controls or other technical protection measures. Do not use it to access a device without the owner's authorization.

## Troubleshooting

- Wake the scale and stand on it with bare feet until measurement finishes.
- Disconnect other BLE clients; many peripherals accept only one active connection.
- Set `logger.level: DEBUG` to see connection, handshake, validation and matching messages.
- If body metrics are unavailable, verify that impedance is non-zero and the selected source sensors use kg and Ω.

## License

MIT. See [`LICENSE`](LICENSE).
