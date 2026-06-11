#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Vollständiges Installations-Skript
#  Ausführen als root auf dem Zielserver:  bash install.sh
# =============================================================================
set -euo pipefail

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
err()  { echo -e "${RED}  ✘  $*${NC}" >&2; }
hr()   { echo -e "${BOLD}────────────────────────────────────────────────────${NC}"; }
ask()  { echo -e "${YELLOW}  ?  $*${NC}"; }

# ── Root-Prüfung ──────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Dieses Skript muss als root ausgeführt werden."
  err "Starte es mit:  sudo bash install.sh"
  exit 1
fi

clear
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║    Schwalmtalzupfer – Server-Installations-Skript    ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
warn "Dieses Skript richtet alles ein, was zum Betrieb der App benötigt wird."
warn "Bitte alle Fragen sorgfältig beantworten."
echo ""

# =============================================================================
#  SCHRITT 0 – Benutzereingaben sammeln
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 0 – Konfiguration abfragen${NC}"
hr
echo ""

# Hilfsfunktion: Eingabe lesen (mit Default)
read_val() {
  local prompt="$1" default="$2" var="$3"
  ask "$prompt"
  if [[ -n "$default" ]]; then
    echo -e "     ${CYAN}(Standard: $default – einfach Enter drücken)${NC}"
  fi
  read -r -p "     → " input
  if [[ -z "$input" && -n "$default" ]]; then
    input="$default"
  fi
  while [[ -z "$input" ]]; do
    warn "Dieser Wert darf nicht leer sein."
    read -r -p "     → " input
  done
  printf -v "$var" '%s' "$input"
}

# Passwort lesen (versteckt)
read_pass() {
  local prompt="$1" var="$2"
  ask "$prompt"
  while true; do
    read -r -s -p "     → " pass1; echo ""
    read -r -s -p "     → (Wiederholen) " pass2; echo ""
    if [[ "$pass1" == "$pass2" && -n "$pass1" ]]; then
      printf -v "$var" '%s' "$pass1"
      break
    else
      warn "Passwörter stimmen nicht überein oder leer. Nochmal."
    fi
  done
}

# Ja/Nein
ask_yn() {
  local prompt="$1" default="${2:-y}"
  ask "$prompt [j/N, Standard: $default]"
  read -r -p "     → " yn
  yn="${yn:-$default}"
  [[ "$yn" =~ ^[jJyY]$ ]]
}

# ── Domain / IP ───────────────────────────────────────────────────────────────
echo -e "${BOLD}  Netzwerk & Domain${NC}"
echo ""
read_val "Subdomain der App (z.B. intern.schwalmtalzupfer.de)" "" APP_DOMAIN
read_val "Server-IP-Adresse (externe IPv4)" "" SERVER_IP

echo ""
echo -e "${BOLD}  Datenbank (PostgreSQL)${NC}"
echo ""
read_val "PostgreSQL-Datenbankname" "zupfer" DB_NAME
read_val "PostgreSQL-Benutzername" "zupfer" DB_USER
read_pass "Neues PostgreSQL-Passwort für Benutzer '$DB_USER'" DB_PASS

echo ""
echo -e "${BOLD}  Spring Boot${NC}"
echo ""
read_val "Server-Port der Anwendung (intern, z.B. 8081)" "8081" APP_PORT

echo ""
info "Generiere zufälligen AES-Key (32 Byte)..."
AUTO_AES=$(openssl rand -base64 32 | tr -d '\n')
echo -e "     ${GREEN}Automatisch generiert: $AUTO_AES${NC}"
ask "Eigenen AES-Key eingeben? (Enter = generierten verwenden)"
read -r -p "     → " custom_aes
AES_KEY="${custom_aes:-$AUTO_AES}"

echo ""
echo -e "${BOLD}  E-Mail (Gmail SMTP)${NC}"
echo ""
read_val "Gmail-Adresse des Vereins" "schwalmtalzupfer@gmail.com" MAIL_USER
ask "Google App-Passwort für SMTP"
echo -e "     ${CYAN}(Kein normales Login-Passwort! Unter myaccount.google.com → Sicherheit → App-Passwörter)${NC}"
read -r -s -p "     → " MAIL_PASS; echo ""
read_val "Absender-Adresse (From)" "noreply@schwalmtalzupfer.de" MAIL_FROM
read_val "Empfänger Kontaktformular (To)" "info@schwalmtalzupfer.de" MAIL_TO

