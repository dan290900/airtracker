# Datenquellen, API-Limits, CORS-Analyse & Einschränkungen

Dieses Dokument beschreibt transparent sämtliche in **Lufthansa Group Radar – Live Flight Tracking & Fleet Explorer** eingesetzten Datenquellen, API-Prüfungen (Stand November 2026), Sicherheitskonzepte und technischen Rahmenbedingungen für reines statisches Hosting auf GitHub Pages.

---

## 1. Live-ADS-B-Datenquellen im Vergleich

Vor der Implementierung wurden alle relevanten kostenlosen ADS-B-Anbieter direkt auf Datenformat, Rate-Limits, Lizenz und **Browser-CORS-Header (`Access-Control-Allow-Origin`)** geprüft:

| Anbieter | Endpunkt | Kostenlos / Key | Browser-CORS (`Access-Control-Allow-Origin`) | Lizenz | Einsatz in dieser App |
|---|---|---|---|---|---|
| **adsb.lol** (bevorzugt) | `https://api.adsb.lol/v2/point/{lat}/{lon}/{distNm}` (max. 250 NM) | 500 Req/Tag pro IP ohne Key; 1.000/Tag (adhoc) bzw. 7.200/Tag (Feeder) via `x-api-key` | **Nein** (kein CORS-Header, `OPTIONS` liefert HTTP 405) | ODbL 1.0 | **Standard-Live-Feed** via GitHub Actions (`live-data` Branch, CORS-offen über `raw.githubusercontent.com`), lokaler Vite-Dev-Proxy sowie optionaler Custom-CORS-Relay |
| **FlyItalyADSB** | `https://api.flyitalyadsb.com/v2/lat/{lat}/{lon}/dist/{km}` (max. 500 km Free) | Kostenloser Self-Serve-Key per E-Mail (30 Req/Min, 300.000 Req/Monat, kommerziell erlaubt) | **Ja (`*`)**, inkl. `X-Api-Key` in `Access-Control-Allow-Headers` | CC BY-SA 4.0 | **Direkter Echtzeit-Browser-Modus** (15–30 s Polling direkt von GitHub Pages ohne Proxy, Key lokal im `localStorage`) |
| **adsb.fi** | `https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{distNm}` | Kostenlos (persönlich/nicht-kommerziell), ~1 Req/s | **Nein** | Community Open Data | Optional über eigene CORS-Relay-URL oder lokalen Dev-Proxy |
| **airplanes.live** | `https://api.airplanes.live/v2/point/...` | Eingeschränkt | **Blockiert** (HTTP 403 bei gesetztem `Origin`-Header) | — | Nicht verwendet |
| **OpenSky Network** | `https://opensky-network.org/api/states/all` | OAuth2-Client erforderlich; kein Flugzeugtyp & keine Registrierung im State-Vector | **Nein** | OpenSky Terms | Nicht verwendet |

### Warum der zweistufige Ansatz für GitHub Pages optimal ist

1. **Sofort lauffähig ohne API-Key & ohne eigenes Backend (`adsb.lol Live-Feed`):**
   Da `api.adsb.lol` keine CORS-Header an Browser ausliefert, ruft ein kostenloser **GitHub-Actions-Workflow** (`.github/workflows/update-live-feed.yml`) alle 10 Minuten echte ADS-B-Positionen über `https://api.adsb.lol/v2/point/...` in 6 strategischen europäischen Lufthansa-Group-Korridoren ab und speichert das gefilterte Ergebnis im separaten Orphan-Branch `live-data`. GitHub Raw liefert diese Datei mit `Access-Control-Allow-Origin: *` direkt an die statische GitHub-Pages-Website aus.
