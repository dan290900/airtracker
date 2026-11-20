# Datenquellen, API-Limits, CORS-Analyse & Einschränkungen

Dieses Dokument beschreibt transparent sämtliche in **Lufthansa Group Radar – Live Flight Tracking & Fleet Explorer** eingesetzten Datenquellen, API-Prüfungen (Stand November 2026), Sicherheitskonzepte und technischen Rahmenbedingungen für reines statisches Hosting auf GitHub Pages.

---

## 1. Live-ADS-B-Datenquellen im Vergleich

Vor der Implementierung wurden alle relevanten kostenlosen ADS-B-Anbieter direkt auf Datenformat, Rate-Limits, Lizenz und **Browser-CORS-Header (`Access-Control-Allow-Origin`)** geprüft:

| Anbieter | Endpunkt | Kostenlos / Key | Browser-CORS (`Access-Control-Allow-Origin`) | Lizenz | Einsatz in dieser App |
|---|---|---|---|---|---|
| **adsb.lol** (bevorzugt) | `https://api.adsb.lol/v2/point/{lat}/{lon}/{distNm}` (250 NM) + `https://api.adsb.lol/v2/type/{types}` (weltweit) | 500 Req/Tag pro IP ohne Key; 1.000/Tag (adhoc) bzw. 7.200/Tag (Feeder) via `x-api-key` | **Nein** (kein CORS-Header, `OPTIONS` liefert HTTP 405) | ODbL 1.0 | **Standard-Live-Feed (Weltweit Hybrid)** via GitHub Actions (`live-data` Branch, CORS-offen über `raw.githubusercontent.com`), lokaler Vite-Dev-Proxy sowie optionaler Custom-CORS-Relay |
| **FlyItalyADSB** | `https://api.flyitalyadsb.com/v2/lat/{lat}/{lon}/dist/{km}?fields=light` (500 km) + `/v2/type/{type}?fields=light` (weltweit) | Kostenloser Self-Serve-Key per E-Mail (30 Req/Min, 300.000 Req/Monat, kommerziell erlaubt) | **Ja (`*`)**, inkl. `X-Api-Key` in `Access-Control-Allow-Headers` | CC BY-SA 4.0 | **Direkter Echtzeit-Browser-Modus (Weltweit Hybrid)** direkt von GitHub Pages ohne Proxy, Key lokal im `localStorage` |
| **adsb.fi** | `https://opendata.adsb.fi/api/v2/lat/{lat}/{lon}/dist/{distNm}` | Kostenlos (persönlich/nicht-kommerziell), ~1 Req/s | **Nein** | Community Open Data | Optional über eigene CORS-Relay-URL oder lokalen Dev-Proxy |
| **airplanes.live** | `https://api.airplanes.live/v2/point/...` | Eingeschränkt | **Blockiert** (HTTP 403 bei gesetztem `Origin`-Header) | — | Nicht verwendet |
| **OpenSky Network** | `https://opensky-network.org/api/states/all` | OAuth2-Client erforderlich; kein Flugzeugtyp & keine Registrierung im State-Vector | **Nein** | OpenSky Terms | Nicht verwendet |

### Warum der zweistufige Weltweit-Hybrid-Ansatz für GitHub Pages optimal ist

1. **Sofort lauffähig ohne API-Key & ohne eigenes Backend (`adsb.lol Live-Feed · Weltweit`):**
   Da `api.adsb.lol` keine CORS-Header an Browser ausliefert, ruft ein kostenloser **GitHub-Actions-Workflow** (`.github/workflows/update-live-feed.yml`) alle 10 Minuten echte ADS-B-Positionen über **6 europäische 250-NM-Korridore** (`/v2/point/...`) **plus 3 gebündelte weltweite Typ-Abfragen** (`/v2/type/...` über alle 25 Lufthansa-Group-Flugzeugtypen) ab und speichert das gefilterte Ergebnis im separaten Orphan-Branch `live-data`. GitHub Raw liefert diese Datei mit `Access-Control-Allow-Origin: *` direkt an die statische GitHub-Pages-Website aus.