echo ""
echo -e "${BOLD}  Cloudflare R2 Storage${NC}"
echo ""
read_val "R2 Endpoint-URL (https://<AccountID>.r2.cloudflarestorage.com)" "" R2_ENDPOINT
read_val "R2 Access Key" "" R2_ACCESS
ask "R2 Secret Key"
read -r -s -p "     → " R2_SECRET; echo ""
read_val "R2 Bucket-Name" "schwalmtalzupfer" R2_BUCKET
read_val "R2 Public-URL (leer lassen falls nicht vorhanden)" "" R2_PUBLIC

echo ""
echo -e "${BOLD}  YouTube${NC}"
echo ""
read_val "YouTube Data API Key (Google Cloud Console)" "" YT_KEY

echo ""
hr
echo ""
echo -e "${BOLD}  Zusammenfassung:${NC}"
echo ""
echo "  App-Domain    : $APP_DOMAIN"
echo "  Server-IP     : $SERVER_IP"
echo "  App-Port      : $APP_PORT"
echo "  DB-Name       : $DB_NAME"
echo "  DB-User       : $DB_USER"
echo "  DB-Passwort   : ****"
echo "  Mail-User     : $MAIL_USER"
echo "  Mail-From     : $MAIL_FROM"
echo "  Mail-To       : $MAIL_TO"
echo "  R2-Bucket     : $R2_BUCKET"
echo ""
if ! ask_yn "Alles korrekt? Installation starten?"; then
  err "Installation abgebrochen."
  exit 0
fi
echo ""

# =============================================================================
#  SCHRITT 1 – System aktualisieren & Pakete installieren
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 1 – Systempakete prüfen & installieren${NC}"
hr
echo ""

install_if_missing() {
  local pkg="$1" check_cmd="${2:-$1}"
  if command -v "$check_cmd" &>/dev/null; then
    ok "$pkg ist bereits installiert."
  else
    info "Installiere $pkg ..."
    apt-get install -y "$pkg" -qq
    ok "$pkg installiert."
  fi
}

info "System-Update..."
apt-get update -qq
ok "Paketlisten aktualisiert."

# Curl, unzip, gnupg (Basis)
for pkg in curl gnupg ca-certificates lsb-release wget; do
  install_if_missing "$pkg"
done

# ── Java 21 ───────────────────────────────────────────────────────────────────
echo ""
info "Prüfe Java..."
if java -version 2>&1 | grep -q "version \"2[1-9]"; then
  ok "Java 21+ bereits installiert."
else
  info "Installiere OpenJDK 21..."
  # Ubuntu: universe-Repo könnte nötig sein
  apt-get install -y openjdk-21-jre-headless -qq || {
    warn "Direktinstallation fehlgeschlagen. Versuche über adoptium.net..."
    wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor | tee /etc/apt/trusted.gpg.d/adoptium.gpg > /dev/null
    echo "deb https://packages.adoptium.net/artifactory/deb $(lsb_release -sc) main" > /etc/apt/sources.list.d/adoptium.list
    apt-get update -qq
    apt-get install -y temurin-21-jre -qq
  }
  ok "Java 21 installiert."
fi
JAVA_VER=$(java -version 2>&1 | head -1)
ok "Aktive Java-Version: $JAVA_VER"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
echo ""
info "Prüfe PostgreSQL..."
if command -v psql &>/dev/null; then
  ok "PostgreSQL bereits installiert."
else
  info "Installiere PostgreSQL..."
  apt-get install -y postgresql postgresql-client -qq
  systemctl enable postgresql
  systemctl start postgresql
  ok "PostgreSQL installiert und gestartet."
fi
systemctl is-active --quiet postgresql || { info "Starte PostgreSQL..."; systemctl start postgresql; }
ok "PostgreSQL läuft."

# ── Nginx ─────────────────────────────────────────────────────────────────────
echo ""
info "Prüfe Nginx..."
if command -v nginx &>/dev/null; then
  ok "Nginx bereits installiert."
else
  info "Installiere Nginx..."
  apt-get install -y nginx -qq
  systemctl enable nginx
  systemctl start nginx
  ok "Nginx installiert und gestartet."
