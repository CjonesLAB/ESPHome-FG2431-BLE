const CARD_TYPE = "fg2431-body-metrics-card";
const LEGACY_CARD_TYPE = "fg2431-body-card";
const EDITOR_TYPE = "fg2431-body-metrics-card-editor";
const HISTORY_CARD_TYPE = "fg2431-history-card";
const HISTORY_EDITOR_TYPE = "fg2431-history-card-editor";

const FIELD_DEFINITIONS = [
  ["weight_entity", "Gewicht", "Weight"],
  ["weight_change_entity", "Gewichtsänderung", "Weight change"],
  ["heart_rate_entity", "Puls", "Heart rate"],
  ["bmi_entity", "BMI", "BMI"],
  ["body_fat_entity", "Körperfett", "Body fat"],
  ["body_water_entity", "Körperwasser", "Body water"],
  ["fat_free_mass_entity", "Fettfreie Körpermasse", "Fat-free mass"],
  ["skeletal_muscle_entity", "Skelettmuskelanteil", "Skeletal muscle"],
  ["skeletal_muscle_mass_entity", "Skelettmuskelmasse", "Skeletal muscle mass"],
  ["muscle_percentage_entity", "Muskelanteil", "Muscle percentage"],
  ["muscle_mass_entity", "Muskelmasse", "Muscle mass"],
  ["bone_mass_entity", "Knochenmasse", "Bone mass"],
  ["protein_entity", "Proteinanteil", "Protein"],
  ["bmr_entity", "Grundumsatz", "Basal metabolic rate"],
];

