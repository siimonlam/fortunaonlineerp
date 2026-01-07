/*
  # Separate Marketing Tasks from Social Media Management

  1. Changes
    - Drop trigger that auto-creates tasks from social media post steps
    - Drop the sync function
    - Remove the `related_post_step_id` field from marketing_tasks
    - Delete all auto-generated tasks (tasks that have a related_post_step_id)

  2. Purpose
    - Make the Tasks section completely independent from Social Media Management
    - Tasks and Social Media Post Steps are now two separate entities with no linkage
    - Users can create tasks manually without any connection to social posts

  3. Notes
    - This will delete all tasks that were auto-created from social media posts
    - Future tasks must be created manually in the Tasks section
    - Social Media Management section remains unchanged
*/

-- Drop the trigger that syncs social post steps to tasks
DROP TRIGGER IF EXISTS trigger_sync_social_post_step_to_task ON marketing_social_post_steps;

-- Drop the sync function
DROP FUNCTION IF EXISTS sync_social_post_step_to_task();

-- Delete all auto-generated tasks (tasks linked to social media posts)
DELETE FROM marketing_tasks WHERE related_post_step_id IS NOT NULL;

-- Remove the related_post_step_id column
ALTER TABLE marketing_tasks DROP COLUMN IF EXISTS related_post_step_id;