fi

# ── Certbot ───────────────────────────────────────────────────────────────────
echo ""
info "Prüfe Certbot..."
if command -v certbot &>/dev/null; then
  ok "Certbot bereits installiert."
else
  info "Installiere Certbot (snap)..."
  install_if_missing snapd
  snap install --classic certbot 2>/dev/null || apt-get install -y certbot python3-certbot-nginx -qq
  ok "Certbot installiert."
fi

# ── UFW ───────────────────────────────────────────────────────────────────────
echo ""
info "Prüfe UFW-Firewall..."
if command -v ufw &>/dev/null; then
  ok "UFW bereits installiert."
else
  info "Installiere UFW..."
  apt-get install -y ufw -qq
  ok "UFW installiert."
fi

# =============================================================================
#  SCHRITT 2 – Systembenutzer anlegen
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 2 – Anwendungsbenutzer${NC}"
hr
echo ""
APP_USER="schwalmtalzupfer"
APP_DIR="/opt/schwalmtalzupfer"

if id "$APP_USER" &>/dev/null; then
  ok "Benutzer '$APP_USER' existiert bereits."
else
  info "Lege Systembenutzer '$APP_USER' an..."
  useradd -r -s /bin/false -d "$APP_DIR" "$APP_USER"
  ok "Benutzer '$APP_USER' angelegt."
fi

if [[ -d "$APP_DIR" ]]; then
  ok "Verzeichnis '$APP_DIR' existiert bereits."
else
  info "Erstelle $APP_DIR ..."
  mkdir -p "$APP_DIR"
  ok "Verzeichnis erstellt."
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR"
ok "Berechtigungen gesetzt."

# =============================================================================
#  SCHRITT 3 – PostgreSQL-Datenbank einrichten
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 3 – Datenbank einrichten${NC}"
hr
echo ""

# Prüfen ob DB-User bereits existiert
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  ok "DB-Benutzer '$DB_USER' existiert bereits."
  info "Setze Passwort neu..."
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
  ok "Passwort aktualisiert."
else
  info "Erstelle DB-Benutzer '$DB_USER'..."
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
  ok "Benutzer erstellt."
fi

# Prüfen ob DB existiert
if sudo -u postgres psql -lqt | cut -d '|' -f1 | grep -qw "$DB_NAME"; then
  ok "Datenbank '$DB_NAME' existiert bereits."
else
  info "Erstelle Datenbank '$DB_NAME'..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null
  ok "Datenbank erstellt."
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null
ok "Datenbankrechte gesetzt."

# =============================================================================
#  SCHRITT 4 – application.yml prüfen / anlegen
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 4 – application.yml${NC}"
hr
echo ""

APP_YML="$APP_DIR/application.yml"

create_yml() {
  info "Erstelle $APP_YML ..."
  cat > "$APP_YML" <<EOYML
spring:
  mvc:
    pathmatch:
      matching-strategy: ant_path_matcher
  datasource:
    url: jdbc:postgresql://localhost:5432/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASS}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    baseline-version: 2
  session:
    store-type: jdbc
    jdbc:
      initialize-schema: never
    timeout: 30d
  threads:
    virtual:
      enabled: true
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${MAIL_USER}
    password: ${MAIL_PASS}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
      mail.smtp.starttls.required: true
      mail.smtp.connectiontimeout: 5000
      mail.smtp.timeout: 5000

app:
  security:
    aes-key: ${AES_KEY}
  r2:
    endpoint: ${R2_ENDPOINT}
    access-key: ${R2_ACCESS}
    secret-key: ${R2_SECRET}
    bucket: ${R2_BUCKET}
    public-url: ${R2_PUBLIC}
  invitation:
    base-url: https://${APP_DOMAIN}
    token-validity-hours: 72
  mail:
    from: ${MAIL_FROM}
    to: ${MAIL_TO}

youtube:
  api:
    key: ${YT_KEY}

server:
  port: ${APP_PORT}
EOYML
  chown "$APP_USER":"$APP_USER" "$APP_YML"
  chmod 600 "$APP_YML"
  ok "application.yml erstellt (chmod 600)."
}

