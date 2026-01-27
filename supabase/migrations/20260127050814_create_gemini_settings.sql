/*
  # Create Gemini AI Settings for Meta Ads Analysis

  1. New Table
    - `gemini_prompts`
      - `id` (uuid, primary key) - Unique identifier
      - `prompt_name` (text) - Name of the prompt (e.g., "monthly_comparison_analysis")
      - `prompt_template` (text) - The full prompt template for Gemini
      - `description` (text) - Description of what this prompt does
      - `created_at` (timestamptz) - When the prompt was created
      - `updated_at` (timestamptz) - Last update timestamp
      - `is_active` (boolean) - Whether this prompt is currently active
  
  2. System Settings
    - Add Gemini API key to system_settings table (if not exists)
  
  3. Security
    - Enable RLS on `gemini_prompts` table
    - Only admins can modify prompts
    - All authenticated users can view active prompts
*/

-- Create gemini_prompts table
CREATE TABLE IF NOT EXISTS gemini_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name text UNIQUE NOT NULL,
  prompt_template text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE gemini_prompts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active prompts
CREATE POLICY "Authenticated users can view active prompts"
  ON gemini_prompts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert, update, or delete prompts
CREATE POLICY "Admins can manage prompts"
  ON gemini_prompts FOR ALL
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

-- Insert default prompt template for monthly comparison analysis
INSERT INTO gemini_prompts (prompt_name, prompt_template, description, is_active) VALUES (
  'monthly_comparison_analysis',
  E'**Role:** You are a Senior Meta Ads Strategist & Data Analyst. Your goal is to analyze monthly performance data and provide a strategic roadmap for the upcoming month.\n\n**Context:** The user is an advertiser comparing "Month 1" (Previous) vs. "Month 2" (Current).\n\n**Your Task:**\n1.  **Analyze the Funnel:** Review the metrics from Top of Funnel (CPM, Impressions) to Bottom of Funnel (Results, Cost Per Result).\n2.  **Identify Correlations:** Don''t just read the numbers. Explain *why* they changed.\n    * *Example:* "CPM dropped by 39%, which explains why Impressions are up, but Results dropped by 30%, suggesting the new, cheaper audience is lower quality."\n3.  **Creative & Audience Audit:** (If provided) Analyze which demographics or creative types drove the best ROI.\n4.  **Provide an Action Plan:** Output a strict "Stop / Start / Scale" list for next month.\n\n**Output Format:**\nReturn the response in Markdown with these specific sections:\n### 📊 Executive Summary\n(2-3 sentences on overall health. E.g., "Efficiency improved, but conversion volume is critical.")\n\n### 🔍 Key Insights\n* **Wins:** (What went well? e.g., Lower CPC)\n* **Risks:** (What is alarming? e.g., Drop in Results)\n* **Why this happened:** (Correlate the metrics)\n\n### 🚀 Action Plan for [Next Month]\n* **🔴 STOP:** (What to turn off)\n* **🟢 START:** (New experiments to try)\n* **🔵 SCALE:** (What is working and needs more budget)',
  'Default prompt for analyzing Meta Ads monthly comparison data with Gemini AI',
  true
) ON CONFLICT (prompt_name) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gemini_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gemini_prompts_updated_at
  BEFORE UPDATE ON gemini_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_gemini_prompts_updated_at();

-- Enable realtime for gemini_prompts
ALTER PUBLICATION supabase_realtime ADD TABLE gemini_prompts;