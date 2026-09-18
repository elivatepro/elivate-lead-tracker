-- Activity types for the automation engine. Kept in their own migration:
-- a new enum value can't be used in the transaction that adds it, and the
-- next migration's functions and tests write these values.

alter type activity_type add value if not exists 'automation_enrolled';
alter type activity_type add value if not exists 'automation_stopped';
alter type activity_type add value if not exists 'automation_completed';