check_yml_field() {
  local label="$1" pattern="$2"
  if grep -q "$pattern" "$APP_YML" 2>/dev/null; then
    warn "application.yml: Feld '$label' enthält noch Platzhalter/Standardwert!"
    return 1
  fi
  return 0
}

if [[ -f "$APP_YML" ]]; then
  ok "application.yml bereits vorhanden – prüfe auf Platzhalter..."
  NEEDS_FIX=0
  check_yml_field "datasource.url"       "<DB_HOST>"            || NEEDS_FIX=1
  check_yml_field "datasource.password"  "your-db-password"     || NEEDS_FIX=1
  check_yml_field "datasource.password"  "4sBWvVy3hlmg"         || NEEDS_FIX=1
  check_yml_field "mail.password"        "niehutmjtmmeqpzb"     || NEEDS_FIX=1
  check_yml_field "mail.password"        "GMAIL_APP"            || NEEDS_FIX=1
  check_yml_field "aes-key"              "bitte-32-zeichen"     || NEEDS_FIX=1
  check_yml_field "aes-key"              "dein-32-zeichen"      || NEEDS_FIX=1
  check_yml_field "base-url"             "localhost"            || NEEDS_FIX=1
  check_yml_field "r2.access-key"        "your-r2-access-key"   || NEEDS_FIX=1
  check_yml_field "r2.secret-key"        "your-r2-secret-key"   || NEEDS_FIX=1
  check_yml_field "youtube"              "YOUTUBE_API_KEY_HIER"  || NEEDS_FIX=1

  if [[ $NEEDS_FIX -eq 1 ]]; then
    warn "Die vorhandene application.yml enthält noch Platzhalter!"
    if ask_yn "Soll sie mit den eingegebenen Werten ÜBERSCHRIEBEN werden?"; then
      create_yml
    else
      warn "application.yml wurde NICHT geändert – bitte manuell korrigieren!"
    fi
  else
    ok "application.yml sieht gut aus – keine offensichtlichen Platzhalter gefunden."
  fi
else
  create_yml
fi

# =============================================================================
#  SCHRITT 5 – JAR-Datei prüfen
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 5 – JAR-Datei${NC}"
hr
echo ""

JAR_PATH="$APP_DIR/app.jar"

if [[ -f "$JAR_PATH" ]]; then
  JAR_SIZE=$(du -h "$JAR_PATH" | cut -f1)
  ok "app.jar gefunden ($JAR_SIZE)."
else
  warn "KEINE app.jar in $APP_DIR gefunden!"
  info "Die JAR muss zuerst gebaut und übertragen werden:"
  echo ""
  echo "     Lokal im Projektordner:"
  echo "     ┌─────────────────────────────────────────────────────────────┐"
  echo "     │  export NEXT_PUBLIC_API_URL=https://$APP_DOMAIN             │"
  echo "     │  mvn clean package -DskipTests                              │"
  echo "     │  scp target/schwalmtalzupfer-*.jar root@$SERVER_IP:$JAR_PATH │"
  echo "     └─────────────────────────────────────────────────────────────┘"
  echo ""
  warn "Nach dem Übertragen der JAR: systemctl start schwalmtalzupfer"
fi

# =============================================================================
#  SCHRITT 6 – Systemd-Service einrichten
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 6 – Systemd-Service${NC}"
hr
echo ""

SERVICE_FILE="/etc/systemd/system/schwalmtalzupfer.service"

if [[ -f "$SERVICE_FILE" ]]; then
  ok "Service-Datei bereits vorhanden – wird aktualisiert."
fi

info "Schreibe $SERVICE_FILE ..."
cat > "$SERVICE_FILE" <<EOSVC
[Unit]
Description=Schwalmtalzupfer Spring Boot App
After=network.target postgresql.service

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/java -jar ${JAR_PATH} \\
  --spring.config.location=file:${APP_YML}
SuccessExitStatus=143
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=schwalmtalzupfer
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOSVC

systemctl daemon-reload
systemctl enable schwalmtalzupfer
ok "Service 'schwalmtalzupfer' aktiviert (Autostart an)."

# =============================================================================
#  SCHRITT 7 – Nginx konfigurieren
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 7 – Nginx-Konfiguration${NC}"
hr
echo ""

