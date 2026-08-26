-- Enforce Zoho Project ID as the canonical one-to-one mapping key.
-- Existing local project IDs and historical mappings are preserved.

UPDATE zoho_mappings
SET zoho_entity_id = COALESCE(zoho_entity_id, zoho_project_id),
    zoho_project_id = COALESCE(zoho_project_id, zoho_entity_id),
    updated_at = NOW()
WHERE entity_type = 'PROJECT'
  AND (zoho_entity_id IS NULL OR zoho_project_id IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS ux_zoho_project_mappings_entity_id
    ON zoho_mappings(zoho_entity_id)
    WHERE entity_type = 'PROJECT'
      AND zoho_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_zoho_project_mappings_project_id
    ON zoho_mappings(zoho_project_id)
    WHERE entity_type = 'PROJECT'
      AND zoho_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zoho_mappings_project_lookup
    ON zoho_mappings(entity_type, zoho_entity_id, zoho_project_id);
