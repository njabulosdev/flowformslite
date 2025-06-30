import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  actionButtonText?: string;
  onActionButtonClick?: () => void;
}

export function PageHeader({ title, description, actionButtonText, onActionButtonClick }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {actionButtonText && onActionButtonClick && (
        <Button onClick={onActionButtonClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {actionButtonText}
        </Button>
      )}
    </div>
  );
}
