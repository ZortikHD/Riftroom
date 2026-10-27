# Riftroom Draft Lab

Draft-Werkzeug für League-of-Legends-Teams: Champion-Pools, Übungs-Draft gegen den Computer, Ban- und Pick-Vorschläge, Spielplan mit Zeitleiste und Best in Slot. Auf Deutsch und Englisch.

Die Seite läuft komplett im Browser. Team-Daten bleiben im Browser des jeweiligen Nutzers, es gibt kein Tracking. Winrates (Emerald+, Solo/Duo) kommen von Lolalytics und liegen als veröffentlichter Datensatz in `data/meta.json`. „Meta aktualisieren“ prüft diese Datei erneut; es gibt derzeit keinen täglichen Abrufdienst im Repository. Datenstand und letzter erfolgreicher Abruf werden getrennt angezeigt. Eigene Importe bleiben bis zum bewussten Wechsel zurück auf veröffentlichte Daten aktiv. Bestehende Sicherungen ohne Quellenwahl werden vorsichtshalber als eigener Import behandelt, damit keine Daten überschrieben werden.

Riftroom isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## Prüfung

Mit Node.js 22 oder neuer: `node --test tests/*.test.mjs`. Beide Sprachen verwenden dieselbe Meta-Datenanbindung und Trendberechnung.
