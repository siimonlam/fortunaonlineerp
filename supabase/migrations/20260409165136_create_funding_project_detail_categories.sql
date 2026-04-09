/*
  # Create funding_project_detail_categories table

  ## Summary
  Creates a master list of BUD Fund project detail categories used to classify
  each line item extracted from funding application PDFs. Gemini will map each
  extracted project detail row to one of these categories.

  ## New Tables
  - `funding_project_detail_categories`
    - `id` (uuid, primary key)
    - `name_zh` (text) — Chinese category name as it appears in BUD Fund documents
    - `name_en` (text) — English translation for display
    - `order_index` (integer) — display order
    - `created_at` (timestamptz)

  ## Seed Data
  Pre-populated with all standard BUD Fund expenditure categories based on the
  official category list provided.

  ## Security
  - RLS enabled
  - All authenticated users can read categories
  - Only admins can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS funding_project_detail_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_zh text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE funding_project_detail_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project detail categories"
  ON funding_project_detail_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert project detail categories"
  ON funding_project_detail_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update project detail categories"
  ON funding_project_detail_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete project detail categories"
  ON funding_project_detail_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_funding_project_detail_categories_order ON funding_project_detail_categories(order_index);

INSERT INTO funding_project_detail_categories (name_zh, name_en, order_index) VALUES
  ('在內地增設新業務單位', 'Setting Up New Business Unit in Mainland China', 1),
  ('租賃單位', 'Rental of Unit', 2),
  ('裝修傢俱', 'Renovation and Furniture', 3),
  ('增聘員工', 'Hiring of Staff', 4),
  ('參加展覽', 'Participating in Exhibitions', 5),
  ('參展美工/設計/搭建', 'Exhibition Artwork / Design / Setup', 6),
  ('展覽交通及住宿費', 'Exhibition Transport and Accommodation', 7),
  ('購買租賃機器設備', 'Purchase / Rental of Machinery and Equipment', 8),
  ('製作購買產品樣本或樣板', 'Production / Purchase of Product Samples or Prototypes', 9),
  ('檢測及認證', 'Testing and Certification', 10),
  ('專利 商標註冊', 'Patent and Trademark Registration', 11),
  ('設計及製作宣傳品', 'Design and Production of Promotional Materials', 12),
  ('建立/優化公司網頁', 'Build / Optimize Company Website', 13),
  ('設計及建立網上銷售平台', 'Design and Build Online Sales Platform', 14),
  ('廣告開支官方號 (直播/貼文)', 'Official Account Advertising (Live / Post)', 15),
  ('廣告開支廣告投流(Vendor)', 'Advertising Spend - Ad Placement (Vendor)', 16),
  ('廣告開支廣告投流(自投)', 'Advertising Spend - Ad Placement (Self-managed)', 17),
  ('製作費用影片相片', 'Production Cost - Video and Photo', 18),
  ('核數', 'Audit', 19),
  ('其他', 'Others', 20),
  ('廣告開支其他廣告有關的開支', 'Advertising - Other Related Expenses', 21),
  ('廣告開支聘請代言人', 'Advertising - Hiring of Spokesperson / KOL', 22),
  ('製作或優化流動應用程式費用', 'Production / Optimization of Mobile Application', 23)
ON CONFLICT DO NOTHING;
