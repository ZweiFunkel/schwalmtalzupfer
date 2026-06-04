#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Server-seitiger Build
#  Installiert Maven + Node.js falls nötig, baut die JAR direkt auf dem Server.
#
#  Verwendung (auf dem Server als root):
#    bash /opt/schwalmtalzupfer/scripts/build.sh
#    bash /opt/schwalmtalzupfer/scripts/build.sh --url http://159.195.70.118
#    bash /opt/schwalmtalzupfer/scripts/build.sh --url https://schwalmtalzupfer.de
# =============================================================================
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }
hr()   { echo -e "${BOLD}────────────────────────────────────────────────────${NC}"; }

if [[ $EUID -ne 0 ]]; then err "Bitte als root ausführen: sudo bash build.sh"; exit 1; fi

# ── Argumente ─────────────────────────────────────────────────────────────────
API_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url|-u) API_URL="$2"; shift 2 ;;
    *) shift ;;
  esac
done

APP_DIR="/opt/schwalmtalzupfer"
JAR_TARGET="$APP_DIR/app.jar"
JAR_BACKUP="$APP_DIR/app.jar.backup"

echo ""
echo -e "${BOLD}${CYAN}  Schwalmtalzupfer – Server Build${NC}"
hr
echo ""

# ── API-URL ermitteln ─────────────────────────────────────────────────────────
if [[ -z "$API_URL" ]]; then
  # Aus application.yml den base-url versuchen zu lesen
  YML="$APP_DIR/application.yml"
  if [[ -f "$YML" ]]; then
    DETECTED=$(grep -oP 'base-url:\s*\K[^\s#]+' "$YML" 2>/dev/null | head -1 || true)
    if [[ -n "$DETECTED" && "$DETECTED" != *"localhost"* ]]; then
      API_URL="$DETECTED"
      info "API-URL aus application.yml erkannt: $API_URL"
    fi
  fi
fi

if [[ -z "$API_URL" ]]; then
  warn "Keine API-URL angegeben."
  echo -e "${YELLOW}  ?  Öffentliche URL der App (z.B. http://159.195.70.118 oder https://schwalmtalzupfer.de):${NC}"
  read -r -p "     → " API_URL
  while [[ -z "$API_URL" ]]; do
    warn "Bitte einen Wert eingeben."
    read -r -p "     → " API_URL
  done
fi

ok "NEXT_PUBLIC_API_URL = $API_URL"
export NEXT_PUBLIC_API_URL="$API_URL"

# ── Maven installieren ────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 1 – Maven prüfen${NC}"
hr
if command -v mvn &>/dev/null; then
  MVN_VER=$(mvn -version 2>&1 | head -1)
  ok "Maven bereits installiert: $MVN_VER"
else
  info "Installiere Maven..."
  apt-get update -qq
  apt-get install -y maven -qq
  ok "Maven installiert: $(mvn -version 2>&1 | head -1)"
fi

# ── Node.js installieren ──────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 2 – Node.js prüfen${NC}"
hr
NODE_MIN=18
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  if [[ "$NODE_VER" -ge "$NODE_MIN" ]]; then
    ok "Node.js bereits installiert: $(node --version)"
  else
    warn "Node.js $(node --version) zu alt (brauche ≥$NODE_MIN) – aktualisiere..."
    apt-get install -y nodejs -qq || true
  fi
else
  info "Installiere Node.js 20 (LTS)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y nodejs -qq
  ok "Node.js installiert: $(node --version)"
fi

# npm prüfen
if ! command -v npm &>/dev/null; then
  info "Installiere npm..."
  apt-get install -y npm -qq
fi
ok "npm: $(npm --version)"

# ── Git Pull ──────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 3 – Quellcode aktualisieren (git pull)${NC}"
hr
cd "$APP_DIR"
if [[ -d ".git" ]]; then
  info "git pull..."
  git pull
  ok "Quellcode aktuell."
else
  warn "Kein git-Repo in $APP_DIR – überspringe git pull."
fi

# ── Build ─────────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 4 – Maven Build${NC}"
hr
info "Starte mvn clean package -DskipTests ..."
info "NEXT_PUBLIC_API_URL = $NEXT_PUBLIC_API_URL"
echo ""

mvn clean package -DskipTests

echo ""
ok "Build erfolgreich!"

# Neue JAR finden
NEW_JAR=$(find "$APP_DIR/target" -name "*.jar" -not -name "*-sources.jar" 2>/dev/null | sort | tail -1)
if [[ -z "$NEW_JAR" || ! -f "$NEW_JAR" ]]; then
  err "Keine JAR in target/ gefunden!"
  exit 1
fi
SIZE=$(du -h "$NEW_JAR" | cut -f1)
ok "JAR gebaut: $NEW_JAR ($SIZE)"

# ── JAR deployen ──────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 5 – JAR deployen & Service (neu)starten${NC}"
hr

# Service stoppen falls läuft
if systemctl is-active --quiet schwalmtalzupfer 2>/dev/null; then
  info "Stoppe laufenden Service..."
  systemctl stop schwalmtalzupfer
  sleep 2
  ok "Service gestoppt."
fi

# Backup der alten JAR
if [[ -f "$JAR_TARGET" ]]; then
  cp "$JAR_TARGET" "$JAR_BACKUP"
  ok "Backup erstellt: $JAR_BACKUP"
fi

# Neue JAR einspielen
cp "$NEW_JAR" "$JAR_TARGET"
chown schwalmtalzupfer:schwalmtalzupfer "$JAR_TARGET"
chmod 640 "$JAR_TARGET"
ok "JAR eingespielt: $JAR_TARGET"

# Service starten
info "Starte schwalmtalzupfer..."
systemctl start schwalmtalzupfer
sleep 4

if systemctl is-active --quiet schwalmtalzupfer; then
  ok "Schwalmtalzupfer läuft!"
  echo ""
  journalctl -u schwalmtalzupfer -n 8 --no-pager | sed 's/^/     /'
else
  err "Start fehlgeschlagen! Log:"
  journalctl -u schwalmtalzupfer -n 30 --no-pager
  if [[ -f "$JAR_BACKUP" ]]; then
    warn "Rollback auf alte JAR..."
    cp "$JAR_BACKUP" "$JAR_TARGET"
    chown schwalmtalzupfer:schwalmtalzupfer "$JAR_TARGET"
    systemctl start schwalmtalzupfer
    sleep 3
    systemctl is-active --quiet schwalmtalzupfer && warn "Rollback erfolgreich." || err "Rollback fehlgeschlagen!"
  fi
  exit 1
fi

hr
ok "Fertig! App erreichbar unter: $API_URL"
echo ""