NGINX_CONF="/etc/nginx/sites-available/schwalmtalzupfer"
NGINX_LINK="/etc/nginx/sites-enabled/schwalmtalzupfer"

if [[ -f "$NGINX_CONF" ]]; then
  info "Nginx-Konfig bereits vorhanden – wird aktualisiert."
fi

info "Schreibe $NGINX_CONF ..."
cat > "$NGINX_CONF" <<EONGINX
# Schwalmtalzupfer – ${APP_DOMAIN}
# Bestehende Typo3-Seite (www.schwalmtalzupfer.de) bleibt unberührt.

server {
    listen 80;
    server_name ${APP_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${APP_DOMAIN};

    # SSL – von Certbot befüllt:
    ssl_certificate     /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Sicherheits-Header
    add_header X-Frame-Options            "SAMEORIGIN"                    always;
    add_header X-Content-Type-Options     "nosniff"                       always;
    add_header X-XSS-Protection           "1; mode=block"                 always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security  "max-age=63072000; includeSubDomains" always;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        add_header         Cache-Control "public, max-age=86400";
    }
}
EONGINX

# Symlink anlegen (falls noch nicht vorhanden)
if [[ ! -L "$NGINX_LINK" ]]; then
  ln -s "$NGINX_CONF" "$NGINX_LINK"
  ok "Nginx-Symlink gesetzt."
else
  ok "Nginx-Symlink bereits vorhanden."
fi

# Nginx-Config testen
if nginx -t 2>/dev/null; then
  ok "Nginx-Konfiguration valide."
else
  warn "Nginx-Konfiguration hat Fehler – prüfe mit: nginx -t"
fi

# =============================================================================
#  SCHRITT 8 – SSL-Zertifikat (Let's Encrypt)
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 8 – SSL-Zertifikat (Let's Encrypt)${NC}"
hr
echo ""

CERT_PATH="/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem"

if [[ -f "$CERT_PATH" ]]; then
  ok "SSL-Zertifikat für $APP_DOMAIN bereits vorhanden."
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "unbekannt")
  ok "Gültig bis: $EXPIRY"
else
  warn "Noch kein SSL-Zertifikat vorhanden."
  info "Voraussetzung: DNS-Eintrag für $APP_DOMAIN muss bereits auf $SERVER_IP zeigen."
  echo ""
  if ask_yn "Soll jetzt automatisch ein Let's-Encrypt-Zertifikat angefordert werden?"; then
    # Temporär Nginx ohne SSL starten (noch kein Zertifikat)
    # Erst eine einfache HTTP-only Config zum Validieren nutzen
    cat > /tmp/nginx_temp_certbot.conf <<EOTMP
