# ESPHome FG2431 BLE

**Deutsch** | [English](README.md)

Unabhängige Community-Unterstützung für Körperwaagen der Baureihe FG2431WB-B / FG2431, die sich über Bluetooth als `JEETIF2431` melden. Die Implementierung wurde mit einer unter der Marke Runstar vertriebenen FG2431WB-B getestet, stammt aber nicht vom Hersteller und wird von diesem weder unterstützt noch autorisiert oder empfohlen.

Das Repository enthält:

- eine ESPHome External Component für finale BLE-Messungen;
- eine optionale Home-Assistant-Integration für Körperwerte und Personenprofile;
- eine auswählbare Lovelace-Karte mit visuellem Editor für jedes Personenprofil.

Es werden weder Hersteller-Quellcode noch Firmware, Verschlüsselungsschlüssel, Produktbilder, Logos, App-Screenshots oder Inhalte der Hersteller-Website verwendet. Produkt- und Firmennamen werden ausschließlich dort genannt, wo sie zur Beschreibung der Gerätekompatibilität notwendig sind.

## ESPHome External Component

Die Komponente verbindet sich lokal per BLE, führt den FFB0-Handshake aus, abonniert FFB3 und veröffentlicht ausschließlich gültige finale A3-Messungen. Dekodiert werden das Gewicht aus den Bytes 5–7, der Puls aus Byte 8 und die Impedanz aus den Bytes 9–10.

```yaml
external_components:
  - source: github://CjonesLAB/ESPHome-FG2431-BLE@main
    components: [fg2431_ble]
```

Anschließend werden der BLE-Client und überschneidungsfreie Gewichtsbereiche für die Personen konfiguriert:

```yaml
esp32_ble_tracker:

ble_client:
  - mac_address: "AA:BB:CC:DD:EE:FF"  # Durch die MAC der eigenen Waage ersetzen
    id: fg2431_scale_client
    auto_connect: true

sensor:
  - platform: fg2431_ble
    ble_client_id: fg2431_scale_client
    persons:
      - min_weight: 78.0
        max_weight: 120.0
        weight:
          name: "Person 1 Gewicht"
        heart_rate:
          name: "Person 1 Puls"
        impedance:
          name: "Person 1 Impedanz"
      - min_weight: 50.0
        max_weight: 77.9
        weight:
          name: "Person 2 Gewicht"
        heart_rate:
          name: "Person 2 Puls"
        impedance:
          name: "Person 2 Impedanz"
      - min_weight: 10.0
        max_weight: 49.9
        weight:
          name: "Person 3 Gewicht"
        heart_rate:
          name: "Person 3 Puls"
        impedance:
          name: "Person 3 Impedanz"
```

Die MAC-Adresse wird unter `ble_client` frei konfiguriert; die oben gezeigte Adresse ist nur ein Platzhalter. Eine vollständige ESPHome-Konfiguration befindet sich in [`example.yaml`](example.yaml).

### MAC-Adresse der Waage ermitteln

Wenn die MAC-Adresse unbekannt ist, wird vorübergehend der folgende Scanner in die ESPHome-Konfiguration eingefügt. `active: true` muss aktiviert bleiben. Die Smartphone-App sollte von der Waage getrennt und die Waage durch kurzes Betreten aufgeweckt werden.

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
                "FG2431 gefunden: Adresse=%s, Name=%s, RSSI=%d",
                x.address_str().c_str(),
                x.get_name().c_str(),
                x.get_rssi()
              );
            }
```

In den Protokollen des ESPHome-Geräts erscheint anschließend eine Zeile ähnlich dieser:

```text
FG2431 gefunden: Adresse=AA:BB:CC:DD:EE:FF, Name=JEETIF2431, RSSI=-55
```

Die angezeigte Adresse wird in `ble_client.mac_address` übernommen. Danach muss der temporäre Block `on_ble_advertise` wieder entfernt werden; `esp32_ble_tracker` selbst bleibt bestehen. Diagnoseprotokolle können MAC-Adressen anderer Geräte in der Umgebung enthalten und sollten deshalb vor einer Veröffentlichung geprüft werden.

### Personenerkennung und Plausibilitätsprüfung

`min_weight` und `max_weight` sind einschließlich angegebene Kilogrammwerte und dürfen sich nicht überschneiden. Wenn ein finales Gewicht in keinen Bereich fällt, wird es protokolliert, aber keinem Profil zugeordnet.

Ein Paket wird nur akzeptiert, wenn es über FFB3 eingeht, die finale Kennung `00 A3` enthält und plausible Werte liefert. Ein Puls oder eine Impedanz von null bedeutet, dass dieser Messwert nicht verfügbar war.

## Home-Assistant-Integration

Die optionale Integration `FG2431 Body Metrics` verwendet die finalen Gewichts- und Impedanzwerte zur Schätzung von:

- BMI;
- Körperfettanteil;
- Körperwasseranteil.

Zusätzlich werden Gewicht, Puls und Impedanz in einem übersichtlichen Home-Assistant-Gerät pro Person zusammengeführt. Kurz aufeinanderfolgende Sensoränderungen werden gruppiert, damit die Werte eines finalen BLE-Pakets gemeinsam erscheinen.

### Installation über HACS

1. In HACS `https://github.com/CjonesLAB/ESPHome-FG2431-BLE` als benutzerdefiniertes Repository vom Typ **Integration** hinzufügen.
2. `FG2431 BLE for ESPHome and Home Assistant` installieren.
3. Home Assistant neu starten.
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen → FG2431 Body Metrics** öffnen.
5. Für jede Person ein Profil anlegen und die zugehörigen ESPHome-Sensoren für Gewicht, Puls und Impedanz sowie Körpergröße und Berechnungsprofil auswählen.

