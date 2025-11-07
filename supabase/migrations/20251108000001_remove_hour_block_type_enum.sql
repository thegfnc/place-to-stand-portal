-- Remove the obsolete hour_block_type enum
-- The block_type column was already dropped in migration 20251022001219_hour_blocks_invoice_number.sql
drop type if exists public.hour_block_type;

