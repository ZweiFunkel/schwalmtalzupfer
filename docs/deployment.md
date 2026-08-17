# 🚀 Deployment-Anleitung – Schwalmtalzupfer

> Ziel: Die Anwendung läuft als eigenständige Spring-Boot-App (integriertes Next.js-Frontend)
> auf dem selben Server wie die bestehende Typo3-Webseite – **ohne** Typo3 zu beeinträchtigen.
> Nginx wird als Reverse-Proxy vor beide Anwendungen gestellt.

---

## 1. Voraussetzungen auf dem Server

| Was | Version | Hinweis |
|-----|---------|---------|
| Java (JDK) | 21+ | `java -version` prüfen |
| PostgreSQL | 14+ | Datenbank-Server |
| Nginx | aktuell | Reverse-Proxy & SSL-Termination |
| Certbot | aktuell | Let's Encrypt SSL |
| Systemd | – | Service-Management |

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y openjdk-21-jre-headless nginx certbot python3-certbot-nginx postgresql
```

---

## 2. PostgreSQL – Datenbank einrichten

```bash
sudo -u postgres psql
```

```sql
CREATE USER zupfer WITH PASSWORD 'SICHERES_PASSWORT_HIER';
CREATE DATABASE zupfer OWNER zupfer;
GRANT ALL PRIVILEGES ON DATABASE zupfer TO zupfer;
\q
```

> ⚠️ Das Passwort merken – es kommt in die `application.yml` (Schritt 4).

---

## 3. Anwendungsbenutzer anlegen (Security Best Practice)

```bash
sudo useradd -r -s /bin/false -d /opt/schwalmtalzupfer schwalmtalzupfer
sudo mkdir -p /opt/schwalmtalzupfer
sudo chown schwalmtalzupfer:schwalmtalzupfer /opt/schwalmtalzupfer
```

---

## 4. JAR-Datei bauen & deployen

### Lokal auf dem Entwicklungsrechner:

```bash
# Im Projektordner:
export NEXT_PUBLIC_API_URL=https://intern.schwalmtalzupfer.de    # ← eigene Domain!
mvn clean package -DskipTests
```

> **Wichtig:** `NEXT_PUBLIC_API_URL` wird zur **Build-Zeit** ins Frontend eingebettet.
> Sie muss die öffentlich erreichbare URL der App sein (mit HTTPS).
> Ohne diese Variable sind alle API-Aufrufe im Frontend defekt.

Die fertige JAR liegt unter: `target/schwalmtalzupfer-*.jar`

### Datei auf den Server übertragen:

```bash
scp target/schwalmtalzupfer-*.jar user@server:/opt/schwalmtalzupfer/app.jar
```

---

## 5. Konfigurationsdatei auf dem Server erstellen

```bash
sudo nano /opt/schwalmtalzupfer/application.yml
sudo chown schwalmtalzupfer:schwalmtalzupfer /opt/schwalmtalzupfer/application.yml
sudo chmod 600 /opt/schwalmtalzupfer/application.yml
```

**Inhalt** (Vorlage: `src/main/resources/application.yml.example`):

```yaml
spring:
  mvc:
    pathmatch:
      matching-strategy: ant_path_matcher
  datasource:
    url: jdbc:postgresql://localhost:5432/zupfer        # ← DB-Host (meist localhost)
    username: zupfer
    password: SICHERES_PASSWORT_HIER                    # ← Passwort aus Schritt 2
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
    username: schwalmtalzupfer@gmail.com
    password: GMAIL_APP_PASSWORT_HIER                   # ← Google App-Passwort (nicht das Login-PW!)
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
      mail.smtp.starttls.required: true
      mail.smtp.connectiontimeout: 5000
      mail.smtp.timeout: 5000

app:
  security:
    aes-key: ZUFAELLIGER_32_ZEICHEN_SCHLUESSEL_HIER!   # ← openssl rand -base64 32
  r2:
    endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    access-key: R2_ACCESS_KEY_HIER
    secret-key: R2_SECRET_KEY_HIER
    bucket: schwalmtalzupfer
    public-url:
  invitation:
    base-url: https://intern.schwalmtalzupfer.de        # ← öffentliche URL der App
    token-validity-hours: 72
  mail:
    from: noreply@schwalmtalzupfer.de
    to: info@schwalmtalzupfer.de                        # ← Kontaktformular-Empfänger

youtube:
  api:
    key: YOUTUBE_API_KEY_HIER

server:
  port: 8081                                            # ← NICHT 8080 (falls Typo3 oder anderes dort läuft)
