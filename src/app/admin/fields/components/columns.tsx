
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
import type { DynamicField } from "@/lib/types";

export const getDynamicFieldColumns = (
    handleEdit: (field: DynamicField) => void,
    handleArchiveToggle: (fieldId: string, archive: boolean) => void,
    activeTab: "current" | "archived"
): ColumnDef<DynamicField>[] => [
  {
    accessorKey: "label",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Label
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("label")}</div>,
  },
  {
    accessorKey: "name",
     header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name (ID)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "type",
     header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
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
    accessorKey: "isRequired",
    header: "Required",
    cell: ({ row }) => (row.getValue("isRequired") ? "Yes" : "No"),
  },
  {
    accessorKey: "options",
    header: "Options",
    cell: ({ row }) => {
      const options = row.getValue("options") as DynamicField["options"];
      return (options && options.length > 0) ? `${options.length} option(s)` : "N/A";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const field = row.original;
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
              <DropdownMenuItem onClick={() => handleEdit(field)} disabled={activeTab === "archived"}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              {activeTab === "current" ? (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(field.id, true)}
                  className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10"
                >
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(field.id, false)}
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
