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

    console.log('Starting invoice chase backfill simulation...');
    const now = new Date();

    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('name', 'All Status -> invoice Chase')
      .eq('is_active', true)
      .maybeSingle();

    if (ruleError || !rule) {
      throw new Error('Invoice chase rule not found or not active');
    }

    console.log('Found rule:', rule.name);

    const intervalDays = rule.trigger_config?.frequency || 9;
    console.log('Interval days:', intervalDays);

    const { data: invoices, error: invoicesError } = await supabase
      .from('funding_invoice')
      .select('id, invoice_number, issue_date, project_id, projects(id, title, sales_person_id)')
      .neq('payment_status', 'Paid')
      .not('issue_date', 'is', null);

    if (invoicesError) throw invoicesError;

    console.log(`Found ${invoices?.length || 0} unpaid invoices`);

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No unpaid invoices found', executed: 0 }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const results = [];
    let totalExecuted = 0;

    for (const invoice of invoices) {
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

      for (let daysAgo = 0; daysAgo < 5; daysAgo++) {
        const simulationDate = new Date(now);
        simulationDate.setDate(simulationDate.getDate() - daysAgo);
        simulationDate.setHours(0, 0, 0, 0);

        const daysSinceIssue = Math.floor((simulationDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceIssue < intervalDays) {
          console.log(`Invoice ${invoice.invoice_number}: Day ${daysSinceIssue} - too early (need day ${intervalDays})`);
          continue;
        }

        const expectedExecutionNumber = Math.floor(daysSinceIssue / intervalDays);
        const targetExecutionDay = expectedExecutionNumber * intervalDays;

        if (daysSinceIssue !== targetExecutionDay) {
          console.log(`Invoice ${invoice.invoice_number}: Day ${daysSinceIssue} - not a target day (target: ${targetExecutionDay})`);
          continue;
        }

        const { data: existingExecution } = await supabase
          .from('periodic_automation_executions')
          .select('*')
          .eq('automation_rule_id', rule.id)
          .eq('invoice_id', invoice.id)
          .maybeSingle();

        if (existingExecution) {
          console.log(`Invoice ${invoice.invoice_number}: Already has execution record, skipping`);
          continue;
        }

        console.log(`✓ Invoice ${invoice.invoice_number}: EXECUTING for day ${daysSinceIssue} (${daysAgo} days ago)`);

        const nextExecutionDate = new Date(simulationDate);
        nextExecutionDate.setDate(nextExecutionDate.getDate() + intervalDays);

        await supabase
          .from('periodic_automation_executions')
          .insert({
            automation_rule_id: rule.id,
            project_id: invoice.project_id,
            invoice_id: invoice.id,
            last_executed_at: simulationDate.toISOString(),
            next_execution_at: nextExecutionDate.toISOString()
          });

        const taskConfig = rule.action_config;
        if (taskConfig.title) {
          let calculatedDeadline = taskConfig.deadline || null;

          if (taskConfig.due_date_base && taskConfig.due_date_offset !== undefined) {
            if (taskConfig.due_date_base === 'current_day') {
              const baseDateObj = new Date(simulationDate);
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

          if (taskError) {
            console.error('Error creating task:', taskError);
            results.push({
              invoice: invoice.invoice_number,
              days_ago: daysAgo,
              day_since_issue: daysSinceIssue,
              status: 'error',
              error: taskError.message
            });
          } else {
            totalExecuted++;
            results.push({
              invoice: invoice.invoice_number,
              project: project.title,
              days_ago: daysAgo,
              day_since_issue: daysSinceIssue,
              status: 'success'
            });
          }
        }

        break;
      }
    }

    console.log(`Backfill completed. Total executed: ${totalExecuted}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfilled ${totalExecuted} invoice chase tasks`,
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
    console.error('Error in backfill simulation:', error);
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
