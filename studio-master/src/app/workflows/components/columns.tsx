
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Archive, ArchiveRestore, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowInstance } from "@/lib/types";
import { WorkflowInstanceStatus } from "@/lib/types";
import { format, parseISO } from 'date-fns';
import Link from "next/link";

export const getWorkflowInstanceColumns = (
    getWorkflowTemplateName: (templateId: string) => string,
    handleArchiveToggle: (instanceId: string, shouldArchive: boolean) => void,
    activeTab: "current" | "archived"
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
        return <div className="font-medium">{instance.name || `Instance ${instance.id.substring(0,6)}`}</div>;
    }
  },
  {
    accessorKey: "workflowTemplateId",
    header: "Template",
    cell: ({ row }) => getWorkflowTemplateName(row.getValue("workflowTemplateId")),
    enableSorting: false, // Sorting by template name would require joining data or pre-calculating
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
    cell: ({ row }) => format(parseISO(row.getValue("startDatetime")), "MMM d, yyyy HH:mm"),
  },
  {
    accessorKey: "finishDatetime",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Finished On
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const finishDatetime = row.getValue("finishDatetime") as string | undefined;
      return finishDatetime ? format(parseISO(finishDatetime), "MMM d, yyyy HH:mm") : "N/A";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const instance = row.original;
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
                <Link href={`/workflows/${instance.id}`} className="flex items-center cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </Link>
              </DropdownMenuItem>
              {activeTab === "current" ? (
                <DropdownMenuItem onClick={() => handleArchiveToggle(instance.id, true)} className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10">
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleArchiveToggle(instance.id, false)} className="text-green-600 focus:text-green-600 focus:bg-green-500/10">
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
