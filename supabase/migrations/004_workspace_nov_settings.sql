alter table workspaces
add column if not exists nov_company_summary text,
add column if not exists nov_offer_summary text,
add column if not exists nov_target_customer text,
add column if not exists nov_default_cta text,
add column if not exists nov_email_signoff text,
add column if not exists nov_preferred_tone text not null default 'warm',
add column if not exists nov_be_concise boolean not null default true,
add column if not exists nov_avoid_pushy_language boolean not null default true,
add column if not exists nov_include_booking_prompt boolean not null default false;

alter table workspaces
drop column if exists openai_api_key,
drop column if exists openai_api_key_encrypted;
