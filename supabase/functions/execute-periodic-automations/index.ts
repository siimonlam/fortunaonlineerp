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

    console.log('Starting periodic automation execution...');
    const now = new Date();

    const { data: periodicRules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('trigger_type', 'periodic')
      .eq('is_active', true);

    if (rulesError) {
      console.error('Error fetching periodic rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${periodicRules?.length || 0} active periodic rules`);
    console.log('Rules:', JSON.stringify(periodicRules));

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

    const rulePromises = periodicRules.map(async (rule) => {
      try {
        console.log(`Processing rule: ${rule.name}`);

        const intervalDays = rule.trigger_config?.frequency || rule.trigger_config?.interval_days || 1;
        const checkInvoices = rule.trigger_config?.check_invoices === true;

        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        if (checkInvoices) {
          console.log('Processing invoice-based automation...');

          let invoiceQuery = supabase
            .from('funding_invoice')
            .select('id, invoice_number, issue_date, project_id, projects(id, title, sales_person_id, status_id)')
            .in('payment_status', ['Unpaid', 'unpaid', 'Pending', 'pending', 'Overdue', 'overdue'])
            .not('issue_date', 'is', null);

          let allowedProjectIds: string[] | null = null;

          if (rule.project_type_id && rule.main_status !== 'All') {
            const statusIds = [];
            if (rule.substatus_filter && rule.substatus_filter !== 'All') {
              statusIds.push(rule.substatus_filter);
            } else {
              const { data: matchingStatuses } = await supabase
                .from('statuses')
                .select('id, name, is_substatus, parent_status_id')
                .eq('name', rule.main_status)
                .eq('project_type_id', rule.project_type_id);

              if (matchingStatuses && matchingStatuses.length > 0) {
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
              }
            }

            if (statusIds.length > 0) {
              const { data: projectsInStatus } = await supabase
                .from('projects')
                .select('id')
                .eq('project_type_id', rule.project_type_id)
                .in('status_id', statusIds);

              if (projectsInStatus && projectsInStatus.length > 0) {
                allowedProjectIds = projectsInStatus.map(p => p.id);
              } else {
                console.log('No projects found in specified status');
                return;
              }
            }
          } else if (rule.main_status === 'All' && rule.project_type_id) {
            const { data: projectsForType } = await supabase
              .from('projects')
              .select('id')
              .eq('project_type_id', rule.project_type_id);

            if (projectsForType && projectsForType.length > 0) {
              allowedProjectIds = projectsForType.map(p => p.id);
            } else {
              console.log('No projects found for project type');
              return;
            }
          }

          const { data: invoices, error: invoicesError } = await invoiceQuery;

          if (invoicesError) throw invoicesError;

          console.log(`Found ${invoices?.length || 0} unpaid invoices (before filtering)`);

          if (!invoices || invoices.length === 0) return;

          const filteredInvoices = allowedProjectIds
            ? invoices.filter(inv => allowedProjectIds.includes(inv.project_id))
            : invoices;

          console.log(`Processing ${filteredInvoices.length} invoices after project type filtering`);

          for (const invoice of filteredInvoices) {
            if (!invoice.issue_date || !invoice.project_id) {
              console.log(`Invoice ${invoice.invoice_number} missing issue_date or project_id, skipping`);
              continue;
            }

            const project = invoice.projects as any;
            if (!project) {
              console.log(`Invoice ${invoice.invoice_number} has no associated project, skipping`);
              continue;
            }

            const issueDate = new Date(invoice.issue_date);
            issueDate.setHours(0, 0, 0, 0);

            const daysSinceIssue = Math.floor((todayMidnight.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceIssue % intervalDays === 0 && daysSinceIssue > 0) {
              const { data: alreadyExecutedToday } = await supabase
                .from('periodic_automation_executions')
                .select('last_executed_at, invoice_id')
                .eq('automation_rule_id', rule.id)
                .eq('invoice_id', invoice.id)
                .maybeSingle();

              if (alreadyExecutedToday) {
                const lastExecuted = new Date(alreadyExecutedToday.last_executed_at);
                lastExecuted.setHours(0, 0, 0, 0);
                if (lastExecuted.getTime() === todayMidnight.getTime()) {
                  console.log(`Already executed today for invoice ${invoice.invoice_number}, skipping`);
                  continue;
                }
              }

              console.log(`Executing automation for invoice ${invoice.invoice_number}: ${daysSinceIssue} days since issue (${daysSinceIssue} % ${intervalDays} = 0)`);

              const nextExecution = new Date(todayMidnight);
              nextExecution.setDate(nextExecution.getDate() + intervalDays);

              const { data: trackingRecord, error: trackingError } = await supabase
                .from('periodic_automation_executions')
                .upsert({
                  automation_rule_id: rule.id,
                  project_id: invoice.project_id,
                  invoice_id: invoice.id,
                  last_executed_at: now.toISOString(),
                  next_execution_at: nextExecution.toISOString(),
                  updated_at: now.toISOString()
                }, {
                  onConflict: 'automation_rule_id,project_id'
                })
                .select();

              if (trackingError) {
                console.error(`Failed to track execution for invoice ${invoice.invoice_number}:`, trackingError);
                throw trackingError;
              }

              console.log(`Tracked execution for invoice ${invoice.invoice_number}, next execution: ${nextExecution.toISOString()}`);

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
                    }
                  }

                  let assignedTo = taskConfig.assigned_to || null;
                  if (assignedTo === '__project_sales_person__') {
                    assignedTo = project.sales_person_id || null;
                  }

                  const { error: taskError } = await supabase
                    .from('tasks')
                    .insert({
                      project_id: invoice.project_id,
                      title: taskConfig.title,
                      description: taskConfig.description || '',
                      deadline: calculatedDeadline,
                      assigned_to: assignedTo,
                      completed: false
                    });

                  if (taskError) throw taskError;
                  console.log('Task added successfully for invoice chase');
                  results.push({
                    rule: rule.name,
                    invoice: invoice.invoice_number,
                    project: project.title,
                    action: 'add_task',
                    status: 'success'
                  });
                }
              }
            } else {
              console.log(`Skipping invoice ${invoice.invoice_number}: ${daysSinceIssue} days since issue (${daysSinceIssue} % ${intervalDays} = ${daysSinceIssue % intervalDays})`);
            }
          }
        } else {
          console.log('Processing project-based automation...');

          const statusIds = [];

          if (rule.main_status === 'All') {
            const { data: allStatuses } = await supabase
              .from('statuses')
              .select('id')
              .eq('project_type_id', rule.project_type_id);

            if (allStatuses && allStatuses.length > 0) {
              statusIds.push(...allStatuses.map(s => s.id));
            }
          } else if (rule.substatus_filter && rule.substatus_filter !== 'All') {
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

          const dateField = rule.trigger_config?.date_field || 'project_start_date';

          const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select(`id, status_id, title, sales_person_id, ${dateField}`)
            .eq('project_type_id', rule.project_type_id)
            .in('status_id', statusIds);

          if (projectsError) throw projectsError;

          console.log(`Found ${projects?.length || 0} projects in status ${rule.main_status}`);

          if (!projects || projects.length === 0) return;

          for (const project of projects) {
            const projectStartDate = project[dateField];
            if (!projectStartDate) {
              console.log(`Project ${project.title} has no ${dateField}, skipping`);
              continue;
            }

            const startDate = new Date(projectStartDate);
            startDate.setHours(0, 0, 0, 0);

            const daysSinceStart = Math.floor((todayMidnight.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceStart % intervalDays === 0 && daysSinceStart > 0) {
              const { data: alreadyExecutedToday } = await supabase
                .from('periodic_automation_executions')
                .select('last_executed_at')
                .eq('automation_rule_id', rule.id)
                .eq('project_id', project.id)
                .maybeSingle();

              if (alreadyExecutedToday) {
                const lastExecuted = new Date(alreadyExecutedToday.last_executed_at);
                lastExecuted.setHours(0, 0, 0, 0);
                if (lastExecuted.getTime() === todayMidnight.getTime()) {
                  console.log(`Already executed today for ${project.title}, skipping`);
                  continue;
                }
              }

              console.log(`Executing automation for ${project.title}: ${daysSinceStart} days since ${dateField} (${daysSinceStart} % ${intervalDays} = 0)`);

              const nextExecution = new Date(todayMidnight);
              nextExecution.setDate(nextExecution.getDate() + intervalDays);

              const { data: trackingRecord, error: trackingError } = await supabase
                .from('periodic_automation_executions')
                .upsert({
                  automation_rule_id: rule.id,
                  project_id: project.id,
                  last_executed_at: now.toISOString(),
                  next_execution_at: nextExecution.toISOString(),
                  updated_at: now.toISOString()
                }, {
                  onConflict: 'automation_rule_id,project_id'
                })
                .select();

              if (trackingError) {
                console.error(`Failed to track execution for ${project.title}:`, trackingError);
                throw trackingError;
              }

              console.log(`Tracked execution for ${project.title}, next execution: ${nextExecution.toISOString()}`);

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
                  results.push({
                    rule: rule.name,
                    project: project.title,
                    action: 'change_status',
                    status: 'success'
                  });
                }
              }
            } else {
              console.log(`Skipping ${project.title}: ${daysSinceStart} days since ${dateField} (${daysSinceStart} % ${intervalDays} = ${daysSinceStart % intervalDays})`);
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
    });

    await Promise.allSettled(rulePromises);

    totalExecuted = results.filter(r => r.status === 'success').length;
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
