-- Add InstaPay and E-Wallet payment modes in a standalone migration
-- so subsequent functions/triggers can reference them safely.
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'instapay';
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'wallet';
