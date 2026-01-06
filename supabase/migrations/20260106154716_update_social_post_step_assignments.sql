/*
  # Update Social Media Post Step Assignments

  1. Changes
    - Drop old trigger for creating initial step
    - Create new trigger that assigns designer to step 1
    - Update function to get designer from linked accounts
  
  2. Purpose
    - Automatically assign designer to Step 1 when post is created
    - Set up proper workflow: Designer (Step 1, 3), Approver (Step 2)
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_create_initial_post_step ON marketing_social_posts;
DROP FUNCTION IF EXISTS create_initial_post_step();

-- Create updated function that assigns designer
CREATE OR REPLACE FUNCTION create_initial_post_step()
RETURNS TRIGGER AS $$
DECLARE
  v_designer_id uuid;
BEGIN
  -- Try to get designer from Instagram accounts first
  IF NEW.instagram_account_ids IS NOT NULL AND array_length(NEW.instagram_account_ids, 1) > 0 THEN
    SELECT mpia.designer_id INTO v_designer_id
    FROM marketing_project_instagram_accounts mpia
    WHERE mpia.account_id = NEW.instagram_account_ids[1]
    AND mpia.marketing_project_id = NEW.marketing_project_id
    LIMIT 1;
  END IF;

  -- If no designer found, try Facebook accounts
  IF v_designer_id IS NULL AND NEW.facebook_account_ids IS NOT NULL AND array_length(NEW.facebook_account_ids, 1) > 0 THEN
    SELECT mfa.designer_id INTO v_designer_id
    FROM marketing_facebook_accounts mfa
    WHERE mfa.page_id = NEW.facebook_account_ids[1]
    LIMIT 1;
  END IF;

  -- If still no designer, use the post creator
  IF v_designer_id IS NULL THEN
    v_designer_id := NEW.created_by;
  END IF;

  -- Create Step 1 with designer assigned
  INSERT INTO marketing_social_post_steps (
    post_id,
    step_number,
    step_name,
    assigned_to,
    due_date,
    status
  ) VALUES (
    NEW.id,
    1,
    'Content Drafting',
    v_designer_id,
    NEW.scheduled_post_date,
    'in_progress'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_create_initial_post_step
  AFTER INSERT ON marketing_social_posts
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_post_step();
