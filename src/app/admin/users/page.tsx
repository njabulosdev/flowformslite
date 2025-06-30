
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2, Archive } from 'lucide-react';
import type { User } from '@/lib/types';
import { getUsers, addUser, updateUser, archiveUser } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import { getUserColumns } from './components/columns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["Administrator", "TaskExecutor", "StandardUser"]),
});

type UserFormData = z.infer<typeof userSchema>;

export default function UserManagementPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archivingUser, setArchivingUser] = useState<{id: string, archive: boolean, username: string} | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      try {
        const fetchedUsers = await getUsers();
        setAllUsers(fetchedUsers);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch users.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadUsers();
  }, [toast]);
  
  const currentUsers = useMemo(() => allUsers.filter(u => !u.isArchived), [allUsers]);
  const archivedUsers = useMemo(() => allUsers.filter(u => u.isArchived), [allUsers]);

  const handleAddNewUser = () => {
    setEditingUser(null);
    form.reset({ username: '', email: '', role: 'StandardUser' });
    setIsDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    if (user.isArchived) {
      toast({ title: "Cannot Edit", description: "Archived users cannot be edited. Please restore the user first.", variant: "destructive" });
      return;
    }
    setEditingUser(user);
    form.reset({
        username: user.username,
        email: user.email,
        role: user.role,
    });
    setIsDialogOpen(true);
  };
  
  const confirmArchiveToggle = (userId: string, shouldArchive: boolean, username: string) => {
    setArchivingUser({ id: userId, archive: shouldArchive, username });
  };

  const handleArchiveToggleAction = async () => {
    if (!archivingUser) return;
    const { id, archive, username } = archivingUser;
    try {
      const updatedUser = await archiveUser(id, archive);
      setAllUsers(allUsers.map(u => u.id === id ? updatedUser : u));
      toast({ title: `User ${archive ? 'Archived' : 'Restored'}`, description: `User "${username}" has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} user.`, variant: "destructive" });
    } finally {
      setArchivingUser(null);
    }
  };

  const onSubmit: SubmitHandler<UserFormData> = async (data) => {
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, data);
        setAllUsers(allUsers.map(u => u.id === editingUser.id ? updated : u));
        toast({ title: "User Updated", description: `User ${data.username} has been updated.`});
      } else {
        const newUser = await addUser(data);
        setAllUsers(prevUsers => [newUser, ...prevUsers].sort((a,b) => a.username.localeCompare(b.username)));
        toast({ title: "User Created", description: `User ${data.username} has been created.`});
      }
      setIsDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save user.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const columnsCurrent = useMemo(() => getUserColumns(handleEditUser, confirmArchiveToggle, "current"), [allUsers]);
  const columnsArchived = useMemo(() => getUserColumns(handleEditUser, confirmArchiveToggle, "archived"), [allUsers]);


  if (isLoading && allUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage user accounts and their roles within the system."
        actionButtonText={activeTab === "current" ? "Add New User" : undefined}
        onActionButtonClick={activeTab === "current" ? handleAddNewUser : undefined}
      />
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current Users</TabsTrigger>
          <TabsTrigger value="archived">Archived Users</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {isLoading && currentUsers.length === 0 && allUsers.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading current users...</div>
          ) : (
            <DataTable columns={columnsCurrent} data={currentUsers} searchPlaceholder="Search current users..." />
          )}
        </TabsContent>
        <TabsContent value="archived">
          {isLoading && archivedUsers.length === 0 && allUsers.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading archived users...</div>
          ) : (
            <DataTable columns={columnsArchived} data={archivedUsers} searchPlaceholder="Search archived users..." />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update the details for this user.' : 'Create a new user account. Password handling is not part of this form.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            <div>
                <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label htmlFor="username" className="text-right col-span-1">
                        Username
                    </Label>
                    <Input id="username" {...form.register("username")} className="col-span-3" />
                </div>
                {form.formState.errors.username && (
                    <div className="grid grid-cols-4 gap-x-4 mt-1">
                        <div className="col-span-1" /> 
                        <p className="col-span-3 text-sm text-destructive">{form.formState.errors.username.message}</p>
                    </div>
                )}
            </div>
            
            <div>
                <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label htmlFor="email" className="text-right col-span-1">
                        Email
                    </Label>
                    <Input id="email" type="email" {...form.register("email")} className="col-span-3" />
                </div>
                {form.formState.errors.email && (
                    <div className="grid grid-cols-4 gap-x-4 mt-1">
                        <div className="col-span-1" /> 
                        <p className="col-span-3 text-sm text-destructive">{form.formState.errors.email.message}</p>
                    </div>
                )}
            </div>

            <div>
                <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label htmlFor="role" className="text-right col-span-1">
                        Role
                    </Label>
                    <div className="col-span-3">
                        <Controller
                            name="role"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value || 'StandardUser'}>
                                    <SelectTrigger id="role">
                                    <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="Administrator">Administrator</SelectItem>
                                    <SelectItem value="TaskExecutor">Task Executor</SelectItem>
                                    <SelectItem value="StandardUser">Standard User</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>
                {form.formState.errors.role && (
                    <div className="grid grid-cols-4 gap-x-4 mt-1">
                        <div className="col-span-1" /> 
                        <p className="col-span-3 text-sm text-destructive">{form.formState.errors.role.message}</p>
                    </div>
                )}
            </div>
            
            {!editingUser && (
                <div className="grid grid-cols-4 items-center gap-x-4">
                    <Label htmlFor="password_placeholder" className="text-right col-span-1">Password</Label>
                    <Input id="password_placeholder" type="password" placeholder="Set initial password (mock)" className="col-span-3" disabled />
                </div>
            )}

            <div className="grid grid-cols-4 gap-x-4">
                <div className="col-span-1" /> 
                <p className="col-span-3 text-xs text-muted-foreground">
                Note: Password management and authentication are handled by Firebase Authentication, not this form.
                </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save User'}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archivingUser} onOpenChange={(open) => !open && setArchivingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {archivingUser?.archive ? 'archive' : 'restore'} the user "{archivingUser?.username}".
              {archivingUser?.archive ? ' Archived users cannot log in.' : ' Restored users will regain access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchivingUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleArchiveToggleAction}
                className={archivingUser?.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
                {archivingUser?.archive ? 'Archive' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