```

> ℹ️ **Server-Port:** Typo3 läuft häufig auf Port 80/443 via Nginx oder auf einem eigenen Port.
> Wähle für die Spring-Boot-App einen freien Port (z. B. `8081`).
> Nginx leitet dann die Anfragen an diesen Port weiter.

---

## 6. Systemd-Service einrichten

```bash
sudo nano /etc/systemd/system/schwalmtalzupfer.service
```

```ini
[Unit]
Description=Schwalmtalzupfer Spring Boot App
After=network.target postgresql.service

[Service]
User=schwalmtalzupfer
Group=schwalmtalzupfer
WorkingDirectory=/opt/schwalmtalzupfer
ExecStart=/usr/bin/java -jar /opt/schwalmtalzupfer/app.jar \
  --spring.config.location=file:/opt/schwalmtalzupfer/application.yml
SuccessExitStatus=143
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=schwalmtalzupfer

# Sicherheit: beschränkte Rechte
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/schwalmtalzupfer

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable schwalmtalzupfer
sudo systemctl start schwalmtalzupfer

# Status prüfen:
sudo systemctl status schwalmtalzupfer
sudo journalctl -u schwalmtalzupfer -f
```

---

## 7. Nginx konfigurieren (parallel zu Typo3)

> ⚠️ **Typo3 wird NICHT angefasst!** Wir legen nur einen neuen `server`-Block für eine
> **eigene Subdomain** (z. B. `intern.schwalmtalzupfer.de`) an.

### Schritt 1: DNS-Eintrag anlegen

Beim Domain-Anbieter einen A-Record anlegen:
```
intern.schwalmtalzupfer.de  →  <SERVER-IP>
```

### Schritt 2: Nginx-Config erstellen

```bash
sudo nano /etc/nginx/sites-available/schwalmtalzupfer
```

```nginx
# Schwalmtalzupfer – intern.schwalmtalzupfer.de
# Typo3 auf www.schwalmtalzupfer.de bleibt UNBERÜHRT.

