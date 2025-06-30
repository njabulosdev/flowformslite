
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, WorkflowInstance, TaskTemplate } from "@/lib/types";
import { TaskStatus } from "@/lib/types";
import { format, parseISO } from 'date-fns';
import Link from "next/link";

interface ExtendedTask extends Task {
  taskTemplateName?: string;
  workflowInstanceName?: string;
}

export const getTaskColumns = (
    taskTemplates: TaskTemplate[],
    workflowInstances: WorkflowInstance[]
): ColumnDef<ExtendedTask>[] => [
  {
    accessorFn: (row) => taskTemplates.find(t => t.id === row.taskTemplateId)?.name || 'Unknown Task',
    id: "taskName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Task Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.original.taskTemplateName || 'Unknown Task'}</div>,
  },
  {
    accessorFn: (row) => workflowInstances.find(wf => wf.id === row.workflowInstanceId)?.name || `Instance ${row.workflowInstanceId.substring(0,6)}`,
    id: "workflowInstanceName",
    header: "Workflow Instance",
    cell: ({ row }) => {
        const instance = workflowInstances.find(wf => wf.id === row.original.workflowInstanceId);
        const name = instance?.name || `Instance ${row.original.workflowInstanceId.substring(0,6)}`;
        return (
            <Link href={`/workflows/${row.original.workflowInstanceId}`} className="hover:underline">
                {name}
            </Link>
        );
    }
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as TaskStatus;
      return (
        <Badge variant={
            status === TaskStatus.COMPLETED ? 'outline' : 
            status === TaskStatus.OVERDUE ? 'destructive' : 
            status === TaskStatus.IN_PROGRESS ? 'default' :
            'secondary'
          }
          className={
            status === TaskStatus.COMPLETED ? 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400 dark:border-green-500/50' :
            status === TaskStatus.OVERDUE ? '' :
            status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400 dark:border-blue-500/50' :
            'bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400 dark:border-slate-500/50'
          }
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const dueDate = row.getValue("dueDate") as string | undefined;
      return dueDate ? format(parseISO(dueDate), "MMM d, yyyy") : "N/A";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/workflows/${task.workflowInstanceId}`} className="flex items-center cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" /> View in Workflow
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
