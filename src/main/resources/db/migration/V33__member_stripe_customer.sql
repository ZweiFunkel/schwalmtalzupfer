-- V33: Stripe-Kunden-ID am Mitglied speichern, damit eine fehlgeschlagene Zahlungseinrichtung
-- (z.B. Karte abgelehnt) nachträglich abgeschlossen werden kann, ohne einen neuen Stripe-Kunden anzulegen.
ALTER TABLE member ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);