server {
    listen 80;
    server_name intern.schwalmtalzupfer.de;

    # Certbot trägt hier automatisch HTTPS-Redirect ein (Schritt 8).
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name intern.schwalmtalzupfer.de;

    # SSL – wird von Certbot befüllt (Schritt 8):
    # ssl_certificate ...
    # ssl_certificate_key ...

    # Sicherheits-Header
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Proxy → Spring Boot (Port aus application.yml, Schritt 5)
    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;

        # Für WebSockets / SSE (falls genutzt):
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Statische Assets: aggressives Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:8081;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Upload-Limit (für Datei-Uploads im Admin-Bereich)
    client_max_body_size 50M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/schwalmtalzupfer /etc/nginx/sites-enabled/
sudo nginx -t        # Konfiguration testen
sudo systemctl reload nginx
```

### Schritt 3: SSL mit Let's Encrypt

```bash
sudo certbot --nginx -d intern.schwalmtalzupfer.de
# → Certbot ergänzt die ssl_certificate-Zeilen automatisch
# → Auto-Renewal ist nach der Installation aktiv
```

---

## 8. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'    # Port 80 + 443
sudo ufw deny 8081             # Spring Boot-Port NICHT direkt erreichbar
sudo ufw enable
sudo ufw status
```

> Spring Boot läuft intern auf `127.0.0.1:8081`, ist von außen nicht direkt erreichbar.
> Nur Nginx (Port 443) darf Anfragen weiterleiten.

---

## 9. Zusammenfassung: Was muss geändert werden?

| # | Was | Wo | Beispielwert |
|---|-----|----|---|
| 1 | **Build-Variable** `NEXT_PUBLIC_API_URL` | Lokal vor `mvn package` | `https://intern.schwalmtalzupfer.de` |
| 2 | **DB-Passwort** | `application.yml` → `spring.datasource.password` | sicheres PW aus Schritt 2 |
| 3 | **DB-Host** | `application.yml` → `spring.datasource.url` | `localhost` (oder externe IP) |
| 4 | **Gmail App-Passwort** | `application.yml` → `spring.mail.password` | Google App-Passwort |
| 5 | **AES-Key** (32 Zeichen) | `application.yml` → `app.security.aes-key` | `openssl rand -base64 32` |
| 6 | **R2 Credentials** | `application.yml` → `app.r2.*` | Cloudflare Dashboard |
| 7 | **App-Base-URL** | `application.yml` → `app.invitation.base-url` | `https://intern.schwalmtalzupfer.de` |
| 8 | **Mail-Empfänger** | `application.yml` → `app.mail.to` | `info@schwalmtalzupfer.de` |
| 9 | **YouTube API-Key** | `application.yml` → `youtube.api.key` | Google Cloud Console |
| 10 | **Server-Port** | `application.yml` → `server.port` | `8081` (frei wählen) |
| 11 | **Nginx Subdomain** | `/etc/nginx/sites-available/schwalmtalzupfer` | `intern.schwalmtalzupfer.de` |
| 12 | **DNS A-Record** | Domain-Anbieter | Server-IP |

---

## 10. Updates deployen

```bash
# 1. Lokal bauen:
export NEXT_PUBLIC_API_URL=https://intern.schwalmtalzupfer.de
mvn clean package -DskipTests

# 2. JAR übertragen:
scp target/schwalmtalzupfer-*.jar user@server:/opt/schwalmtalzupfer/app.jar

# 3. Service neu starten:
sudo systemctl restart schwalmtalzupfer

# 4. Logs beobachten:
sudo journalctl -u schwalmtalzupfer -f
```

---

## 11. Schnell-Checkliste vor Go-Live

- [ ] DNS-Eintrag gesetzt und propagiert (`dig intern.schwalmtalzupfer.de`)
- [ ] `application.yml` auf dem Server vorhanden und `chmod 600`
- [ ] Alle Secrets/Passwörter ersetzt (kein `localhost`, kein Entwicklungs-PW)
- [ ] `NEXT_PUBLIC_API_URL` beim Build korrekt gesetzt
- [ ] JAR auf dem Server liegt in `/opt/schwalmtalzupfer/app.jar`
- [ ] Systemd-Service läuft: `systemctl status schwalmtalzupfer`
- [ ] Nginx-Config getestet: `nginx -t`
- [ ] SSL-Zertifikat aktiv: `https://intern.schwalmtalzupfer.de` öffnet ohne Warnung
- [ ] Firewall aktiv: Port 8081 von außen geblockt
- [ ] Kontaktformular testen (Mail-Versand)
- [ ] Login/Registrierung testen
- [ ] Bestehende Typo3-Seite prüfen: `https://www.schwalmtalzupfer.de` noch erreichbar
- [ ] Mail-Empfänger auf `info@schwalmtalzupfer.de` umgestellt (statt private Adresse)

---

## 13. HTTPS ohne eigene Domain – via nip.io

> **Zwischenlösung:** Solange der DNS von `schwalmtalzupfer.de` noch auf Typo3 zeigt,
> kannst du mit [nip.io](https://nip.io) sofort HTTPS bekommen.
> `159.195.70.118.nip.io` ist ein kostenloser DNS-Eintrag, der immer auf `159.195.70.118` zeigt –
> kein eigener DNS-Eintrag nötig, und Let's Encrypt stellt ein gültiges Zertifikat aus.

### Schritt 1: Nginx für nip.io aktualisieren

Auf dem Server:
```bash
sudo nano /etc/nginx/sites-available/schwalmtalzupfer
```

Inhalt ersetzen durch (**nur HTTP** – Certbot fügt HTTPS selbst hinzu!):
```nginx
# NUR HTTP – Certbot ergänzt den HTTPS-Block automatisch!
server {
    listen 80;
    server_name 159.195.70.118.nip.io 159.195.70.118;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:8081;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

> ⚠️ **Kein `listen 443 ssl` Block!** Certbot fügt diesen automatisch hinzu.
> Ein vordefinierter SSL-Block ohne Zertifikat macht nginx kaputt.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Schritt 2: Let's Encrypt Zertifikat holen

```bash
sudo certbot --nginx -d 159.195.70.118.nip.io
```

> Certbot trägt die `ssl_certificate`-Zeilen automatisch ein **und** legt den HTTPS-Block an.

### Schritt 3: App neu bauen mit nip.io-URL

Lokal im Projekt:
```bash
export NEXT_PUBLIC_API_URL=https://159.195.70.118.nip.io
mvn clean package -DskipTests
```

Dann wie gewohnt deployen (JAR hochladen, Service neu starten).

### Schritt 4: Wenn DNS auf schwalmtalzupfer.de umzeigt

```bash
# Nginx-Config anpassen: server_name auf schwalmtalzupfer.de ändern
# Neues Zertifikat:
sudo certbot --nginx -d schwalmtalzupfer.de -d www.schwalmtalzupfer.de
# App neu bauen mit:
export NEXT_PUBLIC_API_URL=https://schwalmtalzupfer.de
mvn clean package -DskipTests
```

---


```bash
# Logs der App:
sudo journalctl -u schwalmtalzupfer -n 100 --no-pager

# Nginx-Fehler:
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

# DB-Verbindung testen:
psql -h localhost -U zupfer -d zupfer

# Port belegt?
sudo ss -tlnp | grep 8081
```

