# Arbeitsregeln für Zupfer

- „starte zupfer“: lokale Entwicklungsumgebung starten; „stoppe zupfer“: nur die zugehörigen lokalen Prozesse stoppen.
- Produktionsdeployment ausschließlich nach ausdrücklichem OK des Nutzers für das jeweilige Deployment. Das gilt auch für scripts/build.sh über SSH und Pushes, die Auto-Deployment auslösen.
- Neue Funktionen für mobile Bildschirmgrößen berücksichtigen.
- Suche darf ausschließlich Inhalte liefern, die der jeweilige Benutzer tatsächlich sehen darf. Berechtigungen serverseitig prüfen.
- Deutsch und Englisch bei neuen Oberflächen berücksichtigen. Keine privaten Inhalte an externe Übersetzungsdienste senden.

## Lokale Steuerung
- Start: & ./scripts/local.ps1 start -Wait
- Stop: & ./scripts/local.ps1 stop
- Status: & ./scripts/local.ps1 status
- Nach Start Logs in .zupfer-local prüfen und beide URLs auf Erreichbarkeit testen; erst dann Erfolg melden.


## Aktueller Auftrag
- Englisch umfasst öffentliche Seiten, Mitgliederbereich UND gesamte Verwaltung; CMS-Texte aus der Datenbank einbeziehen.
- SSH ist noch einzurichten. Privater Schlüssel bleibt lokal. Server-IP, Benutzer und Port fehlen.
- Suche ist begonnen (CMS-Seiten, Videos, Playlisttitel); Galerie, Noten und weitere sichtbare Inhalte noch ergänzen. Rollen serverseitig prüfen und Logout-Ergebnisse löschen.
- Native mobile-app: Umfang beim Nutzer noch offen; responsive Website ist verpflichtend.
- Kein Commit/Push/Deployment ohne Prüfung, ob dadurch produktiv aktualisiert würde.


- In Codex Start mit scripts/local.ps1 start -Wait in einer laufenden Terminalsession verwenden, damit Hintergrundprozesse erhalten bleiben. Lokale Website: http://localhost:3000 (Loopback), Backend: http://localhost:8081.


## Verifiziert
- PowerShell 7 verwenden (Codex-Standard-Shell). Lokaler Start und gezielter Stop am 02.10.2026 erfolgreich getestet; beide Ports danach geschlossen.
- Unterrichtsseite und Suchseite HTTP 200. Suche Gitarre liefert öffentliche Treffer, anonyme Suche Dä Stär liefert keine Treffer.
- Fünf SearchControllerTest-Tests und Frontend-TypeScript-Prüfung erfolgreich.
- Sprache Englisch noch NICHT implementiert; Umfang umfasst auch Verwaltung. Datenbankkonfiguration inzwischen korrigiert und Verbindung getestet.
- SSH noch nicht verbunden. Keine Änderungen gepusht oder produktiv deployed.

