
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Edit, ArrowUpDown, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowTemplate } from "@/lib/types";

export const getWorkflowTemplateColumns = (
    handleEdit: (template: WorkflowTemplate) => void,
    handleArchiveToggle: (templateId: string, archive: boolean) => void,
    activeTab: "current" | "archived"
): ColumnDef<WorkflowTemplate>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
        const description = row.getValue("description") as string || "";
        return description.length > 50 ? `${description.substring(0, 47)}...` : description || "N/A";
    },
    enableSorting: false,
  },
  {
    accessorKey: "taskTemplateIds",
    header: "Tasks Count",
    cell: ({ row }) => {
        const taskIds = row.getValue("taskTemplateIds") as string[];
        return `${taskIds.length} task(s)`;
    },
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const template = row.original;
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
              <DropdownMenuItem onClick={() => handleEdit(template)} disabled={activeTab === "archived"}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              {activeTab === "current" ? (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(template.id, true)}
                  className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10"
                >
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(template.id, false)}
                  className="text-green-600 focus:text-green-600 focus:bg-green-500/10"
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
