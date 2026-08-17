#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Status-Übersicht
# =============================================================================
set -uo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
fail() { echo -e "${RED}  ✘  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

echo ""
echo -e "${BOLD}${CYAN}  Schwalmtalzupfer – System-Status${NC}"
hr

# ── Anwendung ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Anwendung (systemd)${NC}"
if systemctl is-active --quiet schwalmtalzupfer 2>/dev/null; then
  ok "schwalmtalzupfer.service  LÄUFT"
  STARTED=$(systemctl show -p ActiveEnterTimestamp schwalmtalzupfer 2>/dev/null | cut -d= -f2)
  echo "     Gestartet seit: $STARTED"
else
  fail "schwalmtalzupfer.service  GESTOPPT"
fi

# ── JAR ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  JAR-Datei${NC}"
JAR="/opt/schwalmtalzupfer/app.jar"
if [[ -f "$JAR" ]]; then
  SIZE=$(du -h "$JAR" | cut -f1)
  MTIME=$(stat -c '%y' "$JAR" | cut -d'.' -f1)
  ok "app.jar vorhanden ($SIZE, zuletzt geändert: $MTIME)"
else
  fail "app.jar NICHT vorhanden in /opt/schwalmtalzupfer/"
fi

if [[ -f "/opt/schwalmtalzupfer/app.jar.backup" ]]; then
  BSIZE=$(du -h "/opt/schwalmtalzupfer/app.jar.backup" | cut -f1)
  echo "     Backup: $BSIZE"
fi

# ── application.yml ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Konfiguration${NC}"
YML="/opt/schwalmtalzupfer/application.yml"
if [[ -f "$YML" ]]; then
  ok "application.yml vorhanden"
  PERMS=$(stat -c '%a' "$YML")
  if [[ "$PERMS" == "600" ]]; then
    ok "Berechtigungen: $PERMS (korrekt)"
  else
    warn "Berechtigungen: $PERMS (sollte 600 sein!)"
  fi
else
  fail "application.yml FEHLT in /opt/schwalmtalzupfer/"
fi

# ── PostgreSQL ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  PostgreSQL${NC}"
if systemctl is-active --quiet postgresql 2>/dev/null; then
  ok "postgresql.service  LÄUFT"
else
  fail "postgresql.service  GESTOPPT"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Nginx${NC}"
if systemctl is-active --quiet nginx 2>/dev/null; then
  ok "nginx.service  LÄUFT"
else
  fail "nginx.service  GESTOPPT"
fi

NGINX_CONF="/etc/nginx/sites-enabled/schwalmtalzupfer"
if [[ -L "$NGINX_CONF" || -f "$NGINX_CONF" ]]; then
  ok "Nginx-Config vorhanden"
else
  warn "Keine Nginx-Config unter sites-enabled/schwalmtalzupfer"
fi

# ── SSL ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  SSL-Zertifikate${NC}"
CERT_DIR="/etc/letsencrypt/live"
if [[ -d "$CERT_DIR" ]]; then
  for domain_dir in "$CERT_DIR"/*/; do
    domain=$(basename "$domain_dir")
    cert="$domain_dir/fullchain.pem"
    if [[ -f "$cert" ]]; then
      EXPIRY=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2 || echo "?")
      # Tage bis Ablauf
      EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
      NOW_EPOCH=$(date +%s)
      DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
      if [[ $DAYS_LEFT -gt 14 ]]; then
        ok "$domain – gültig bis $EXPIRY (noch ${DAYS_LEFT} Tage)"
      elif [[ $DAYS_LEFT -gt 0 ]]; then
        warn "$domain – läuft bald ab: $EXPIRY (noch ${DAYS_LEFT} Tage!)"
      else
        fail "$domain – ABGELAUFEN: $EXPIRY"
      fi
    fi
  done
else
  warn "Keine Let's-Encrypt-Zertifikate gefunden."
fi

# ── Firewall ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Firewall (UFW)${NC}"
if command -v ufw &>/dev/null; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -qi "active"; then
    ok "UFW aktiv"
    ufw status 2>/dev/null | grep -E "(ALLOW|DENY)" | sed 's/^/     /'
  else
    warn "UFW inaktiv!"
  fi
else
  warn "UFW nicht installiert."
fi

# ── Java ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Java${NC}"
if command -v java &>/dev/null; then
  JAVA_V=$(java -version 2>&1 | head -1)
  ok "$JAVA_V"
else
  fail "Java nicht installiert!"
fi

# ── Letzter Log-Eintrag ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Letzte 5 Log-Zeilen${NC}"
journalctl -u schwalmtalzupfer -n 5 --no-pager 2>/dev/null | sed 's/^/     /' || echo "     (kein Log verfügbar)"

echo ""
hr
echo ""

