#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Stopp
# =============================================================================
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }

if [[ $EUID -ne 0 ]]; then err "Bitte als root ausführen: sudo bash stop.sh"; exit 1; fi

if ! systemctl is-active --quiet schwalmtalzupfer; then
  warn "Schwalmtalzupfer läuft bereits nicht."
  exit 0
fi

info "Stoppe schwalmtalzupfer..."
systemctl stop schwalmtalzupfer
sleep 2

if systemctl is-active --quiet schwalmtalzupfer; then
  err "Konnte nicht gestoppt werden!"
  exit 1
else
  ok "Schwalmtalzupfer gestoppt."
fi