const HISTORY_FIELD_DEFINITIONS = [
  ["weight_entity", "Gewicht", "Weight"],
  ["body_fat_entity", "Körperfett", "Body fat"],
  ["body_water_entity", "Körperwasser", "Body water"],
  ["bmi_entity", "BMI", "BMI"],
  ["heart_rate_entity", "Puls", "Heart rate"],
  ["fat_free_mass_entity", "Fettfreie Körpermasse", "Fat-free mass"],
  ["skeletal_muscle_entity", "Skelettmuskelanteil", "Skeletal muscle"],
  ["muscle_mass_entity", "Muskelmasse", "Muscle mass"],
  ["protein_entity", "Proteinanteil", "Protein"],
  ["bmr_entity", "Grundumsatz", "Basal metabolic rate"],
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
    return 8;
  }

  getGridOptions() {
    return { columns: 6, rows: 8, min_columns: 4, min_rows: 3 };
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
    if (!entityId) return "";
    const state = this._formatted(entityId);
    return `
      <button class="metric" data-entity="${escapeHtml(entityId)}">
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
          fatFree: "Fettfreie Körpermasse",
          skeletal: "Skelettmuskelanteil",
          skeletalMass: "Skelettmuskelmasse",
          muscle: "Muskelanteil",
          muscleMass: "Muskelmasse",
          bone: "Knochenmasse",
          protein: "Proteinanteil",
          bmr: "Grundumsatz",
        }
      : {
          empty: "Select the sensors in the visual card editor.",
          weight: "Weight",
          pulse: "Heart rate",
          fat: "Body fat",
          water: "Body water",
          fatFree: "Fat-free mass",
          skeletal: "Skeletal muscle",
          skeletalMass: "Skeletal muscle mass",
          muscle: "Muscle percentage",
          muscleMass: "Muscle mass",
          bone: "Bone mass",
          protein: "Protein",
          bmr: "Basal metabolic rate",
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
            ${this._metric("fat_free_mass_entity", labels.fatFree, "mdi:human")}
            ${this._metric("skeletal_muscle_entity", labels.skeletal, "mdi:arm-flex-outline")}
            ${this._metric("skeletal_muscle_mass_entity", labels.skeletalMass, "mdi:arm-flex")}
            ${this._metric("muscle_percentage_entity", labels.muscle, "mdi:weight-lifter")}
            ${this._metric("muscle_mass_entity", labels.muscleMass, "mdi:weight-lifter")}
            ${this._metric("bone_mass_entity", labels.bone, "mdi:bone")}
            ${this._metric("protein_entity", labels.protein, "mdi:food-drumstick-outline")}
            ${this._metric("bmr_entity", labels.bmr, "mdi:fire")}
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
        <div class="hint">${de ? "Wähle die gewünschten Sensoren eines Personenprofils. Nicht benötigte Felder können leer bleiben." : "Select the desired sensors for one profile. Fields you do not need may remain empty."}</div>
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

class FG2431HistoryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._statistics = {};
    this._loadKey = "";
    this._loading = false;
    this._error = "";
  }

  static getConfigElement() {
    return document.createElement(HISTORY_EDITOR_TYPE);
  }

  static getStubConfig() {
    return { type: `custom:${HISTORY_CARD_TYPE}`, title: "4-Wochen-Verlauf", days: 28 };
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration is required");
    this._config = { title: "4-Wochen-Verlauf", days: 28, ...config };
    this._loadStatistics();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._loadStatistics();
    this._render();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, rows: 6, min_columns: 6, min_rows: 5 };
  }

  _isGerman() {
    return (this._hass?.locale?.language || "de").toLowerCase().startsWith("de");
  }

  _days() {
    const days = Number.parseInt(this._config.days, 10);
    return Number.isFinite(days) ? Math.min(365, Math.max(7, days)) : 28;
  }

  _entities() {
    return HISTORY_FIELD_DEFINITIONS.map(([key]) => this._config[key]).filter(Boolean);
  }

  async _loadStatistics() {
    if (!this._hass) return;
    const entities = this._entities();
    if (!entities.length) return;
    const days = this._days();
    const key = `${days}:${entities.join(",")}`;
    if (key === this._loadKey) return;
    this._loadKey = key;
    this._loading = true;
    this._error = "";
    this._render();

    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    try {
      const result = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: entities,
        period: "day",
        types: ["mean", "min", "max"],
      });
      if (this._loadKey !== key) return;
      this._statistics = result || {};
    } catch (error) {
      if (this._loadKey !== key) return;
      this._statistics = {};
      this._error = error?.message || String(error);
    } finally {
      if (this._loadKey === key) {
        this._loading = false;
        this._render();
      }
    }
  }

  _series(entityId) {
    if (!entityId) return [];
    const points = (this._statistics[entityId] || [])
      .map((item) => ({ time: item.start, value: item.mean }))
      .filter((item) => Number.isFinite(item.time) && Number.isFinite(item.value));
    const current = Number.parseFloat(this._hass?.states?.[entityId]?.state);
    if (Number.isFinite(current)) points.push({ time: Date.now(), value: current });
    return points.sort((a, b) => a.time - b.time);
  }

  _path(points, width, height, padding = 8) {
    if (!points.length) return "";
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const firstTime = points[0].time;
    const timeRange = points.at(-1).time - firstTime || 1;
    return points
      .map((point, index) => {
        const x = padding + ((point.time - firstTime) / timeRange) * (width - padding * 2);
        const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
        return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  _formatValue(value, entityId, digits = 1) {
    if (!Number.isFinite(value)) return "—";
    const language = this._hass?.locale?.language || "de";
    const unit = this._hass?.states?.[entityId]?.attributes?.unit_of_measurement || "";
    return `${new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)}${unit ? ` ${unit}` : ""}`;
  }

  _currentValue(entityId) {
    const value = Number.parseFloat(this._hass?.states?.[entityId]?.state);
    return this._formatValue(value, entityId, entityId === this._config.heart_rate_entity ? 0 : 1);
  }

  _weightSummary(points) {
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const first = values[0];
    const last = values.at(-1);
    return {
      first,
      last,
      delta: last - first,
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
  }

  _metricChart(key, label, color) {
    const entityId = this._config[key];
    if (!entityId) return "";
    const points = this._series(entityId);
    const path = this._path(points, 240, 64, 5);
    return `
      <button class="mini" data-entity="${escapeHtml(entityId)}">
        <span class="mini-head"><span>${escapeHtml(label)}</span><strong>${escapeHtml(this._currentValue(entityId))}</strong></span>
        ${path ? `<svg viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" style="stroke:${color}"></path></svg>` : `<span class="no-data">—</span>`}
      </button>`;
  }

  _setDays(days) {
    if (days === this._days()) return;
    this._config = { ...this._config, days };
    this._loadKey = "";
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config: this._config } }));
    this._loadStatistics();
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const de = this._isGerman();
    const days = this._days();
    const weightEntity = this._config.weight_entity;
    const weightPoints = this._series(weightEntity);
    const weightPath = this._path(weightPoints, 680, 210, 12);
    const summary = this._weightSummary(weightPoints);
    const deltaClass = !summary || Math.abs(summary.delta) < 0.005 ? "same" : summary.delta < 0 ? "down" : "up";
    const deltaIcon = deltaClass === "down" ? "mdi:arrow-down-bold" : deltaClass === "up" ? "mdi:arrow-up-bold" : "mdi:arrow-right-bold";
    const deltaText = summary ? `${summary.delta > 0 ? "+" : ""}${this._formatValue(summary.delta, weightEntity, 2)}` : "—";
    const startDate = new Date(Date.now() - days * 86400000).toLocaleDateString(this._hass?.locale?.language || "de", { day: "2-digit", month: "2-digit" });
    const endDate = new Date().toLocaleDateString(this._hass?.locale?.language || "de", { day: "2-digit", month: "2-digit" });
    const labels = de
      ? { loading: "Statistik wird geladen …", empty: "Wähle die Sensoren im Karteneditor aus.", noData: "Noch keine Langzeitstatistik vorhanden.", average: "Ø Gewicht", min: "Minimum", max: "Maximum", period: "Zeitraum" }
      : { loading: "Loading statistics …", empty: "Select the sensors in the card editor.", noData: "No long-term statistics available yet.", average: "Average", min: "Minimum", max: "Maximum", period: "Period" };

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { overflow:hidden; padding:20px; color:var(--primary-text-color); background:radial-gradient(circle at 90% 0%, rgba(44,210,196,.18), transparent 34%), var(--ha-card-background,var(--card-background-color)); }
        .top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        h2 { margin:0; font-size:21px; }
        .periods { display:flex; gap:5px; padding:4px; border-radius:12px; background:rgba(127,127,127,.10); }
        .periods button { border:0; border-radius:9px; padding:6px 9px; color:var(--secondary-text-color); background:transparent; cursor:pointer; font-weight:650; }
        .periods button.active { color:#061817; background:#32c8bd; }
        .weight-summary { display:flex; align-items:flex-end; justify-content:space-between; gap:15px; margin-bottom:8px; }
        .current small { display:block; color:var(--secondary-text-color); }
        .current strong { font-size:38px; line-height:1.05; }
        .delta { display:inline-flex; align-items:center; gap:3px; font-size:17px; font-weight:750; }
        .delta.down { color:#35b96f; } .delta.up { color:#e55353; } .delta.same { color:var(--secondary-text-color); }
        .delta ha-icon { --mdc-icon-size:21px; }
        .chart { height:210px; margin:4px 0 0; }
        svg { width:100%; height:100%; overflow:visible; }
        svg path { fill:none; stroke:#28c7bd; stroke-width:3; vector-effect:non-scaling-stroke; stroke-linecap:round; stroke-linejoin:round; }
        .dates { display:flex; justify-content:space-between; color:var(--secondary-text-color); font-size:11px; }
        .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:14px 0; }
        .stat { padding:10px 12px; border-radius:12px; background:rgba(127,127,127,.08); }
        .stat span { display:block; color:var(--secondary-text-color); font-size:11px; }
        .stat strong { font-size:16px; }
        .minis { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
        .mini { min-width:0; border:1px solid rgba(127,127,127,.16); border-radius:14px; padding:11px; color:inherit; background:rgba(127,127,127,.05); text-align:left; cursor:pointer; }
        .mini-head { display:flex; justify-content:space-between; gap:8px; color:var(--secondary-text-color); font-size:12px; }
        .mini-head strong { color:var(--primary-text-color); }
        .mini svg { height:52px; margin-top:5px; }
        .mini svg path { stroke-width:2; }
        .message { padding:28px 4px; color:var(--secondary-text-color); }
        .error { color:var(--error-color); }
        @media(max-width:500px) { .top{align-items:flex-start;flex-direction:column}.minis{grid-template-columns:1fr}.current strong{font-size:32px}.chart{height:170px} }
      </style>
      <ha-card>
        <div class="top"><h2>${escapeHtml(this._config.title || "4-Wochen-Verlauf")}</h2><div class="periods" title="${labels.period}">${[7, 28, 90].map((value) => `<button data-days="${value}" class="${days === value ? "active" : ""}">${value} T</button>`).join("")}</div></div>
        ${!this._entities().length ? `<div class="message">${labels.empty}</div>` : this._loading ? `<div class="message">${labels.loading}</div>` : this._error ? `<div class="message error">${escapeHtml(this._error)}</div>` : !weightPoints.length ? `<div class="message">${labels.noData}</div>` : `
          <div class="weight-summary"><div class="current"><small>${de ? "Gewicht" : "Weight"}</small><strong>${escapeHtml(this._currentValue(weightEntity))}</strong></div><span class="delta ${deltaClass}"><ha-icon icon="${deltaIcon}"></ha-icon>${escapeHtml(deltaText)}</span></div>
          <div class="chart"><svg viewBox="0 0 680 210" preserveAspectRatio="none" aria-label="${de ? "Gewichtsverlauf" : "Weight history"}"><path d="${weightPath}"></path></svg></div>
          <div class="dates"><span>${startDate}</span><span>${endDate}</span></div>
          <div class="stats"><div class="stat"><span>${labels.average}</span><strong>${this._formatValue(summary.average, weightEntity, 2)}</strong></div><div class="stat"><span>${labels.min}</span><strong>${this._formatValue(summary.min, weightEntity, 2)}</strong></div><div class="stat"><span>${labels.max}</span><strong>${this._formatValue(summary.max, weightEntity, 2)}</strong></div></div>
          <div class="minis">${this._metricChart("body_fat_entity", de ? "Körperfett" : "Body fat", "#e6a64b")}${this._metricChart("body_water_entity", de ? "Körperwasser" : "Body water", "#27aee4")}${this._metricChart("bmi_entity", "BMI", "#8b7cf6")}${this._metricChart("heart_rate_entity", de ? "Puls" : "Heart rate", "#ef657a")}${this._metricChart("fat_free_mass_entity", de ? "Fettfreie Körpermasse" : "Fat-free mass", "#4fc3a1")}${this._metricChart("skeletal_muscle_entity", de ? "Skelettmuskelanteil" : "Skeletal muscle", "#5dba67")}${this._metricChart("muscle_mass_entity", de ? "Muskelmasse" : "Muscle mass", "#7cb342")}${this._metricChart("protein_entity", de ? "Proteinanteil" : "Protein", "#c0a24d")}${this._metricChart("bmr_entity", de ? "Grundumsatz" : "Basal metabolic rate", "#ef8b4d")}</div>`}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", () => this._setDays(Number(button.dataset.days))));
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => button.addEventListener("click", () => {
      const entityId = button.dataset.entity;
      if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }));
  }
}

class FG2431HistoryCardEditor extends HTMLElement {
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
    else this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => { picker.hass = hass; });
  }

  _changed(key, value) {
    const config = { ...this._config };
    if (value === "" || value === undefined || value === null) delete config[key];
    else config[key] = value;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config } }));
  }

  _render() {
    if (!this.shadowRoot || !this._hass || this._rendered) return;
    const de = (this._hass.locale?.language || "de").toLowerCase().startsWith("de");
    this.shadowRoot.innerHTML = `<style>.form{display:grid;gap:14px}.hint{color:var(--secondary-text-color);font-size:13px}ha-textfield,ha-entity-picker{display:block;width:100%}</style><div class="form"><div class="hint">${de ? "Wähle die Verlaufssensoren eines Personenprofils. Die Karte nutzt tägliche Langzeitstatistiken." : "Select one profile's history sensors. The card uses daily long-term statistics."}</div><ha-textfield id="title"></ha-textfield><ha-textfield id="days" type="number" min="7" max="365"></ha-textfield><div id="pickers"></div></div>`;
    const title = this.shadowRoot.getElementById("title");
    title.label = de ? "Titel / Name" : "Title / name";
    title.value = this._config.title || "";
    title.addEventListener("input", (event) => this._changed("title", event.target.value));
    const days = this.shadowRoot.getElementById("days");
    days.label = de ? "Zeitraum in Tagen" : "Period in days";
    days.value = String(this._config.days || 28);
    days.addEventListener("change", (event) => this._changed("days", Math.min(365, Math.max(7, Number(event.target.value) || 28))));
    const container = this.shadowRoot.getElementById("pickers");
    container.style.display = "grid";
    container.style.gap = "14px";
    HISTORY_FIELD_DEFINITIONS.forEach(([key, labelDe, labelEn]) => {
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

  _syncValues() {
    const title = this.shadowRoot.getElementById("title");
    if (title && title.value !== (this._config.title || "")) title.value = this._config.title || "";
    const days = this.shadowRoot.getElementById("days");
    if (days && days.value !== String(this._config.days || 28)) days.value = String(this._config.days || 28);
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const value = this._config[picker.dataset.configKey] || "";
      if (picker.value !== value) picker.value = value;
    });
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, FG2431BodyCard);
if (!customElements.get(LEGACY_CARD_TYPE)) {
  customElements.define(LEGACY_CARD_TYPE, class extends FG2431BodyCard {});
}
if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, FG2431BodyCardEditor);
if (!customElements.get(HISTORY_CARD_TYPE)) customElements.define(HISTORY_CARD_TYPE, FG2431HistoryCard);
if (!customElements.get(HISTORY_EDITOR_TYPE)) customElements.define(HISTORY_EDITOR_TYPE, FG2431HistoryCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "FG2431 Körperanalyse",
    description: "Gewicht, BMI, Körperfett, Körperwasser und Puls eines Profils.",
    preview: false,
  });
}
if (!window.customCards.some((card) => card.type === HISTORY_CARD_TYPE)) {
  window.customCards.push({
    type: HISTORY_CARD_TYPE,
    name: "FG2431 Verlauf",
    description: "Visueller Verlauf für 7, 28 oder 90 Tage mit Langzeitstatistiken.",
    preview: false,
  });
}