2. **Direktes Echtzeit-Polling weltweit (`FlyItalyADSB Direct Live · Weltweit`):**
   Wer direkt im Browser ohne Zeitversatz live abfragen möchte, kann sich unter [flyitalyadsb.com/en/data/api/](https://flyitalyadsb.com/en/data/api/) in 30 Sekunden einen kostenlosen API-Key holen und diesen in den **Einstellungen** (oder im API-Key-Dialog) hinterlegen. Die App kombiniert 6 europäische 500-km-Zonen, 15 weltweite Langstrecken-/Frachter-Typen (`/v2/type/{type}?fields=light`) sowie einen dynamischen 500-km-Viewport-Scan bei Verschieben der Karte — stets mit intelligentem Caching unterhalb des 30-Req/Min-Free-Limits. Der Key verbleibt ausschließlich im lokalen `localStorage` des Browsers.
3. **Optionaler eigener CORS-Relay für `adsb.lol` / `adsb.fi`:**
   In den Einstellungen kann zusätzlich eine eigene Relay-URL hinterlegt werden, um `api.adsb.lol` (inkl. optionalem `x-api-key`) oder `opendata.adsb.fi` direkt zu proxyn. Im lokalen Entwicklungsmodus (`npm run dev`) übernimmt der eingebaute Vite-Dev-Proxy diese Weiterleitung automatisch.

---

## 2. Ergänzende Live-Anreicherung & Karten-Basemaps (Keyless & CORS-offen)

- **Kartenkacheln (Basemaps, 100 % kostenlos & ohne API-Key):**
  - **Standard-Karte (Hell):** Esri World Street Map (`server.arcgisonline.com`)
  - **OpenStreetMap:** Klassische OSM-Detailkarte (`tile.openstreetmap.org`, © OpenStreetMap-Mitwirkende)
  - **Satellit:** Esri World Imagery + World Boundaries & Places Beschriftung
  - **Dunkelmodus:** Esri World Dark Gray Canvas Base + Reference Labels
  *(Hinweis: CARTO-Basemaps wurden entfernt, da CARTO seit 2026 ein „API KEY REQUIRED“-Wasserzeichen ohne Schlüssel ausliefert.)*
- **Flugrouten (Abflug- & Zielflughafen):** `https://api.adsbdb.com/v0/callsign/{callsign}` (`Access-Control-Allow-Origin: *`, kein Key). Nicht hinterlegte Routen werden transparent als „Nicht verfügbar“ gekennzeichnet und niemals erfunden.
- **Exakte Flugzeugfotos nach Registrierung:** `https://api.planespotters.net/pub/photos/reg/{registration}` (`Access-Control-Allow-Origin: *`, kein Key). Falls für die konkrete Registrierung kein Foto vorliegt, wird automatisch das lizenzierte Wikimedia-Commons-Typfoto der jeweiligen Airline bzw. Baureihe angezeigt.

---

## 3. Geografische Abdeckung & Transparenz

- Im **Weltweit-Hybrid-Modus (`adsb.lol Live-Feed`)** werden kombiniert:
  1. **6 überlappende europäische 250-NM-Korridore (~460 km Radius):** Frankfurt/Rhein-Ruhr, München/Zürich/Wien, Rom/Mailand, Nordsee/UK/Atlantik-Tor, Norddeutschland/Skandinavien, Westliches Mittelmeer/Balearen (erfasst auch Flugzeuge ohne hinterlegtes ICAO-Typfeld).
  2. **Weltweiter Typ-Sweep über alle 25 Lufthansa-Group-Flugzeugtypen** (`A359`, `A35K`, `A388`, `B748`, `B744`, `B789`, `B77W`, `B772`, `B77L`, `B763`, `A333`, `A339`, `A332`, `A343`, `A346`, `A319`, `A320`, `A20N`, `A321`, `A21N`, `BCS1`, `BCS3`, `E190`, `E195`, `CRJ9`): Erfasst damit auch Interkontinentalflüge über Nord- und Südamerika, Afrika, dem Nahen Osten und Asien überall dort, wo terrestrische ADS-B-/MLAT-Empfänger aktiv sind.
- Mit **FlyItalyADSB Direct Live** kombiniert der Browser 6 europäische 500-km-Zonen + 15 weltweite Langstrecken-/Frachter-Typen + einen dynamischen 500-km-Scan für den aktuellen Kartenausschnitt.
- Über Ozeanen (z. B. zentraler Nordatlantik/Pazifik) ohne bodengestützte ADS-B-Empfänger können Flugzeuge systembedingt erst wieder bei Annäherung an Küstenempfänger erscheinen.

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

1. **Terrestrische ADS-B-Funklücken (Ozeane / dünn besiedelte Regionen):** Offene Community-ADS-B-Netzwerke (`adsb.lol`, `FlyItalyADSB`) basieren auf bodengestützten Empfängern und erfassen keine satellitengestützten Ozean-Positionen. Flugzeuge mitten über dem Nordatlantik oder abgelegenen Regionen erscheinen daher erst wieder in Küstennähe.
2. **Update-Takt im schlüssellosen GitHub-Pages-Modus:** GitHub Actions Cron-Jobs laufen ca. alle 10 Minuten (plattformbedingt können Verzögerungen von wenigen Minuten auftreten). Für kontinuierliche Echtzeit-Updates direkt im Browser steht der kostenlose `FlyItalyADSB`-Direktmodus zur Verfügung.
3. **Historische Flugspuren:** Offene Live-ADS-B-APIs liefern keine historischen Tracks ohne bezahlten Tarif. Die App zeichnet deshalb automatisch während der aktiven Sitzung alle beobachteten Positionspunkte auf und stellt daraus die reale Flugstrecke dar.
4. **Codeshares:** ADS-B überträgt das Callsign des ausführenden Betreibers (Operating Carrier), nicht der vermarktenden Codeshare-Airline.
