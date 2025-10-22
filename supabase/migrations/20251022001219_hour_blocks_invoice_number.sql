alter table public.hour_blocks
	drop column if exists title,
	drop column if exists block_type,
	drop column if exists hours_consumed,
	drop column if exists notes,
	drop column if exists starts_on,
	drop column if exists ends_on;

alter table public.hour_blocks
	add column if not exists invoice_number text,
	add constraint hour_blocks_invoice_number_format
		check (
			invoice_number is null
			or invoice_number ~ '^[A-Za-z0-9-]+$'
		);
