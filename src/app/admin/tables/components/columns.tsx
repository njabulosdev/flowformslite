
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Edit, ArrowUpDown, Archive, ArchiveRestore, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DynamicTable } from "@/lib/types";
import Link from "next/link";

export const getDynamicTableColumns = (
    handleEdit: (table: DynamicTable) => void,
    handleArchiveToggle: (table: DynamicTable, archive: boolean) => void,
    activeTab: "current" | "archived"
): ColumnDef<DynamicTable>[] => [
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
    cell: ({ row }) => {
      return (
        <Link href={`/admin/tables/${row.original.id}`} className="font-medium hover:underline">
          {row.getValue("label")}
        </Link>
      );
    }
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
    accessorKey: "fieldIds",
    header: "Fields Count",
    cell: ({ row }) => {
        const fieldIds = row.getValue("fieldIds") as string[];
        return `${fieldIds.length} field(s)`;
    },
    enableSorting: false,
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
    id: "actions",
    cell: ({ row }) => {
      const table = row.original;
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
                <Link href={`/admin/tables/${table.id}`} className="flex items-center cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" /> View Data
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(table)} disabled={activeTab === "archived"}>
                <Edit className="mr-2 h-4 w-4" /> Edit Definition
              </DropdownMenuItem>
              {activeTab === "current" ? (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(table, true)}
                  className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10"
                >
                  <Archive className="mr-2 h-4 w-4" /> Archive Definition
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(table, false)}
                  className="text-green-600 focus:text-green-600 focus:bg-green-500/10"
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore Definition
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
