
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable } from '@/components/common/data-table';
import type { Task, TaskTemplate, WorkflowInstance, User } from '@/lib/types';
import { getTasks, getTaskTemplates, getWorkflowInstances } from '@/lib/data';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardCheck, ServerOff } from 'lucide-react';
import { getTaskColumns } from './components/columns';
import { parseISO } from 'date-fns';

interface ExtendedTask extends Task {
  taskTemplateName?: string;
  workflowInstanceName?: string;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setIsLoading(false); // Not logged in, no tasks to load
      return;
    }

    async function loadData() {
      setIsLoading(true);
      try {
        const [allTasksData, taskTemplatesData, workflowInstancesData] = await Promise.all([
          getTasks(),
          getTaskTemplates(),
          getWorkflowInstances(),
        ]);

        setTaskTemplates(taskTemplatesData);
        setWorkflowInstances(workflowInstancesData);

        const userTasks = allTasksData
          .filter(task => task.assignedToUserId === user.uid)
          .map(task => ({
            ...task,
            taskTemplateName: taskTemplatesData.find(t => t.id === task.taskTemplateId)?.name || 'Unknown Task',
            workflowInstanceName: workflowInstancesData.find(wf => wf.id === task.workflowInstanceId)?.name || `Instance ${task.workflowInstanceId.substring(0,6)}`,
          }))
          .sort((a, b) => { // Sort by due date (earliest first), then by status, then by creation
            const dueDateA = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
            const dueDateB = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
            if (dueDateA !== dueDateB) return dueDateA - dueDateB;
            
            const statusOrder = { "Overdue": 0, "Pending": 1, "In Progress": 2, "Completed": 3, "Skipped": 4 };
            const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 5;
            const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 5;
            if(statusA !== statusB) return statusA - statusB;

            return parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime();
          });
        
        setTasks(userTasks);

      } catch (error) {
        console.error("Failed to load tasks data:", error);
        toast({ title: "Error", description: "Could not load your tasks.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user, toast]);

  const columns = useMemo(() => getTaskColumns(taskTemplates, workflowInstances), [taskTemplates, workflowInstances]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading your tasks...</p>
      </div>
    );
  }

  if (!user) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <ServerOff className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Not Logged In</h2>
        <p className="text-muted-foreground">Please log in to view your tasks.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="My Tasks"
        description="View and manage tasks assigned to you across all workflows."
      />
      
      {tasks.length === 0 && !isLoading ? (
        <div className="text-center p-8 mt-4 rounded-lg border shadow-sm flex flex-col items-center">
          <ClipboardCheck className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Tasks Assigned</h3>
          <p className="text-muted-foreground">You currently have no tasks assigned to you. Great job, or check back later!</p>
        </div>
      ) : (
        <DataTable columns={columns} data={tasks} searchPlaceholder="Search your tasks..." />
      )}
    </>
  );
}
