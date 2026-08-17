#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Lokales Deploy-Skript
#  Baut die JAR lokal und überträgt sie per SSH auf den Server.
#
#  Voraussetzungen lokal:
#    - Maven (mvn) installiert
#    - SSH-Zugang zum Server (idealerweise mit SSH-Key, kein Passwort nötig)
#
#  Verwendung:
#    bash scripts/deploy.sh
#    bash scripts/deploy.sh --server root@123.456.78.9
#    bash scripts/deploy.sh --server root@intern.schwalmtalzupfer.de --no-build
# =============================================================================
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }
hr()   { echo -e "${BOLD}────────────────────────────────────────────────────${NC}"; }

# ── Standardwerte ─────────────────────────────────────────────────────────────
SERVER=""
SKIP_BUILD=false
REMOTE_JAR="/tmp/app-new.jar"
SCRIPTS_DIR="/opt/schwalmtalzupfer/scripts"

# ── Argumente parsen ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server|-s) SERVER="$2"; shift 2 ;;
    --no-build)  SKIP_BUILD=true; shift ;;
    *) err "Unbekanntes Argument: $1"; exit 1 ;;
  esac
done

echo ""
echo -e "${BOLD}${CYAN}  Schwalmtalzupfer – Deploy${NC}"
hr
echo ""

# ── Server-Adresse ermitteln ──────────────────────────────────────────────────
if [[ -z "$SERVER" ]]; then
  echo -e "${YELLOW}  ?  SSH-Ziel (z.B. root@123.456.78.9 oder root@intern.schwalmtalzupfer.de):${NC}"
  read -r -p "     → " SERVER
  while [[ -z "$SERVER" ]]; do
    warn "Bitte einen Wert eingeben."
    read -r -p "     → " SERVER
  done
fi

# NEXT_PUBLIC_API_URL wird NICHT gesetzt – Client nutzt relative URLs (kein CORS).

# ── Build ─────────────────────────────────────────────────────────────────────
echo ""
if $SKIP_BUILD; then
  warn "Build übersprungen (--no-build)."
  # Neueste JAR im target/ suchen
  JAR_FILE=$(find target/ -name "*.jar" -not -name "*-sources.jar" 2>/dev/null | sort -t- -k2 | tail -1)
else
  info "Baue JAR mit Maven..."
  echo ""
  mvn clean package -DskipTests
  echo ""
  ok "Build abgeschlossen."
  JAR_FILE=$(find target/ -name "*.jar" -not -name "*-sources.jar" | sort | tail -1)
fi

if [[ -z "$JAR_FILE" || ! -f "$JAR_FILE" ]]; then
  err "Keine JAR-Datei in target/ gefunden!"
  exit 1
fi

SIZE=$(du -h "$JAR_FILE" | cut -f1)
ok "JAR: $JAR_FILE ($SIZE)"

# ── Übertragen ────────────────────────────────────────────────────────────────
echo ""
info "Übertrage JAR auf $SERVER ..."
scp "$JAR_FILE" "$SERVER:$REMOTE_JAR"
ok "Übertragung abgeschlossen."

# ── Skripte übertragen (falls noch nicht vorhanden) ──────────────────────────
echo ""
info "Übertrage Hilfsskripte..."
ssh "$SERVER" "mkdir -p $SCRIPTS_DIR"
scp scripts/update.sh scripts/start.sh scripts/stop.sh scripts/status.sh scripts/logs.sh \
    "$SERVER:$SCRIPTS_DIR/"
ssh "$SERVER" "chmod +x $SCRIPTS_DIR/*.sh"
ok "Skripte übertragen nach $SCRIPTS_DIR"

# ── Update auf Server ausführen ───────────────────────────────────────────────
echo ""
info "Führe Update auf Server aus..."
ssh "$SERVER" "bash $SCRIPTS_DIR/update.sh $REMOTE_JAR"

echo ""
hr
ok "Deploy abgeschlossen!"
echo ""

