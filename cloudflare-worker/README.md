# Kostenloser Cloudflare Worker für echtes 15–20-Sekunden `adsb.lol` Live-Tracking (Weltweit)

Dieser winzige Worker läuft im **kostenlosen Cloudflare Workers Free Plan** (100.000 Anfragen/Tag gratis, keine Kreditkarte nötig) und liefert **alle 33 Lufthansa-Group-Flugzeugtypen weltweit** in **einem einzigen Request** (~30 KB gefiltertes JSON, 20 Sekunden Edge-Cache, CORS-offen für deine GitHub-Pages-Website).

---

## Einrichtung in 60 Sekunden (im Browser, ohne Installation)

1. Öffne [dash.cloudflare.com](https://dash.cloudflare.com/) und melde dich kostenlos an.
2. Klicke links auf **Compute (Workers) → Workers & Pages → Create → Start with Hello World!**.
3. Gib als Namen z. B. `lhg-adsb-relay` ein und klicke **Deploy**.
4. Klicke anschließend auf **Edit code**, lösche den Beispielcode komplett und füge den gesamten Inhalt aus [`worker.js`](./worker.js) ein.
5. Klicke oben rechts auf **Save and deploy**.
6. Kopiere deine Worker-URL (z. B. `https://lhg-adsb-relay.deinname.workers.dev`) und teste sie kurz im Browser:
   - `https://lhg-adsb-relay.deinname.workers.dev/lhg-live` → zeigt sofort live alle Lufthansa-Group-Flüge weltweit!
7. Öffne deine Website **Lufthansa Group Radar → Einstellungen**:
   - Trage deine Worker-URL bei **„Eigene CORS-Relay-URL“** ein und klicke **Relay speichern**.
   - Wähle oben als Anbieter **„adsb.lol Direkt / Eigener CORS-Relay“** (Aktualisierungsintervall z. B. **20 Sek.**).

---

## Alternative: 1-Befehl-Deployment per Terminal

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

### Optionales `ADSBLOL_API_KEY` Secret (falls du einen kostenlosen adsb.lol-Key hast)

```bash
npx wrangler secret put ADSBLOL_API_KEY
```
(Alternativ kannst du den Key auch einfach lokal in den Website-Einstellungen eintragen.)
