/*
  # Add 廣告開支KOL (直播/貼文) category and checklist items

  1. Changes
    - Adds new category "廣告開支KOL (直播/貼文)" to funding_project_detail_categories (order_index 16, shifting subsequent ones)
    - Copies all checklist items from "廣告開支官方號 (直播/貼文)" into "廣告開支KOL (直播/貼文)" in funding_document_checklist

  2. Notes
    - The AI extraction already reads categories dynamically from the DB, so this new category will be included automatically
    - The fallback list in the edge function is updated separately
*/

INSERT INTO funding_project_detail_categories (name_zh, name_en, order_index)
VALUES ('廣告開支KOL (直播/貼文)', 'KOL Advertising (Live / Post)', 16)
ON CONFLICT DO NOTHING;

UPDATE funding_project_detail_categories
SET order_index = order_index + 1
WHERE order_index >= 16
  AND name_zh != '廣告開支KOL (直播/貼文)';

INSERT INTO funding_document_checklist (category, document_name, description, is_required, order_index)
SELECT
  '廣告開支KOL (直播/貼文)' AS category,
  document_name,
  description,
  is_required,
  order_index
FROM funding_document_checklist
WHERE category = '廣告開支官方號 (直播/貼文)';
