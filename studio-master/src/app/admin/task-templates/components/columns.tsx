
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Edit, Trash2, ArrowUpDown, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskTemplate } from "@/lib/types";

export const getTaskTemplateColumns = (
    handleEdit: (template: TaskTemplate) => void,
    handleArchiveToggle: (templateId: string, archive: boolean) => void,
    getDynamicTableName: (id?: string) => string,
    activeTab: "current" | "archived"
): ColumnDef<TaskTemplate>[] => [
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
    accessorKey: "category",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => row.getValue("category") || "N/A",
  },
  {
    accessorKey: "assignedRoleType",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Assigned Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => row.getValue("assignedRoleType") || "N/A",
  },
  {
    accessorKey: "dueDateOffsetDays",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due Date Offset
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const offset = row.getValue("dueDateOffsetDays") as number | undefined;
      return offset ? `${offset} day(s)` : "N/A";
    },
  },
  {
    accessorKey: "dynamicTableId",
    header: "Associated Table",
    cell: ({ row }) => getDynamicTableName(row.getValue("dynamicTableId")),
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
