-- V32: Stripe-Preis-Referenz, Einladung mit Gruppe/Preis verknüpfen, Mitgliedsverträge
ALTER TABLE price_group_rate ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100);

ALTER TABLE invitation_token ADD COLUMN IF NOT EXISTS gitarrengruppe_id UUID REFERENCES gitarrengruppe(id);
ALTER TABLE invitation_token ADD COLUMN IF NOT EXISTS price_group_rate_id UUID REFERENCES price_group_rate(id);

CREATE TABLE IF NOT EXISTS membership_contract (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES member(id),
    price_group_rate_id UUID NOT NULL REFERENCES price_group_rate(id),
    stripe_customer_id VARCHAR(100) NOT NULL,
    stripe_subscription_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    start_date DATE NOT NULL,
    cancelled_at TIMESTAMP
);
