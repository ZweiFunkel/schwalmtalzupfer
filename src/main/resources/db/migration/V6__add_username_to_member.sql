-- V6: Add username field to member table
ALTER TABLE member ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- Make email nullable for users that only have a username
ALTER TABLE member ALTER COLUMN email DROP NOT NULL;

-- Update zupf user to have username (without email)
UPDATE member SET username = 'zupf', email = NULL WHERE email = 'zupf@schwalmtalzupfer.de';