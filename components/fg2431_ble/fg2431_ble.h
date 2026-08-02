#pragma once

#include "esphome/components/ble_client/ble_client.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/core/component.h"

#include <cstddef>
#include <cstdint>
#include <vector>

#ifdef USE_ESP32
#include <esp_gattc_api.h>

namespace esphome::fg2431_ble {

struct PersonSensors {
  float min_weight;
  float max_weight;
  sensor::Sensor *weight;
  sensor::Sensor *heart_rate;
  sensor::Sensor *impedance;
};

class FG2431BLE : public Component, public ble_client::BLEClientNode {
 public:
  void add_person(float min_weight, float max_weight, sensor::Sensor *weight, sensor::Sensor *heart_rate,
                  sensor::Sensor *impedance);
  void dump_config() override;
  void gattc_event_handler(esp_gattc_cb_event_t event, esp_gatt_if_t gattc_if,
                           esp_ble_gattc_cb_param_t *param) override;

 protected:
  void start_handshake_();
  void send_handshake_frame_(size_t index);
  void decode_final_packet_(const uint8_t *data, uint16_t length);

  uint16_t result_handle_{0};
  uint16_t write_handle_{0};
  std::vector<PersonSensors> persons_;
};

}  // namespace esphome::fg2431_ble
#endif
