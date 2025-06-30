
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Edit, Archive, ArchiveRestore, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/types";
import { format } from 'date-fns';

export const getUserColumns = (
    handleEdit: (user: User) => void,
    handleArchiveToggle: (userId: string, archive: boolean, username: string) => void,
    activeTab: "current" | "archived"
): ColumnDef<User>[] => [
  {
    accessorKey: "username",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Username
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("username")}</div>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "role",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const role = row.getValue("role") as User["role"];
      return (
        <Badge variant={role === 'Administrator' ? 'default' : 'secondary'}>
          {role}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as string;
        try {
            return format(new Date(createdAt), "MMM d, yyyy");
        } catch (e) {
            return "Invalid Date";
        }
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;
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
              <DropdownMenuItem onClick={() => handleEdit(user)} disabled={activeTab === "archived"}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              {activeTab === "current" ? (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(user.id, true, user.username)}
                  className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10"
                >
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleArchiveToggle(user.id, false, user.username)}
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
