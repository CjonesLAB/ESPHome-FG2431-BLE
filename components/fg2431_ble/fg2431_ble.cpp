#include "fg2431_ble.h"

#include "esphome/components/esp32_ble_tracker/esp32_ble_tracker.h"
#include "esphome/core/log.h"

#ifdef USE_ESP32

namespace esphome::fg2431_ble {

namespace espbt = esphome::esp32_ble_tracker;

static const char *const TAG = "fg2431_ble";
static const uint16_t SERVICE_UUID = 0xFFB0;
static const uint16_t WRITE_UUID = 0xFFB1;
static const uint16_t RESULT_UUID = 0xFFB3;

static const uint8_t HANDSHAKE[][20] = {
    {0x00, 0x03, 0x00, 0xB0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10},
    {0x01, 0x10, 0x00, 0xB1, 0x6A, 0x2E, 0xEF, 0xA9, 0x00, 0x3C, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x0F, 0x1B, 0x58, 0x14, 0x03},
    {0x02, 0x10, 0x00, 0xB1, 0x6A, 0x2E, 0xEF, 0xA9, 0x00, 0x3C, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x0F, 0x1B, 0x58, 0x14, 0x03},
    {0x03, 0x06, 0x00, 0xB2, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02},
    {0x04, 0x02, 0x00, 0xBD, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06},
    {0x05, 0x10, 0x00, 0xB1, 0x6A, 0x2E, 0xEF, 0xA9, 0x00, 0x3C, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x0F, 0x1B, 0x58, 0x14, 0x03},
    {0x06, 0x10, 0x00, 0xB1, 0x6A, 0x2E, 0xEF, 0xA9, 0x00, 0x3C, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x0F, 0x1B, 0x58, 0x14, 0x03},
    {0x07, 0x06, 0x00, 0xB2, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02},
    {0x08, 0x10, 0x00, 0xB1, 0x6A, 0x2E, 0xEF, 0xA9, 0x00, 0x3C, 0x01, 0xAA, 0x1E, 0x55, 0xB2, 0x0F, 0x1B, 0x58, 0x14, 0x03},
    {0x09, 0x03, 0x00, 0xB0, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11},
    {0x0A, 0x03, 0x00, 0xB0, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12},
};

void FG2431BLE::add_person(float min_weight, float max_weight, sensor::Sensor *weight,
                              sensor::Sensor *heart_rate, sensor::Sensor *impedance) {
  this->persons_.push_back({min_weight, max_weight, weight, heart_rate, impedance});
}

void FG2431BLE::dump_config() {
  ESP_LOGCONFIG(TAG, "FG2431 / JEETIF2431 BLE scale:");
  ESP_LOGCONFIG(TAG, "  BLE address: %s", this->parent()->address_str());
  ESP_LOGCONFIG(TAG, "  Configured persons: %u", static_cast<unsigned>(this->persons_.size()));
}

void FG2431BLE::gattc_event_handler(esp_gattc_cb_event_t event, esp_gatt_if_t gattc_if,
                                       esp_ble_gattc_cb_param_t *param) {
  switch (event) {
    case ESP_GATTC_SEARCH_CMPL_EVT: {
      auto service_uuid = espbt::ESPBTUUID::from_uint16(SERVICE_UUID);
      auto *write = this->parent()->get_characteristic(service_uuid, espbt::ESPBTUUID::from_uint16(WRITE_UUID));
      auto *result = this->parent()->get_characteristic(service_uuid, espbt::ESPBTUUID::from_uint16(RESULT_UUID));
      if (write == nullptr || result == nullptr) {
        ESP_LOGE(TAG, "Required FFB1/FFB3 characteristics were not found");
        this->status_set_error();
        return;
      }
      this->write_handle_ = write->handle;
      this->result_handle_ = result->handle;
      auto status = esp_ble_gattc_register_for_notify(this->parent()->get_gattc_if(),
                                                       this->parent()->get_remote_bda(), this->result_handle_);
      if (status != ESP_OK) {
        ESP_LOGE(TAG, "Could not subscribe to FFB3, status=%d", status);
        this->status_set_error();
      }
      break;
    }
    case ESP_GATTC_REG_FOR_NOTIFY_EVT:
      if (param->reg_for_notify.handle == this->result_handle_) {
        if (param->reg_for_notify.status != ESP_GATT_OK) {
          ESP_LOGE(TAG, "FFB3 indication registration failed, status=%d", param->reg_for_notify.status);
          this->status_set_error();
          return;
        }
        this->node_state = espbt::ClientState::ESTABLISHED;
        this->status_clear_error();
        this->start_handshake_();
      }
      break;
    case ESP_GATTC_NOTIFY_EVT:
      if (param->notify.handle == this->result_handle_)
        this->decode_final_packet_(param->notify.value, param->notify.value_len);
      break;
    case ESP_GATTC_CLOSE_EVT:
      this->result_handle_ = 0;
      this->write_handle_ = 0;
      break;
    default:
      break;
  }
}

void FG2431BLE::start_handshake_() { this->send_handshake_frame_(0); }

void FG2431BLE::send_handshake_frame_(size_t index) {
  if (index >= sizeof(HANDSHAKE) / sizeof(HANDSHAKE[0])) {
    ESP_LOGD(TAG, "FFB1 handshake complete");
    return;
  }
  auto status = esp_ble_gattc_write_char(this->parent()->get_gattc_if(), this->parent()->get_conn_id(),
                                         this->write_handle_, sizeof(HANDSHAKE[index]),
                                         const_cast<uint8_t *>(HANDSHAKE[index]), ESP_GATT_WRITE_TYPE_RSP,
                                         ESP_GATT_AUTH_REQ_NONE);
  if (status != ESP_OK) {
    ESP_LOGW(TAG, "Handshake frame %u failed, status=%d", static_cast<unsigned>(index), status);
    return;
  }
  this->set_timeout(150, [this, index]() { this->send_handshake_frame_(index + 1); });
}

void FG2431BLE::decode_final_packet_(const uint8_t *data, uint16_t length) {
  // FFB3 final A3 frame: [seq][len][00][A3][flags][weight u24 BE grams][pulse][impedance u16 BE].
  if (length < 11 || data[2] != 0x00 || data[3] != 0xA3)
    return;

  const uint32_t grams = (uint32_t(data[5]) << 16) | (uint32_t(data[6]) << 8) | uint32_t(data[7]);
  const float weight_kg = grams / 1000.0f;
  const uint8_t pulse = data[8];
  const uint16_t impedance = (uint16_t(data[9]) << 8) | uint16_t(data[10]);

  if (grams < 1000 || grams > 300000 || pulse > 240 || impedance > 3000) {
    ESP_LOGW(TAG, "Rejected invalid final measurement: %.3f kg, pulse %u, impedance %u ohm", weight_kg, pulse,
             impedance);
    return;
  }

  for (auto &person : this->persons_) {
    if (weight_kg < person.min_weight || weight_kg > person.max_weight)
      continue;
    ESP_LOGI(TAG, "Final measurement matched %.1f-%.1f kg: %.3f kg, pulse %u, impedance %u ohm",
             person.min_weight, person.max_weight, weight_kg, pulse, impedance);
    person.weight->publish_state(weight_kg);
    if (pulse > 0)
      person.heart_rate->publish_state(pulse);
    if (impedance > 0)
      person.impedance->publish_state(impedance);
    return;
  }
  ESP_LOGW(TAG, "Final weight %.3f kg did not match a configured person", weight_kg);
}

}  // namespace esphome::fg2431_ble
#endif
