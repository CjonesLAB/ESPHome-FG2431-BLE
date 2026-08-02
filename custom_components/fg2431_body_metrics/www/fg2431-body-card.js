const CARD_TYPE = "fg2431-body-metrics-card";
const LEGACY_CARD_TYPE = "fg2431-body-card";
const EDITOR_TYPE = "fg2431-body-metrics-card-editor";

const FIELD_DEFINITIONS = [
  ["weight_entity", "Gewicht", "Weight"],
  ["weight_change_entity", "Gewichtsänderung", "Weight change"],
  ["heart_rate_entity", "Puls", "Heart rate"],
  ["bmi_entity", "BMI", "BMI"],
  ["body_fat_entity", "Körperfett", "Body fat"],
  ["body_water_entity", "Körperwasser", "Body water"],
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

class FG2431BodyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig() {
    return {
      type: `custom:${CARD_TYPE}`,
      title: "Körperanalyse",
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Configuration is required");
    }
    this._config = { title: "Körperanalyse", ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 6, rows: 4, min_columns: 4, min_rows: 3 };
  }

  _isGerman() {
    return (this._hass?.locale?.language || "de").toLowerCase().startsWith("de");
  }

  _state(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : undefined;
  }

  _formatted(entityId) {
    const stateObj = this._state(entityId);
    if (!stateObj || ["unknown", "unavailable"].includes(stateObj.state)) {
      return "—";
    }
    if (typeof this._hass.formatEntityState === "function") {
      return this._hass.formatEntityState(stateObj);
    }
    const unit = stateObj.attributes.unit_of_measurement || "";
    return `${stateObj.state}${unit ? ` ${unit}` : ""}`;
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId },
      })
    );
  }

  _weightTrend() {
    const entityId = this._config.weight_change_entity;
    const stateObj = this._state(entityId);
    if (!stateObj || ["unknown", "unavailable"].includes(stateObj.state)) return "";

    const change = Number.parseFloat(stateObj.state);
    if (!Number.isFinite(change)) return "";
    const direction = change < -0.005 ? "down" : change > 0.005 ? "up" : "same";
    const icon = direction === "down" ? "mdi:arrow-down-bold" : direction === "up" ? "mdi:arrow-up-bold" : "mdi:arrow-right-bold";
    let value = this._formatted(entityId);
    if (change > 0 && !value.startsWith("+")) value = `+${value}`;
    return `<span class="trend ${direction}"><ha-icon icon="${icon}"></ha-icon>${escapeHtml(value)}</span>`;
  }

  _metric(key, label, icon, accent = "") {
    const entityId = this._config[key];
    const state = this._formatted(entityId);
    const disabled = entityId ? "" : " missing";
    return `
      <button class="metric${disabled}" data-entity="${escapeHtml(entityId)}">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="metric-copy">
          <span class="metric-label">${escapeHtml(label)}</span>
          <span class="metric-value ${accent}">${escapeHtml(state)}</span>
        </span>
      </button>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const de = this._isGerman();
    const labels = de
      ? {
          empty: "Wähle die Sensoren im Karteneditor aus.",
          weight: "Gewicht",
          pulse: "Puls",
          fat: "Körperfett",
          water: "Körperwasser",
        }
      : {
          empty: "Select the sensors in the visual card editor.",
          weight: "Weight",
          pulse: "Heart rate",
          fat: "Body fat",
          water: "Body water",
        };
    const configured = FIELD_DEFINITIONS.some(([key]) => this._config[key]);
    const weightEntity = this._config.weight_entity;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          overflow: hidden;
          color: var(--primary-text-color);
          background:
            radial-gradient(circle at 88% 8%, rgba(44, 210, 196, .20), transparent 32%),
            linear-gradient(145deg, var(--ha-card-background, var(--card-background-color)) 35%, rgba(10, 102, 108, .16));
        }
        .header { padding: 20px 20px 4px; font-size: 20px; font-weight: 650; }
        .weight {
          width: 100%; border: 0; background: transparent; color: inherit;
          padding: 12px 20px 18px; text-align: left; cursor: pointer;
        }
        .weight.missing { cursor: default; }
        .weight-label { display: block; color: var(--secondary-text-color); font-size: 13px; }
        .weight-value { display: block; margin-top: 2px; font-size: 44px; line-height: 1.05; font-weight: 720; letter-spacing: -1.5px; }
        .weight-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
        .trend { display: inline-flex; align-items: center; gap: 2px; font-size: 16px; font-weight: 700; white-space: nowrap; }
        .trend ha-icon { --mdc-icon-size: 20px; }
        .trend.down { color: #35b96f; }
        .trend.up { color: #e55353; }
        .trend.same { color: var(--secondary-text-color); }
        .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; padding: 0 14px 16px; }
        .metric {
          display: flex; align-items: center; gap: 11px; min-width: 0;
          padding: 12px; border: 1px solid rgba(127, 127, 127, .18); border-radius: 14px;
          background: rgba(127, 127, 127, .07); color: inherit; text-align: left; cursor: pointer;
        }
        .metric:hover:not(.missing) { background: rgba(44, 210, 196, .12); }
        .metric.missing { opacity: .46; cursor: default; }
        ha-icon { color: #24bdb3; --mdc-icon-size: 23px; flex: 0 0 auto; }
        .metric-copy { display: flex; flex-direction: column; min-width: 0; }
        .metric-label { color: var(--secondary-text-color); font-size: 12px; }
        .metric-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; font-weight: 650; }
        .metric-value.water { color: #27aee4; }
        .metric-value.fat { color: #e6a64b; }
        .empty { padding: 22px 20px 25px; color: var(--secondary-text-color); }
        @media (max-width: 420px) { .metrics { grid-template-columns: 1fr; } }
      </style>
      <ha-card>
        <div class="header">${escapeHtml(this._config.title || "Körperanalyse")}</div>
        ${configured ? `
          <button class="weight${weightEntity ? "" : " missing"}" data-entity="${escapeHtml(weightEntity)}">
            <span class="weight-label">${labels.weight}</span>
            <span class="weight-line">
              <span class="weight-value">${escapeHtml(this._formatted(weightEntity))}</span>
              ${this._weightTrend()}
            </span>
          </button>
          <div class="metrics">
            ${this._metric("body_fat_entity", labels.fat, "mdi:percent-circle-outline", "fat")}
            ${this._metric("body_water_entity", labels.water, "mdi:water-percent", "water")}
            ${this._metric("bmi_entity", "BMI", "mdi:human-male-height-variant")}
            ${this._metric("heart_rate_entity", labels.pulse, "mdi:heart-pulse")}
          </div>` : `<div class="empty">${labels.empty}</div>`}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((element) => {
      element.addEventListener("click", () => this._openMoreInfo(element.dataset.entity));
    });
  }
}

class FG2431BodyCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._rendered) this._render();
    else this._syncValues();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
    else this._syncHass();
  }

  _changed(key, value) {
    const config = { ...this._config };
    if (value === undefined || value === null || value === "") delete config[key];
    else config[key] = value;
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config },
      })
    );
  }

  _render() {
    if (!this.shadowRoot || !this._hass || this._rendered) return;
    const de = (this._hass.locale?.language || "de").toLowerCase().startsWith("de");
    this.shadowRoot.innerHTML = `
      <style>
        .form { display: grid; gap: 14px; padding: 4px 0; }
        .hint { color: var(--secondary-text-color); font-size: 13px; line-height: 1.4; }
        ha-textfield, ha-entity-picker { display: block; width: 100%; }
      </style>
      <div class="form">
        <div class="hint">${de ? "Wähle die sechs Sensoren eines Personenprofils. Für weitere Personen fügst du die Karte erneut hinzu." : "Select the six sensors of one profile. Add the card again for additional people."}</div>
        <ha-textfield id="title"></ha-textfield>
        <div id="pickers"></div>
      </div>`;

    const title = this.shadowRoot.getElementById("title");
    title.label = de ? "Titel / Name" : "Title / name";
    title.value = this._config.title || "";
    title.addEventListener("input", (event) => this._changed("title", event.target.value));

    const container = this.shadowRoot.getElementById("pickers");
    container.style.display = "grid";
    container.style.gap = "14px";
    FIELD_DEFINITIONS.forEach(([key, labelDe, labelEn]) => {
      const picker = document.createElement("ha-entity-picker");
      picker.dataset.configKey = key;
      picker.hass = this._hass;
      picker.value = this._config[key] || "";
      picker.label = de ? labelDe : labelEn;
      picker.includeDomains = ["sensor"];
      picker.allowCustomEntity = true;
      picker.addEventListener("value-changed", (event) => this._changed(key, event.detail.value));
      container.appendChild(picker);
    });
    this._rendered = true;
  }

  _syncHass() {
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      picker.hass = this._hass;
    });
  }

  _syncValues() {
    const title = this.shadowRoot.getElementById("title");
    const configuredTitle = this._config.title || "";
    if (title && title.value !== configuredTitle) title.value = configuredTitle;

    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const configuredValue = this._config[picker.dataset.configKey] || "";
      if (picker.value !== configuredValue) picker.value = configuredValue;
    });
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, FG2431BodyCard);
if (!customElements.get(LEGACY_CARD_TYPE)) {
  customElements.define(LEGACY_CARD_TYPE, class extends FG2431BodyCard {});
}
if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, FG2431BodyCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "FG2431 Körperanalyse",
    description: "Gewicht, BMI, Körperfett, Körperwasser, Puls und Impedanz eines Profils.",
    preview: false,
  });
}
