# Riftroom Draft Lab

Draft-Werkzeug für League-of-Legends-Teams: Champion-Pools, Übungs-Draft gegen den Computer, Ban- und Pick-Vorschläge, Spielplan mit Zeitleiste und Best in Slot. Auf Deutsch und Englisch.

Die Seite läuft komplett im Browser. Team-Daten bleiben im Browser des jeweiligen Nutzers, es gibt kein Tracking. Nur wer einen Live-Raum nutzt, verbindet sich mit Supabase (Frankfurt); gespeichert wird dort nur der Draft-Stand, ohne Login, und nach einem Tag ohne Änderung gelöscht. Winrates, Matchups und Best in Slot kommen aus allen Turnierspielen seit dem 1. Januar des Vorjahres (Leaguepedia, Profi- und Amateurligen inklusive Prime League) und werden täglich in `data/meta.json` und `data/matchups.json` aktualisiert. Die Rohdaten liegen in `data/pro/games.jsonl`.

Riftroom was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
