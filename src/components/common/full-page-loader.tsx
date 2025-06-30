
import { Loader2 } from 'lucide-react';

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Loading...</p>
    </div>
  );
}
