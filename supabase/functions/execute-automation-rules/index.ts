import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AutomationPayload {
  project_id: string;
  project_type_id: string | null;
  status_id: string;
  trigger_type: string;
  trigger_data?: any;
}

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

    const payload: AutomationPayload = await req.json();
    const { project_id, project_type_id, status_id, trigger_type, trigger_data } = payload;

    console.log('Executing automation for:', { project_id, project_type_id, status_id, trigger_type });

    let mainStatusName = '';

    if (status_id) {
      const { data: status, error: statusError } = await supabase
        .from('statuses')
        .select('id, name, parent_status_id')
        .eq('id', status_id)
        .maybeSingle();

      if (statusError) throw statusError;
      if (!status) throw new Error('Status not found');

      mainStatusName = status.name;
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

      console.log('Main status name:', mainStatusName);
    } else {
      const { data: project } = await supabase
        .from('projects')
        .select('status_id, statuses(name, parent_status_id, parent:parent_status_id(name))')
        .eq('id', project_id)
        .maybeSingle();

      if (project?.statuses) {
        const status = project.statuses as any;
        mainStatusName = status.parent?.name || status.name;
        console.log('Main status name from project:', mainStatusName);
      }
    }

    const query = supabase
      .from('automation_rules')
      .select('*')
      .eq('main_status', mainStatusName)
      .eq('trigger_type', trigger_type)
      .eq('is_active', true);

    if (project_type_id) {
      query.or(`project_type_id.eq.${project_type_id},project_type_id.is.null`);
    } else {
      query.is('project_type_id', null);
    }

    const { data: rules, error: rulesError } = await query;

    if (rulesError) throw rulesError;

    console.log(`Found ${rules?.length || 0} automation rules`);

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No automation rules found', executed: 0 }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let executedCount = 0;
    const results = [];

    for (const rule of rules) {
      try {
        console.log('Executing rule:', rule.name, 'Action:', rule.action_type);

        if (trigger_type === 'task_completed' && rule.trigger_config?.task_name) {
          if (trigger_data?.task_name !== rule.trigger_config.task_name) {
            console.log(`Skipping rule - task name mismatch: "${trigger_data?.task_name}" !== "${rule.trigger_config.task_name}"`);
            results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'task_name_mismatch' });
            continue;
          }
        }

        if (trigger_type === 'label_added' && rule.trigger_config?.label_id) {
          if (trigger_data?.label_id !== rule.trigger_config.label_id) {
            console.log(`Skipping rule - label mismatch: "${trigger_data?.label_id}" !== "${rule.trigger_config.label_id}"`);
            results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'label_mismatch' });
            continue;
          }
        }

        if (trigger_type === 'status_changed' && rule.action_config?.to_status_id) {
          const targetStatusId = rule.action_config.to_status_id;
          const newStatusId = trigger_data?.new_status_id;

          const { data: newStatus } = await supabase
            .from('statuses')
            .select('id, parent_status_id')
            .eq('id', newStatusId)
            .maybeSingle();

          const matchesDirectly = newStatusId === targetStatusId;
          const matchesParent = newStatus?.parent_status_id === targetStatusId;

          if (!matchesDirectly && !matchesParent) {
            console.log(`Skipping rule - status change mismatch: new_status="${newStatusId}", target="${targetStatusId}", parent="${newStatus?.parent_status_id}"`);
            results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'status_change_mismatch' });
            continue;
          }
        }

        // Check conditions
        if (rule.condition_type && rule.condition_type !== 'no_condition') {
          const { data: project } = await supabase
            .from('projects')
            .select('sales_source, sales_person_id')
            .eq('id', project_id)
            .maybeSingle();

          if (!project) {
            console.log('Project not found for condition check');
            results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'project_not_found' });
            continue;
          }

          if (rule.condition_type === 'sales_source') {
            const expectedSource = rule.condition_config?.sales_source;
            if (expectedSource && project.sales_source !== expectedSource) {
              console.log(`Skipping rule - sales source mismatch: "${project.sales_source}" !== "${expectedSource}"`);
              results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'sales_source_mismatch' });
              continue;
            }
          }

          if (rule.condition_type === 'sales_person') {
            const expectedSalesPerson = rule.condition_config?.sales_person_id;
            if (expectedSalesPerson && project.sales_person_id !== expectedSalesPerson) {
              console.log(`Skipping rule - sales person mismatch: "${project.sales_person_id}" !== "${expectedSalesPerson}"`);
              results.push({ rule: rule.name, action: rule.action_type, status: 'skipped', reason: 'sales_person_mismatch' });
              continue;
            }
          }
        }

        if (rule.action_type === 'add_label') {
          const labelId = rule.action_config.label_id;
          if (labelId) {
            const { data: existingLabel } = await supabase
              .from('project_labels')
              .select('id')
              .eq('project_id', project_id)
              .eq('label_id', labelId)
              .maybeSingle();

            if (!existingLabel) {
              const { error: insertError } = await supabase
                .from('project_labels')
                .insert({
                  project_id: project_id,
                  label_id: labelId
                });

              if (insertError) throw insertError;
              console.log('Label added successfully');
              executedCount++;
              results.push({ rule: rule.name, action: 'add_label', status: 'success' });
            } else {
              console.log('Label already exists');
              results.push({ rule: rule.name, action: 'add_label', status: 'skipped' });
            }
          }
        } else if (rule.action_type === 'remove_label') {
          const labelId = rule.action_config.label_id;
          if (labelId) {
            const { error: deleteError } = await supabase
              .from('project_labels')
              .delete()
              .eq('project_id', project_id)
              .eq('label_id', labelId);

            if (deleteError) throw deleteError;
            console.log('Label removed successfully');
            executedCount++;
            results.push({ rule: rule.name, action: 'remove_label', status: 'success' });
          }
        } else if (rule.action_type === 'add_task') {
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
                console.log(`Calculated deadline: ${calculatedDeadline} (${offsetDays} days ${direction} current day)`);
              } else {
                const { data: project } = await supabase
                  .from('projects')
                  .select('project_end_date, next_hkpc_due_date, start_date, project_start_date, submission_date, approval_date')
                  .eq('id', project_id)
                  .maybeSingle();

                if (project) {
                  const baseDate = project[taskConfig.due_date_base as keyof typeof project];
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
                    console.log(`Calculated deadline: ${calculatedDeadline} (${offsetDays} days ${direction} ${taskConfig.due_date_base})`);
                  }
                }
              }
            }

            // Resolve assigned_to value
            let assignedTo = taskConfig.assigned_to || null;
            if (assignedTo === '__project_sales_person__') {
              const { data: project } = await supabase
                .from('projects')
                .select('sales_person_id')
                .eq('id', project_id)
                .maybeSingle();

              assignedTo = project?.sales_person_id || null;
              console.log('Assigning task to project sales person:', assignedTo);
            }

            const { error: taskError } = await supabase
              .from('tasks')
              .insert({
                project_id: project_id,
                title: taskConfig.title,
                description: taskConfig.description || '',
                deadline: calculatedDeadline,
                assigned_to: assignedTo,
                completed: false
              });

            if (taskError) throw taskError;
            console.log('Task added successfully');
            executedCount++;
            results.push({ rule: rule.name, action: 'add_task', status: 'success' });
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
              .eq('id', project_id);

            if (statusError) throw statusError;
            console.log('Project status changed successfully');
            executedCount++;
            results.push({ rule: rule.name, action: 'change_status', status: 'success' });
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
                .eq('id', project_id);

              if (updateError) throw updateError;
              console.log(`Field ${fieldName} set to ${fieldValue} successfully`);
              executedCount++;
              results.push({ rule: rule.name, action: 'set_field_value', status: 'success', field: fieldName, value: fieldValue });
            }
          }
        }
      } catch (error: any) {
        console.error('Error executing rule:', rule.name, error);
        results.push({ rule: rule.name, action: rule.action_type, status: 'error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Executed ${executedCount} automation rules`, 
        executed: executedCount,
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
    console.error('Error in automation function:', error);
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
