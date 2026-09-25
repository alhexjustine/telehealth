-- Enables the exclusion-constraint support needed for appointment overlap
-- prevention (added in a later change).
CREATE EXTENSION IF NOT EXISTS btree_gist;
