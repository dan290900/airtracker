# Lufthansa Group Radar – Live Flight Tracking & Fleet Explorer

Eine produktionsreife, statisch auf **GitHub Pages** gehostete Webanwendung zur Live-Beobachtung von Flügen der **Lufthansa Group** auf Basis echter ADS-B-Daten – kombiniert mit einem **Operations Dashboard** und einem umfangreichen **Fleet Explorer** inkl. lizenzierter Luftfahrtfotografie.

> **Hinweis:** Dies ist ein unabhängiges, inoffizielles Luftfahrtprojekt ohne geschäftliche Verbindung zur Deutschen Lufthansa AG oder ihren Tochtergesellschaften. Nicht für navigatorische Zwecke geeignet.

---

## Live-Website

- **GitHub Pages:** https://dan290900.github.io/airtracker/
- **Repository:** https://github.com/dan290900/airtracker

---

## Zentrale Funktionen

1. **Live Flight Radar**
   - Interaktive Weltkarte (Leaflet + CARTO Voyager / Dark Matter) mit nach Flugrichtung rotierten Flugzeug-Silhouetten (4-Strahler, Widebody, Narrowbody/Regional), farbcodiert nach Airline.
   - Multi-Airline-Filter (alle 11 aktiven Konzern-Airlines inkl. Lufthansa, SWISS, Austrian, Brussels, Eurowings/Eurowings Europe, ITA Airways, Discover Airlines, Edelweiss Air, Air Dolomiti, Lufthansa City Airlines, Lufthansa Cargo + historischer Hinweis zu Lufthansa CityLine).
   - Transparente Darstellung der tatsächlich überwachten Abdeckungsradien auf der Karte.
   - Detailpanel (Desktop-Slide-Over / Mobile-Bottom-Sheet) mit Live-ADS-B-Telemetrie, Routen-Anreicherung via `adsbdb.com`, exakten Flugzeugfotos via `Planespotters.net` / Wikimedia Commons, Follow-Modus, während der Sitzung aufgezeichneter Flugstrecke und direktem Sprung in den Fleet Explorer.

2. **Operations Dashboard**
   - Live-KPIs aus den real beobachteten Flügen (Gesamtanzahl, Luft vs. Boden, Ø Flughöhe, Ø Geschwindigkeit, aktive Airlines, häufigster Flugzeugtyp, Top-Region).
   - Interaktive Diagramme (Balkendiagramm pro Airline, Donut-Chart nach Flugzeugtypen, Höhen- und Regionalverteilung).
   - Durchsuchbare, filter- und sortierbare Flugliste (Tabelle auf Desktop, kompakte Karten auf Smartphones) mit Direktfokus auf die Karte.

3. **Fleet Explorer**
   - 20 Flugzeugtypen und Varianten der gesamten Lufthansa Group mit technischen Daten, aktuellen Flottenbeständen (Stand 2026), Quellenangaben und verifizierten Wikimedia-Commons-Fotos samt Urheber- & Lizenzangaben.
   - Bidirektionale Verknüpfung zwischen Live Radar und Fleet Explorer (Live-Zähler je Muster + „Auf Live-Radar filtern“).

4. **Sichere API-Key-Verwaltung & Einstellungen**
   - Läuft **sofort kostenlos ohne API-Key** über den automatisierten `adsb.lol`-Live-Feed (`live-data` Branch via GitHub Actions).
   - Unterstützt **direktes Browser-Echtzeit-Polling** über **FlyItalyADSB** (CORS-offen, kostenloser Self-Serve-Key, 300.000 Anfragen/Monat) sowie eigene CORS-Relays für `adsb.lol` / `adsb.fi`.
   - API-Keys werden niemals im Code gespeichert, sondern ausschließlich lokal im `localStorage` des Browsers, stets maskiert angezeigt und jederzeit änder-/löschbar.
   - Dark Mode (Navy-Design), Favoriten für Registrierungen & Flugzeugtypen, globale `⌘K`-Suche, automatisches Pausieren bei inaktivem Tab.

---

## Technologie-Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4
- **Karte:** Leaflet + CARTO Basemaps
- **Icons:** Lucide React
- **Hosting & Automation:** GitHub Pages + GitHub Actions (`.github/workflows/deploy.yml` & `.github/workflows/update-live-feed.yml`)
- **Laufende Kosten:** **0 €** (vollständig kostenlos über GitHub Pages, GitHub Actions und offene ADS-B-Daten)

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Im lokalen Entwicklungsmodus leitet der eingebaute Vite-Dev-Proxy (`/proxy/adsblol`) Anfragen automatisch direkt an `https://api.adsb.lol` weiter.

### Production Build

```bash
npm run build
npm run preview
```

---

## Weiterführende Dokumentation

Ausführliche Informationen zu API-Tests, CORS-Verhalten, Rate-Limits, Abdeckung und Datenlizenzen finden sich in [docs/DATA_SOURCES_AND_LIMITS.md](docs/DATA_SOURCES_AND_LIMITS.md).
