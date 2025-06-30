
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { WorkflowInstance } from "@/lib/types";
import { WorkflowInstanceStatus } from "@/lib/types";
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";

export const getRecentWorkflowInstanceColumns = (
    getWorkflowTemplateName: (templateId: string) => string
): ColumnDef<WorkflowInstance>[] => [
  {
    accessorKey: "name",
     header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Instance Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
        const instance = row.original;
        return (
            <Link href={`/workflows/${instance.id}`} className="font-medium hover:underline">
                {instance.name || `Instance ${instance.id.substring(0,6)}`}
            </Link>
        );
    }
  },
  {
    accessorKey: "workflowTemplateId",
    header: "Template",
    cell: ({ row }) => getWorkflowTemplateName(row.getValue("workflowTemplateId")),
    enableSorting: false,
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
      const status = row.getValue("status") as WorkflowInstanceStatus;
       return (
        <Badge variant={status === WorkflowInstanceStatus.ACTIVE ? 'default' : status === WorkflowInstanceStatus.COMPLETED ? 'outline' : 'destructive'}
            className={status === WorkflowInstanceStatus.ACTIVE ? 'bg-sky-500/20 text-sky-700 border-sky-500/30 hover:bg-sky-500/30 dark:bg-sky-500/30 dark:text-sky-300 dark:border-sky-500/40' : 
                       status === WorkflowInstanceStatus.COMPLETED ? 'bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30 dark:bg-green-500/30 dark:text-green-300 dark:border-green-500/40' : 
                       'bg-red-500/20 text-red-700 border-red-500/30 hover:bg-red-500/30 dark:bg-red-500/30 dark:text-red-300 dark:border-red-500/40'}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "startDatetime",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Started On
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => format(parseISO(row.getValue("startDatetime")), "MMM d, yyyy"),
  },
];
