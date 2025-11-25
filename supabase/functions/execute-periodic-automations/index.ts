import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting periodic automation execution...');
    const now = new Date();

    // Get all active periodic automation rules
    const { data: periodicRules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('trigger_type', 'periodic')
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    console.log(`Found ${periodicRules?.length || 0} active periodic rules`);

    if (!periodicRules || periodicRules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No periodic rules found', executed: 0 }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let totalExecuted = 0;
    const results = [];

    // Process each periodic rule
    for (const rule of periodicRules) {
      try {
        console.log(`Processing rule: ${rule.name}`);
        
        const intervalDays = rule.trigger_config?.interval_days || 1;

        // Get all projects matching this rule's criteria
        const query = supabase
          .from('projects')
          .select('id, status_id, title')
          .eq('project_type_id', rule.project_type_id);

        const { data: projects, error: projectsError } = await query;

        if (projectsError) throw projectsError;

        console.log(`Found ${projects?.length || 0} projects for rule ${rule.name}`);

        if (!projects || projects.length === 0) continue;

        // Filter projects by main status
        const projectsInStatus = [];
        for (const project of projects) {
          const { data: status } = await supabase
            .from('statuses')
            .select('id, name, parent_status_id')
            .eq('id', project.status_id)
            .maybeSingle();

          if (!status) continue;

          let mainStatusName = status.name;
          if (status.parent_status_id) {
            const { data: parentStatus } = await supabase
              .from('statuses')
              .select('name')
              .eq('id', status.parent_status_id)
              .maybeSingle();
            
            if (parentStatus) {
              mainStatusName = parentStatus.name;
            }
          }

          if (mainStatusName === rule.main_status) {
            projectsInStatus.push(project);
          }
        }

        console.log(`${projectsInStatus.length} projects in status ${rule.main_status}`);

        // Check each project to see if it needs automation execution
        for (const project of projectsInStatus) {
          // Check if there's an existing execution record
          const { data: existingExecution } = await supabase
            .from('periodic_automation_executions')
            .select('*')
            .eq('automation_rule_id', rule.id)
            .eq('project_id', project.id)
            .maybeSingle();

          let shouldExecute = false;

          if (!existingExecution) {
            // First time - create record and execute
            shouldExecute = true;
            const nextExecution = new Date(now);
            nextExecution.setDate(nextExecution.getDate() + intervalDays);

            await supabase
              .from('periodic_automation_executions')
              .insert({
                automation_rule_id: rule.id,
                project_id: project.id,
                last_executed_at: now.toISOString(),
                next_execution_at: nextExecution.toISOString()
              });
          } else if (new Date(existingExecution.next_execution_at) <= now) {
            // Time to execute again
            shouldExecute = true;
            const nextExecution = new Date(now);
            nextExecution.setDate(nextExecution.getDate() + intervalDays);

            await supabase
              .from('periodic_automation_executions')
              .update({
                last_executed_at: now.toISOString(),
                next_execution_at: nextExecution.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', existingExecution.id);
          }

          if (shouldExecute) {
            console.log(`Executing automation for project: ${project.title}`);
            
            // Execute the action
            if (rule.action_type === 'add_task') {
              const taskConfig = rule.action_config;
              if (taskConfig.title) {
                let calculatedDeadline = taskConfig.deadline || null;

                if (taskConfig.due_date_base && taskConfig.due_date_offset !== undefined) {
                  if (taskConfig.due_date_base === 'current_day') {
                    const baseDateObj = new Date();
                    const offsetDays = taskConfig.due_date_offset || 0;
                    const direction = taskConfig.due_date_direction || 'after';

                    if (direction === 'before') {
                      baseDateObj.setDate(baseDateObj.getDate() - offsetDays);
                    } else {
                      baseDateObj.setDate(baseDateObj.getDate() + offsetDays);
                    }

                    calculatedDeadline = baseDateObj.toISOString();
                  } else {
                    const { data: projectData } = await supabase
                      .from('projects')
                      .select('project_end_date, next_hkpc_due_date, start_date, project_start_date, submission_date, approval_date')
                      .eq('id', project.id)
                      .maybeSingle();

                    if (projectData) {
                      const baseDate = projectData[taskConfig.due_date_base as keyof typeof projectData];
                      if (baseDate) {
                        const baseDateObj = new Date(baseDate);
                        const offsetDays = taskConfig.due_date_offset || 0;
                        const direction = taskConfig.due_date_direction || 'after';

                        if (direction === 'before') {
                          baseDateObj.setDate(baseDateObj.getDate() - offsetDays);
                        } else {
                          baseDateObj.setDate(baseDateObj.getDate() + offsetDays);
                        }

                        calculatedDeadline = baseDateObj.toISOString();
                      }
                    }
                  }
                }

                // Resolve assigned_to value
                let assignedTo = taskConfig.assigned_to || null;
                if (assignedTo === '__project_sales_person__') {
                  const { data: projectData } = await supabase
                    .from('projects')
                    .select('sales_person_id')
                    .eq('id', project.id)
                    .maybeSingle();

                  assignedTo = projectData?.sales_person_id || null;
                }

                const { error: taskError } = await supabase
                  .from('tasks')
                  .insert({
                    project_id: project.id,
                    title: taskConfig.title,
                    description: taskConfig.description || '',
                    deadline: calculatedDeadline,
                    assigned_to: assignedTo,
                    completed: false
                  });

                if (taskError) throw taskError;
                console.log('Task added successfully');
                totalExecuted++;
                results.push({ 
                  rule: rule.name, 
                  project: project.title, 
                  action: 'add_task', 
                  status: 'success' 
                });
              }
            } else if (rule.action_type === 'add_label') {
              const labelId = rule.action_config.label_id;
              if (labelId) {
                const { data: existingLabel } = await supabase
                  .from('project_labels')
                  .select('id')
                  .eq('project_id', project.id)
                  .eq('label_id', labelId)
                  .maybeSingle();

                if (!existingLabel) {
                  const { error: insertError } = await supabase
                    .from('project_labels')
                    .insert({
                      project_id: project.id,
                      label_id: labelId
                    });

                  if (insertError) throw insertError;
                  console.log('Label added successfully');
                  totalExecuted++;
                  results.push({ 
                    rule: rule.name, 
                    project: project.title, 
                    action: 'add_label', 
                    status: 'success' 
                  });
                }
              }
            } else if (rule.action_type === 'remove_label') {
              const labelId = rule.action_config.label_id;
              if (labelId) {
                const { error: deleteError } = await supabase
                  .from('project_labels')
                  .delete()
                  .eq('project_id', project.id)
                  .eq('label_id', labelId);

                if (deleteError) throw deleteError;
                console.log('Label removed successfully');
                totalExecuted++;
                results.push({ 
                  rule: rule.name, 
                  project: project.title, 
                  action: 'remove_label', 
                  status: 'success' 
                });
              }
            } else if (rule.action_type === 'change_status') {
              const statusId = rule.action_config.status_id;
              if (statusId) {
                const { error: statusError } = await supabase
                  .from('projects')
                  .update({
                    status_id: statusId,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', project.id);

                if (statusError) throw statusError;
                console.log('Status changed successfully');
                totalExecuted++;
                results.push({ 
                  rule: rule.name, 
                  project: project.title, 
                  action: 'change_status', 
                  status: 'success' 
                });
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error processing rule:', rule.name, error);
        results.push({ 
          rule: rule.name, 
          action: rule.action_type, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    console.log(`Periodic automation execution completed. Total executed: ${totalExecuted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Executed ${totalExecuted} periodic automations`, 
        executed: totalExecuted,
        results 
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in periodic automation function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});