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

# NEXT_PUBLIC_API_URL wird NICHT mehr gesetzt – alle Client-Fetches nutzen
# relative URLs (leerer String), damit CORS-Probleme vermieden werden.
# Die --url Angabe wird nur für die Abschlussausgabe verwendet.
ok "App-URL: $API_URL (wird nicht in Bundle eingebettet)"

# ── Java 21 sicherstellen ─────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 1 – Java prüfen${NC}"
hr

find_java21() {
  for c in /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/java-21-openjdk \
            /usr/lib/jvm/temurin-21 /usr/lib/jvm/java-21; do
    [[ -x "$c/bin/javac" ]] && echo "$c" && return 0
  done
  # Generischer Fallback
  find /usr/lib/jvm -maxdepth 2 -name 'javac' 2>/dev/null | while read jc; do
    d=$(dirname "$(dirname "$jc")")
    ver=$("$jc" -version 2>&1 | awk '{print $2}' | cut -d'.' -f1)
    [[ "$ver" -ge 21 ]] 2>/dev/null && echo "$d" && break
  done
}

JAVA21_HOME=$(find_java21)
if [[ -z "$JAVA21_HOME" ]]; then
  info "Kein Java-21-JDK (javac) gefunden – installiere openjdk-21-jdk..."
  apt-get update -qq
  apt-get install -y openjdk-21-jdk -qq
  JAVA21_HOME=$(find_java21)
fi
if [[ -z "$JAVA21_HOME" || ! -x "$JAVA21_HOME/bin/javac" ]]; then
  err "Java-21-JDK konnte nicht installiert werden! Abbruch."
  exit 1
fi
export JAVA_HOME="$JAVA21_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
ok "JAVA_HOME = $JAVA_HOME  |  $(java -version 2>&1 | head -1)  |  $(javac -version 2>&1)"

# ── Maven installieren ────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 2 – Maven prüfen${NC}"
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
echo -e "${BOLD}  Schritt 3 – Node.js prüfen${NC}"
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
echo -e "${BOLD}  Schritt 4 – Quellcode aktualisieren (git pull)${NC}"
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
echo -e "${BOLD}  Schritt 5 – Maven Build${NC}"
hr

# Next.js Build-Cache leeren (wird von mvn clean NICHT entfernt, kann veraltete
# Kompilierungs-Infos enthalten die zu falschen Build-Fehlern führen)
NEXT_CACHE="$APP_DIR/src/main/frontend/.next"
if [[ -d "$NEXT_CACHE" ]]; then
  info "Leere Next.js Build-Cache (.next/) ..."
  rm -rf "$NEXT_CACHE"
  ok "Cache geleert."
fi

# Spring muss laufen, damit generateStaticParams alle CMS-Seiten aus der DB lädt.
BUILD_BACKEND_URL="http://127.0.0.1:8081"
if ! curl -sf "$BUILD_BACKEND_URL/api/pages" -o /dev/null 2>/dev/null; then
  warn "Spring Boot nicht erreichbar unter $BUILD_BACKEND_URL"
  warn "CMS-Seiten (z.B. /sponsoren) werden nur aus Fallback-Slugs gebaut."
  warn "Tipp: Service laufen lassen oder vor dem Build kurz starten."
else
  ok "Spring Boot erreichbar – CMS-Seiten werden aus DB geladen."
fi

info "Starte ./mvnw clean package -DskipTests ..."
info "JAVA_HOME = $JAVA_HOME"
info "BACKEND_URL = $BUILD_BACKEND_URL"
echo ""

BACKEND_URL="$BUILD_BACKEND_URL" "$APP_DIR/mvnw" clean package -DskipTests -Dbackend.url="$BUILD_BACKEND_URL"

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

# Prüfen ob CMS-Routen im JAR landen (sonst Reload → Startseite)
if jar tf "$NEW_JAR" | grep -q 'BOOT-INF/classes/static/sponsoren/index.html'; then
  ok "CMS-Route sponsoren/index.html in JAR vorhanden."
else
  warn "sponsoren/index.html fehlt in JAR – Reload auf Unterseiten zeigt Startseite!"
  warn "Ursache meist: Build ohne laufenden Spring auf Port 8081."
fi

# ── JAR deployen ──────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Schritt 6 – JAR deployen & Service (neu)starten${NC}"
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
