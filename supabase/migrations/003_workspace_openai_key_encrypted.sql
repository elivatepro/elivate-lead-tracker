alter table workspaces
add column if not exists openai_api_key_encrypted text;