server {
    listen 80;
    server_name ${APP_DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / { return 200 'ok'; }
}
EOTMP
    mkdir -p /var/www/certbot

    # SSL-Zeilen aus Nginx-Config temporär auskommentieren falls Zertifikat noch fehlt
    sed -i 's|ssl_certificate |#ssl_certificate |g; s|ssl_certificate_key |#ssl_certificate_key |g; s|include.*options-ssl|#include-ssl|g; s|ssl_dhparam|#ssl_dhparam|g' "$NGINX_CONF"
    # Port 443 ssl ohne Zertifikat würde crashen → auf 80 hören für Certbot
    sed -i 's|listen 443 ssl;|listen 443;|g' "$NGINX_CONF"
    systemctl reload nginx 2>/dev/null || true

    info "Fordere Zertifikat an..."
    if certbot certonly --webroot -w /var/www/certbot -d "$APP_DOMAIN" \
        --non-interactive --agree-tos --email "webmaster@$APP_DOMAIN"; then
      ok "Zertifikat erhalten!"
      # Nginx-Config wiederherstellen
      cp "$NGINX_CONF" "$NGINX_CONF.bak"
      cat > "$NGINX_CONF" <<EONGINX2
# Schwalmtalzupfer – ${APP_DOMAIN}
server {
    listen 80;
    server_name ${APP_DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    http2 on;
    server_name ${APP_DOMAIN};
    ssl_certificate     /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        add_header Cache-Control "public, max-age=86400";
    }
}
EONGINX2
      nginx -t && systemctl reload nginx && ok "Nginx neu geladen mit HTTPS."
    else
      err "Zertifikatsanfrage fehlgeschlagen!"
      warn "Mögliche Ursache: DNS-Eintrag für $APP_DOMAIN zeigt noch nicht auf $SERVER_IP."
      warn "DNS prüfen, dann manuell ausführen:"
      warn "  certbot --nginx -d $APP_DOMAIN"
    fi
  else
    warn "Kein SSL-Zertifikat angefordert."
    warn "Manuell ausführen sobald DNS gesetzt:  certbot --nginx -d $APP_DOMAIN"
  fi
fi

# Auto-Renewal sicherstellen
if systemctl is-enabled --quiet certbot.timer 2>/dev/null; then
  ok "Certbot-Auto-Renewal bereits aktiv."
elif crontab -l 2>/dev/null | grep -q certbot; then
  ok "Certbot-Renewal-Cron bereits vorhanden."
else
  info "Richte Certbot-Auto-Renewal ein..."
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
  ok "Certbot-Renewal-Cron gesetzt (täglich 03:00 Uhr)."
fi

# =============================================================================
#  SCHRITT 9 – Firewall (UFW)
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 9 – Firewall (UFW)${NC}"
hr
echo ""

info "Konfiguriere UFW..."
ufw --force reset > /dev/null 2>&1

ufw default deny incoming  > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH           > /dev/null
ufw allow 'Nginx Full'      > /dev/null
ufw deny "$APP_PORT"        > /dev/null   # Spring Boot NICHT direkt erreichbar

ufw --force enable > /dev/null
ok "UFW aktiviert. Regeln:"
ufw status numbered 2>/dev/null | grep -v "^$" | sed 's/^/     /'

# =============================================================================
#  SCHRITT 10 – Service starten (falls JAR vorhanden)
# =============================================================================
hr
echo -e "${BOLD}  SCHRITT 10 – Anwendung starten${NC}"
hr
echo ""

if [[ -f "$JAR_PATH" ]]; then
  info "Starte schwalmtalzupfer..."
  systemctl start schwalmtalzupfer
  sleep 3
  if systemctl is-active --quiet schwalmtalzupfer; then
    ok "Anwendung läuft!"
  else
    err "Start fehlgeschlagen. Log:"
    journalctl -u schwalmtalzupfer -n 20 --no-pager | sed 's/^/     /'
  fi
else
  warn "Keine app.jar → Service wird erst gestartet, wenn die JAR übertragen wurde."
  warn "Danach:  systemctl start schwalmtalzupfer"
fi

systemctl reload nginx 2>/dev/null || true

# =============================================================================
#  FERTIG
# =============================================================================
hr
echo ""
echo -e "${BOLD}${GREEN}  ✔  Installation abgeschlossen!${NC}"
echo ""
echo -e "  ${BOLD}Nächste Schritte:${NC}"
echo ""

if [[ ! -f "$JAR_PATH" ]]; then
  echo -e "  ${YELLOW}1. JAR bauen & übertragen:${NC}"
  echo "     export NEXT_PUBLIC_API_URL=https://$APP_DOMAIN"
  echo "     mvn clean package -DskipTests"
  echo "     scp target/schwalmtalzupfer-*.jar root@$SERVER_IP:$JAR_PATH"
  echo ""
  echo -e "  ${YELLOW}2. Service starten:${NC}"
  echo "     systemctl start schwalmtalzupfer"
  echo ""
  echo -e "  ${YELLOW}3. Falls SSL noch nicht eingerichtet:${NC}"
  echo "     certbot --nginx -d $APP_DOMAIN"
  echo ""
else
  echo -e "  ${GREEN}Die App ist erreichbar unter: https://$APP_DOMAIN${NC}"
  echo ""
  echo -e "  ${CYAN}Logs:    journalctl -u schwalmtalzupfer -f${NC}"
  echo -e "  ${CYAN}Status:  systemctl status schwalmtalzupfer${NC}"
fi

echo ""
echo -e "  ${CYAN}Hilfsskripte:${NC}"
echo "     bash start.sh    – App starten"
echo "     bash stop.sh     – App stoppen"
echo "     bash update.sh   – Neue JAR deployen"
echo "     bash status.sh   – Status anzeigen"
echo "     bash logs.sh     – Live-Logs anzeigen"
echo ""
hr

