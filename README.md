# ESPHome FG2431 BLE

[Deutsch](README_DE.md) | **English**

Independent community support for FG2431WB-B / FG2431 BLE body scales advertising as `JEETIF2431`. The implementation has been tested with a Runstar-branded FG2431WB-B, but it is not produced, supported, sponsored or endorsed by the device manufacturer.

The repository contains:

- an ESPHome external component for final BLE measurements;
- an optional Home Assistant integration for body metrics and personal profiles;
- a selectable Lovelace card with a visual editor for each profile.

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

### Finding the scale's MAC address

If the MAC address is unknown, temporarily add the following scanner to the ESPHome configuration. Keep `active: true`, disconnect the phone app from the scale and wake the scale by briefly stepping on it.

```yaml
logger:
  level: DEBUG

esp32_ble_tracker:
  scan_parameters:
    active: true
  on_ble_advertise:
    - then:
        - lambda: |-
            if (x.get_name().find("JEETIF2431") != std::string::npos) {
              ESP_LOGI(
                "fg2431_scan",
                "FG2431 found: address=%s, name=%s, RSSI=%d",
                x.address_str().c_str(),
                x.get_name().c_str(),
                x.get_rssi()
              );
            }
```

Open the ESPHome device logs and look for a line similar to:

```text
FG2431 found: address=AA:BB:CC:DD:EE:FF, name=JEETIF2431, RSSI=-55
```

Copy the displayed address into `ble_client.mac_address`. Then remove the temporary `on_ble_advertise` block again; `esp32_ble_tracker` itself must remain. Nearby BLE addresses may appear in diagnostic logs, so do not publish unfiltered logs without reviewing them first.

### Person detection and validation

`min_weight` and `max_weight` are inclusive kilograms and must not overlap. An unmatched final weight is logged and not published. Packets are accepted only on FFB3 when they contain the `00 A3` final marker and plausible values. A zero pulse or impedance means that metric was unavailable.

## Home Assistant integration

The optional `FG2431 Body Metrics` helper uses the final ESPHome weight and impedance values to estimate:

- BMI;
- body-fat percentage;
- body-water percentage;
- fat-free mass;
- skeletal-muscle percentage and mass;
- muscle percentage and mass;
- bone mass;
- protein percentage;
- basal metabolic rate (BMR).

It also mirrors weight, pulse and impedance into one Home Assistant device per person. Updates are briefly grouped so the values from one final BLE packet appear together.

### Installation with HACS

1. In HACS, add `https://github.com/CjonesLAB/ESPHome-FG2431-BLE` as a custom **Integration** repository.
2. Install `FG2431 BLE for ESPHome and Home Assistant` and restart Home Assistant.
3. Open **Settings → Devices & services → Add integration → FG2431 Body Metrics**.
4. Create one profile for each person and select its ESPHome weight, pulse and impedance sensors, height, real age and calculation profile.

After updating an existing profile to version 1.4.0, open the integration entry, choose **Configure**, enter the person's real age and save. Existing entity IDs and recorder history are preserved. Age is used only as a calculation input and is not exposed as an entity.

For manual installation, copy `custom_components/fg2431_body_metrics` into `/config/custom_components/` and restart Home Assistant.

### Calculations and limitations

The impedance equations use the adult fat-free-mass and total-body-water equations published by [Sun et al. (2003)](https://ajcn.nutrition.org/article/S0002-9165%2823%2905611-3/fulltext). Skeletal muscle uses [Janssen et al. (2000)](https://pubmed.ncbi.nlm.nih.gov/10926627/) and BMR uses [Mifflin–St Jeor (1990)](https://pubmed.ncbi.nlm.nih.gov/2305711/). The independent implementation follows the same transparent approach used by the open-source [openScale project](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bluetooth/libs/StandardImpedanceLib.kt).

Visceral fat, subcutaneous fat, biological age and cardiac index are deliberately not calculated because they cannot be derived reliably from the available packet values with a published, reproducible method.

Bioimpedance values from consumer foot scales are estimates affected by hydration, recent exercise, meals and contact quality. They are intended for consistent personal trend tracking and are not medical measurements, diagnoses or treatment advice.

## Lovelace card

The integration includes the selectable **FG2431 Body Analysis** card and loads it automatically, so no dashboard resource or raw YAML has to be added manually.

1. Update or re-download the integration in HACS and restart Home Assistant.
2. Open a dashboard and select **Edit dashboard → Add card**.
3. Search for `FG2431` and choose the card.
4. Enter the person's name and select the desired profile sensors in the visual editor. The new composition sensors can be shown or left empty individually.
5. Add another copy of the card for every additional person.

Clicking a displayed metric opens Home Assistant's normal entity details dialog. The card follows the active Home Assistant theme and works in Sections as well as masonry dashboards.

Impedance remains available as a sensor and calculation input but is not displayed on the card. The weight row shows the change from the previous final measurement: green for loss, red for gain and neutral when unchanged.

### History card

The additional selectable **FG2431 History** card displays daily long-term statistics for weight and any selected body metrics. Besides body fat, body water, BMI and heart rate, version 1.4.0 can plot fat-free mass, skeletal-muscle percentage, muscle mass, protein and BMR. The period can be switched between 7, 28 and 90 days directly on the card; 28 days is the default. The weight section also shows change, average, minimum and maximum.

Home Assistant starts building long-term statistics after installation and subsequent measurements. Older values cannot be reconstructed retroactively.

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
