#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Start
# =============================================================================
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }

if [[ $EUID -ne 0 ]]; then err "Bitte als root ausführen: sudo bash start.sh"; exit 1; fi

JAR="/opt/schwalmtalzupfer/app.jar"

if [[ ! -f "$JAR" ]]; then
  err "app.jar nicht gefunden in /opt/schwalmtalzupfer/"
  err "Bitte zuerst die JAR bauen und übertragen (siehe docs/deployment.md)."
  exit 1
fi

if systemctl is-active --quiet schwalmtalzupfer; then
  ok "Schwalmtalzupfer läuft bereits."
  systemctl status schwalmtalzupfer --no-pager -l | head -20
  exit 0
fi

info "Starte schwalmtalzupfer..."
systemctl start schwalmtalzupfer
sleep 3

if systemctl is-active --quiet schwalmtalzupfer; then
  ok "Schwalmtalzupfer erfolgreich gestartet!"
  systemctl status schwalmtalzupfer --no-pager -l | head -10
else
  err "Start fehlgeschlagen! Letzte Log-Zeilen:"
  journalctl -u schwalmtalzupfer -n 30 --no-pager
  exit 1
fi