Für eine manuelle Installation wird der Ordner `custom_components/fg2431_body_metrics` nach `/config/custom_components/` kopiert. Anschließend muss Home Assistant neu gestartet werden.

### Berechnungen und Einschränkungen

Die Impedanzgleichungen basieren auf den von [Sun et al. (2003)](https://ajcn.nutrition.org/article/S0002-9165%2823%2905611-3/fulltext) veröffentlichten Gleichungen für fettfreie Masse und Gesamtkörperwasser bei Erwachsenen. Sie werden ebenfalls vom Open-Source-Projekt [openScale](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bluetooth/libs/StandardImpedanceLib.kt) eingesetzt. Dieses Projekt enthält eine unabhängige Implementierung.

Bioimpedanzwerte von Personenwaagen sind Schätzwerte und werden unter anderem durch Flüssigkeitsversorgung, Sport, Mahlzeiten und Kontaktqualität beeinflusst. Sie eignen sich zur Beobachtung persönlicher Trends, aber nicht als medizinische Messung, Diagnose oder Behandlungsempfehlung.

## Auswählbare Lovelace-Karte

Ab Version 1.1.0 ist die Karte **FG2431 Körperanalyse** enthalten. Die Integration lädt sie automatisch. Eine Dashboard-Ressource oder RAW-YAML muss nicht manuell eingetragen werden.

1. Die Integration in HACS aktualisieren beziehungsweise neu herunterladen und Home Assistant neu starten.
2. Ein Dashboard öffnen und **Dashboard bearbeiten → Karte hinzufügen** wählen.
3. Nach `FG2431` suchen und die Karte auswählen.
4. Den Namen der Person eintragen und im visuellen Editor die sechs Sensoren für Gewicht, Puls, Impedanz, BMI, Körperfett und Körperwasser auswählen.
5. Für jede weitere Person eine weitere Instanz der Karte hinzufügen.

Ein Klick auf einen Messwert öffnet den normalen Home-Assistant-Detaildialog des Sensors. Die Karte übernimmt das aktive Home-Assistant-Theme und funktioniert sowohl in Sections- als auch in Masonry-Dashboards.

## Rechtlicher und markenrechtlicher Hinweis

Dies ist ein inoffizielles und unabhängig entwickeltes Interoperabilitätsprojekt. Es ist weder mit dem Hersteller oder einem beteiligten App-Anbieter verbunden noch wurde es von diesen autorisiert, unterstützt oder empfohlen. Sämtliche Produktnamen und Marken gehören ihren jeweiligen Inhabern und werden ausschließlich zur Identifikation kompatibler Hardware verwendet.

Die Software kommuniziert über die reguläre Bluetooth-Schnittstelle mit einem eigenen Gerät des Anwenders. Sie enthält keine Herstellersoftware und stellt keinen Mechanismus zur Umgehung von Verschlüsselung, Zugangskontrollen oder anderen technischen Schutzmaßnahmen bereit. Sie darf nicht verwendet werden, um ohne Zustimmung des Eigentümers auf ein Gerät zuzugreifen.

## Fehlerbehebung

- Die Waage aufwecken und barfuß darauf stehen bleiben, bis die Messung abgeschlossen ist.
- Andere BLE-Clients und die Smartphone-App trennen; viele BLE-Geräte akzeptieren nur eine aktive Verbindung.
- Mit `logger.level: DEBUG` lassen sich Verbindung, Handshake, Plausibilitätsprüfung und Personenzuordnung kontrollieren.
- Wenn keine Körperwerte berechnet werden, prüfen, ob die Impedanz größer als null ist und die ausgewählten Quellsensoren kg beziehungsweise Ω verwenden.
- `ble_client_id` muss exakt mit der unter `ble_client` vergebenen `id` übereinstimmen.

## Lizenz

MIT. Siehe [`LICENSE`](LICENSE).
