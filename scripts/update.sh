#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Update (neue JAR deployen)
#
#  Verwendung:
#    Lokal:   scp target/schwalmtalzupfer-*.jar root@SERVER:/tmp/app-new.jar
#    Server:  sudo bash update.sh [/pfad/zur/neuen/app.jar]
#
#  Oder beides in einem:
#    Lokal:   bash scripts/deploy.sh   (nutzt update.sh intern via SSH)
# =============================================================================
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }

if [[ $EUID -ne 0 ]]; then err "Bitte als root ausführen: sudo bash update.sh"; exit 1; fi

APP_DIR="/opt/schwalmtalzupfer"
JAR="$APP_DIR/app.jar"
BACKUP="$APP_DIR/app.jar.backup"

# Neue JAR: entweder als Argument übergeben oder Standard-Upload-Pfad
NEW_JAR="${1:-/tmp/app-new.jar}"

if [[ ! -f "$NEW_JAR" ]]; then
  err "Neue JAR nicht gefunden: $NEW_JAR"
  err ""
  err "Übertrage zuerst die JAR auf den Server:"
  err "  scp target/schwalmtalzupfer-*.jar root@SERVER:/tmp/app-new.jar"
  err "  sudo bash update.sh"
  err ""
  err "Oder direkt:"
  err "  sudo bash update.sh /pfad/zur/neuen/app.jar"
  exit 1
fi

NEW_SIZE=$(du -h "$NEW_JAR" | cut -f1)
info "Neue JAR: $NEW_JAR ($NEW_SIZE)"

# Backup der alten JAR
if [[ -f "$JAR" ]]; then
  OLD_SIZE=$(du -h "$JAR" | cut -f1)
  info "Backup der alten JAR ($OLD_SIZE) → $BACKUP"
  cp "$JAR" "$BACKUP"
  ok "Backup erstellt."
fi

# Service stoppen
if systemctl is-active --quiet schwalmtalzupfer; then
  info "Stoppe schwalmtalzupfer..."
  systemctl stop schwalmtalzupfer
  sleep 2
  ok "Service gestoppt."
fi

# Neue JAR einspielen
info "Deploye neue JAR..."
cp "$NEW_JAR" "$JAR"
chown schwalmtalzupfer:schwalmtalzupfer "$JAR"
chmod 640 "$JAR"
ok "Neue JAR eingespielt."

# Aufräumen
rm -f "$NEW_JAR"

# Service starten
info "Starte schwalmtalzupfer..."
systemctl start schwalmtalzupfer
sleep 4

if systemctl is-active --quiet schwalmtalzupfer; then
  ok "Update erfolgreich! Schwalmtalzupfer läuft mit der neuen Version."
  echo ""
  journalctl -u schwalmtalzupfer -n 10 --no-pager | sed 's/^/     /'
else
  err "Start fehlgeschlagen nach Update!"
  err ""
  if [[ -f "$BACKUP" ]]; then
    warn "Rollback auf alte Version..."
    cp "$BACKUP" "$JAR"
    chown schwalmtalzupfer:schwalmtalzupfer "$JAR"
    systemctl start schwalmtalzupfer
    sleep 3
    if systemctl is-active --quiet schwalmtalzupfer; then
      warn "Rollback erfolgreich – alte Version läuft wieder."
    else
      err "Rollback ebenfalls fehlgeschlagen! Manuelle Intervention nötig."
    fi
  fi
  err "Fehler-Log:"
  journalctl -u schwalmtalzupfer -n 40 --no-pager
  exit 1
fi

