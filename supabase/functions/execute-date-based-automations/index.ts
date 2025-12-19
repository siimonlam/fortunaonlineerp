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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Starting date-based automation execution...');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const { data: dateBasedRules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .in('trigger_type', ['days_after_date', 'days_before_date'])
      .eq('is_active', true);

    if (rulesError) {
      console.error('Error fetching date-based rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${dateBasedRules?.length || 0} active date-based rules`);

    if (!dateBasedRules || dateBasedRules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No date-based rules found', executed: 0 }),
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

    const rulePromises = dateBasedRules.map(async (rule) => {
      try {
        console.log(`Processing rule: ${rule.name} (${rule.trigger_type})`);

        const daysOffset = rule.trigger_config?.days_offset || 0;
        const dateField = rule.trigger_config?.date_field;

        if (!dateField || daysOffset === 0) {
          console.log(`Rule ${rule.name} missing required config (days_offset or date_field)`);
          return;
        }

        const statusIds = [];

        if (rule.substatus_filter && rule.substatus_filter !== 'All') {
          statusIds.push(rule.substatus_filter);
          console.log(`Using specific substatus filter: ${rule.substatus_filter}`);
        } else {
          const { data: matchingStatuses } = await supabase
            .from('statuses')
            .select('id, name, is_substatus, parent_status_id')
            .eq('name', rule.main_status)
            .eq('project_type_id', rule.project_type_id);

          if (!matchingStatuses || matchingStatuses.length === 0) {
            console.log(`Status ${rule.main_status} not found for rule ${rule.name}`);
            return;
          }

          for (const status of matchingStatuses) {
            statusIds.push(status.id);

            const { data: substatuses } = await supabase
              .from('statuses')
              .select('id')
              .eq('parent_status_id', status.id);

            if (substatuses && substatuses.length > 0) {
              statusIds.push(...substatuses.map(s => s.id));
            }
          }

          console.log(`Status IDs for ${rule.main_status}: ${statusIds.join(', ')}`);
        }

        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select(`id, status_id, title, sales_person_id, sales_source, ${dateField}`)
          .eq('project_type_id', rule.project_type_id)
          .in('status_id', statusIds)
          .not(dateField, 'is', null);

        if (projectsError) throw projectsError;

        console.log(`Found ${projects?.length || 0} projects with ${dateField} in status ${rule.main_status}`);

        if (!projects || projects.length === 0) return;

        for (const project of projects) {
          const dateFieldValue = project[dateField];
          if (!dateFieldValue) continue;

          const targetDate = new Date(dateFieldValue);
          const targetDateStr = targetDate.toISOString().split('T')[0];

          let shouldExecute = false;

          if (rule.trigger_type === 'days_after_date') {
            const executionDate = new Date(targetDate);
            executionDate.setDate(executionDate.getDate() + daysOffset);
            const executionDateStr = executionDate.toISOString().split('T')[0];

            if (executionDateStr === todayStr) {
              shouldExecute = true;
            }
          } else if (rule.trigger_type === 'days_before_date') {
            const executionDate = new Date(targetDate);
            executionDate.setDate(executionDate.getDate() - daysOffset);
            const executionDateStr = executionDate.toISOString().split('T')[0];

            if (executionDateStr === todayStr) {
              shouldExecute = true;
            }
          }

          if (!shouldExecute) continue;

          const { data: existingExecution } = await supabase
            .from('date_based_automation_executions')
            .select('id')
            .eq('automation_rule_id', rule.id)
            .eq('project_id', project.id)
            .maybeSingle();

          if (existingExecution) {
            console.log(`Rule ${rule.name} already executed for project ${project.title}`);
            continue;
          }

          if (rule.condition_type && rule.condition_type !== 'no_condition') {
            if (rule.condition_type === 'sales_source') {
              const expectedSource = rule.condition_config?.sales_source;
              if (expectedSource && project.sales_source !== expectedSource) {
                console.log(`Skipping rule - sales source mismatch: "${project.sales_source}" !== "${expectedSource}"`);
                continue;
              }
            }

            if (rule.condition_type === 'sales_person') {
              const expectedSalesPerson = rule.condition_config?.sales_person_id;
              if (expectedSalesPerson && project.sales_person_id !== expectedSalesPerson) {
                console.log(`Skipping rule - sales person mismatch: "${project.sales_person_id}" !== "${expectedSalesPerson}"`);
                continue;
              }
            }
          }

          console.log(`Executing automation for project: ${project.title}`);

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
                    .select('project_end_date, next_hkpc_due_date, start_date, project_start_date, submission_date, approval_date, hi_po_date, deposit_paid_date')
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

              let assignedTo = taskConfig.assigned_to || null;
              if (assignedTo === '__project_sales_person__') {
                assignedTo = project.sales_person_id || null;
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
            }
          } else if (rule.action_type === 'set_field_value') {
            const fieldName = rule.action_config.field_name;
            const valueType = rule.action_config.value_type;

            if (fieldName && valueType) {
              let fieldValue: string | null = null;

              if (valueType === 'current_date') {
                fieldValue = new Date().toISOString().split('T')[0];
              } else if (valueType === 'specific_date') {
                fieldValue = rule.action_config.date_value;
              }

              if (fieldValue) {
                const updateData: any = {
                  [fieldName]: fieldValue,
                  updated_at: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                  .from('projects')
                  .update(updateData)
                  .eq('id', project.id);

                if (updateError) throw updateError;
                console.log(`Field ${fieldName} set to ${fieldValue} successfully`);
              }
            }
          }

          await supabase
            .from('date_based_automation_executions')
            .insert({
              automation_rule_id: rule.id,
              project_id: project.id,
              executed_at: now.toISOString(),
              date_field_value: targetDateStr
            });

          totalExecuted++;
          results.push({
            rule: rule.name,
            project: project.title,
            action: rule.action_type,
            status: 'success'
          });
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
    });

    await Promise.allSettled(rulePromises);

    console.log(`Date-based automation execution completed. Total executed: ${totalExecuted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Executed ${totalExecuted} date-based automations`, 
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
    console.error('Error in date-based automation function:', error);
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
