
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { OverdueTasksChart } from "@/components/dashboard/overdue-tasks-chart";
import { Activity, CheckCircle, AlertTriangle, ListChecks, PlusCircle, Workflow as WorkflowIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import type { WorkflowSummary, TaskSummary, WorkflowInstance, WorkflowTemplate, Task } from '@/lib/types'; // Added Task
import { TaskStatus } from '@/lib/types'; // Added TaskStatus
import { getWorkflowSummary, getTaskSummary, getWorkflowInstances, getWorkflowTemplates, getTasks } from '@/lib/data'; // Added getTasks
import { parseISO, format as formatDate, subDays, startOfDay } from 'date-fns'; // Added more date-fns
import { DataTable } from '@/components/common/data-table';
import { getRecentWorkflowInstanceColumns } from './dashboard/components/columns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from "@/lib/utils";

interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  overdue: number;
  completed: number;
}

export default function DashboardPage() {
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowInstance[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [taskChartData, setTaskChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [
          summary,
          tasksSummaryData,
          instances,
          templates,
          allTasksData, // Fetch all tasks
        ] = await Promise.all([
          getWorkflowSummary(),
          getTaskSummary(),
          getWorkflowInstances(),
          getWorkflowTemplates(),
          getTasks(), // Added
        ]);
        setWorkflowSummary(summary);
        setTaskSummary(tasksSummaryData);
        setRecentWorkflows(instances.filter(inst => !inst.isArchived).sort((a,b) => parseISO(b.startDatetime).getTime() - parseISO(a.startDatetime).getTime()).slice(0, 5));
        setWorkflowTemplates(templates);

        // Process data for Task Overview Chart
        const today = new Date();
        const newChartData: ChartDataPoint[] = [];
        const nonArchivedInstanceIds = new Set(instances.filter(inst => !inst.isArchived).map(inst => inst.id));
        
        const relevantTasks = allTasksData.filter(task => nonArchivedInstanceIds.has(task.workflowInstanceId));

        for (let i = 6; i >= 0; i--) {
          const targetDay = startOfDay(subDays(today, i));
          const targetDayString = formatDate(targetDay, "yyyy-MM-dd");

          let completedOnDay = 0;
          let becameOverdueOnDay = 0;

          relevantTasks.forEach(task => {
            // Completed tasks
            if (task.finishDatetime) {
              const finishDate = startOfDay(parseISO(task.finishDatetime));
              if (finishDate.getTime() === targetDay.getTime()) {
                completedOnDay++;
              }
            }

            // Tasks that became overdue on this day
            if (task.dueDate) {
              const dueDate = startOfDay(parseISO(task.dueDate));
              if (dueDate.getTime() === targetDay.getTime()) { // Due on this specific day
                let isCompletedOnOrBeforeDueDate = false;
                if (task.finishDatetime) {
                  const finishDateCheck = parseISO(task.finishDatetime);
                   // If finishDatetime is on or before the dueDate
                  if (startOfDay(finishDateCheck).getTime() <= dueDate.getTime()) {
                     isCompletedOnOrBeforeDueDate = true;
                  }
                }
                if (task.status !== TaskStatus.COMPLETED && !isCompletedOnOrBeforeDueDate) {
                   becameOverdueOnDay++;
                }
              }
            }
          });
          newChartData.push({
            date: targetDayString,
            overdue: becameOverdueOnDay,
            completed: completedOnDay,
          });
        }
        setTaskChartData(newChartData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const getWorkflowTemplateName = (templateId: string) => {
    return workflowTemplates.find(t => t.id === templateId)?.name || 'Unknown Template';
  };

  const recentWorkflowColumns = useMemo(() => getRecentWorkflowInstanceColumns(getWorkflowTemplateName), [workflowTemplates]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your workflows and tasks.
          </p>
        </div>
        <Link href="/workflows/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Active Workflows"
          value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : workflowSummary?.totalActive ?? '0'}
          icon={Activity}
          description="Currently running workflow instances."
        />
        <SummaryCard
          title="Completed Workflows"
          value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : workflowSummary?.totalCompleted ?? '0'}
          icon={CheckCircle}
          description="Workflows finished successfully."
        />
        <SummaryCard
          title="Pending Tasks"
          value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : taskSummary?.pending ?? '0'}
          icon={ListChecks}
          description="Tasks awaiting action."
        />
        <SummaryCard
          title="Overdue Tasks"
          value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : taskSummary?.overdue ?? '0'}
          icon={AlertTriangle}
          className="border-destructive text-destructive [&_svg]:text-destructive"
          description="Tasks past their due date."
        />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <OverdueTasksChart data={taskChartData} />
        
        <div className="flex flex-col gap-6">
           <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Workflow Instances</CardTitle>
              <CardDescription>A quick look at the latest non-archived workflows.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && recentWorkflows.length === 0 ? ( // Show loader if loading and no workflows yet
                 <div className="flex flex-col items-center justify-center h-40 text-center">
                   <Loader2 className="w-12 h-12 text-muted-foreground animate-spin mb-2" />
                   <p className="text-muted-foreground">Loading recent workflows...</p>
                 </div>
              ) : recentWorkflows.length > 0 ? (
                <DataTable 
                    columns={recentWorkflowColumns} 
                    data={recentWorkflows} 
                    searchPlaceholder="Search recent workflows..." 
                    enableColumnToggle={false}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <WorkflowIcon className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No recent workflows.</p>
                  <Link href="/workflows/new" passHref>
                    <Button variant="link" className="mt-2">Create a new workflow</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