2. **Direktes 15-Sekunden-Echtzeit-Polling weltweit (`FlyItalyADSB Direct Live`):**
   Wer direkt im Browser ohne Zeitversatz beliebige Weltregionen live abfragen möchte, kann sich unter [flyitalyadsb.com/en/data/api/](https://flyitalyadsb.com/en/data/api/) in 30 Sekunden einen kostenlosen API-Key holen und diesen in den **Einstellungen** (oder im API-Key-Dialog) hinterlegen. Der Key verbleibt ausschließlich im lokalen `localStorage` des Browsers.
3. **Optionaler eigener CORS-Relay für `adsb.lol` / `adsb.fi`:**
   In den Einstellungen kann zusätzlich eine eigene Relay-URL hinterlegt werden, um `api.adsb.lol` (inkl. optionalem `x-api-key`) oder `opendata.adsb.fi` direkt zu proxyn. Im lokalen Entwicklungsmodus (`npm run dev`) übernimmt der eingebaute Vite-Dev-Proxy diese Weiterleitung automatisch.

---

## 2. Ergänzende Live-Anreicherung (Keyless & CORS-offen)

Beim Anklicken eines Flugzeugs auf der Karte fragt der Browser zwei weitere kostenlose, CORS-offene Schnittstellen ab (mit In-Memory-Caching für 15 Minuten):

- **Flugrouten (Abflug- & Zielflughafen):** `https://api.adsbdb.com/v0/callsign/{callsign}` (`Access-Control-Allow-Origin: *`, kein Key). Nicht hinterlegte Routen werden transparent als „Nicht verfügbar“ gekennzeichnet und niemals erfunden.
- **Exakte Flugzeugfotos nach Registrierung:** `https://api.planespotters.net/pub/photos/reg/{registration}` (`Access-Control-Allow-Origin: *`, kein Key). Falls für die konkrete Registrierung kein Foto vorliegt, wird automatisch das lizenzierte Wikimedia-Commons-Typfoto der jeweiligen Airline bzw. Baureihe angezeigt.

---

## 3. Geografische Abdeckung & Transparenz

- Im Standardmodus (**adsb.lol Live-Feed**) werden **6 überlappende 250-NM-Korridore (~460 km Radius)** abgefragt:
  1. Frankfurt & Rhein-Ruhr (FRA / DUS / BRU)
  2. München, Zürich & Wien (MUC / ZRH / VIE)
  3. Rom & Mailand (FCO / LIN / MXP)
  4. Nordsee, UK & Atlantik-Korridor (LHR / AMS / Nordatlantik-Tor)
  5. Norddeutschland & Skandinavien (HAM / BER / CPH)
  6. Westliches Mittelmeer & Balearen (PMI / BCN / NCE)
- Diese Abdeckungsradien werden direkt auf der Karte als gestrichelte Kreise eingeblendet (ein-/ausblendbar). Flüge tief über Nordamerika, Asien oder dem Südatlantik erscheinen im Standard-Feed daher nicht – dies wird im Radar und Operations Dashboard offen kommuniziert.
- Mit **FlyItalyADSB Direct Live** kann jeder beliebige Kartenausschnitt weltweit bis 500 km Radius live gescannt werden.

---

## 4. Sicherheitskonzept für API-Schlüssel

- Es sind **keine API-Schlüssel** im Repository, in JavaScript-Bundles, Umgebungsvariablen oder URL-Parametern enthalten.
- Benutzereigene Schlüssel werden ausschließlich im `localStorage` des jeweiligen Geräts gespeichert, in der Oberfläche stets maskiert (`••••••••XXXX`) dargestellt und per HTTP-Header (`X-Api-Key` bzw. `x-api-key`) ausschließlich an den gewählten ADS-B-Anbieter gesendet.
- Ein sichtbarer Sicherheitshinweis im Dialog und in den Einstellungen klärt darüber auf, dass Daten im `localStorage` bei schädlichem JavaScript (z. B. kompromittierten Browser-Erweiterungen) auslesbar sein könnten.

---

## 5. Flottendaten & Bildlizenzen (Fleet Explorer)

- **Flottendaten:** Recherchiert mit Stand **Juli – Oktober 2026** auf Basis von Lufthansa Group Geschäftsbericht 2025/2026, offiziellen Flottenseiten der Konzern-Airlines, Airbus Orders & Deliveries sowie Wikipedia/Planespotters-Flottenübersichten.
- **Konzernbesonderheiten 2026:**
  - **ITA Airways (`ITY`)** ist als Teil der Lufthansa Group vollständig integriert.
  - **Lufthansa CityLine (`CLH`)** hat den regulären Flugbetrieb im April 2026 eingestellt; der Betrieb wurde an **Lufthansa City Airlines (`LHX`)** übergeben. `CLH` bleibt aus Transparenz- und historischen Gründen im Katalog gekennzeichnet.
- **Bildquellen:** Alle 20 Flugzeugtypen im Fleet Explorer nutzen verifizierte Aufnahmen von **Wikimedia Commons** unter freien Lizenzen (CC BY, CC BY-SA, GFDL, CC0) inklusive Urhebernennung, Lizenzangabe und direktem Quellenlink.

---

## 6. Bekannte Einschränkungen

1. **Keine globale Vollabdeckung im kostenlosen Tarif:** Kostenlose ADS-B-APIs limitieren den Abfrageradius (250 NM bei `adsb.lol`, 500 km bei `FlyItalyADSB` Free). Ein weltweiter Einzelabruf erfordert kostenpflichtige Enterprise-/Pro-Tarife oder den Betrieb eines eigenen ADS-B-Feeders.
2. **Update-Takt im schlüssellosen GitHub-Pages-Modus:** GitHub Actions Cron-Jobs laufen ca. alle 10 Minuten (plattformbedingt können Verzögerungen von wenigen Minuten auftreten). Für 15-Sekunden-Echtzeit-Updates steht der kostenlose `FlyItalyADSB`-Direktmodus zur Verfügung.
3. **Historische Flugspuren:** Offene Live-ADS-B-APIs liefern keine historischen Tracks ohne bezahlten Tarif. Die App zeichnet deshalb automatisch während der aktiven Sitzung alle beobachteten Positionspunkte auf und stellt daraus die reale Flugstrecke dar.
4. **Codeshares:** ADS-B überträgt das Callsign des ausführenden Betreibers (Operating Carrier), nicht der vermarktenden Codeshare-Airline.
