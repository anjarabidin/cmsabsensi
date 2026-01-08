import { Button } from '@/components/ui/button';
import { Check, X, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  onApproveAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onClearSelection: () => void;
  loading?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onClearSelection,
  loading = false,
}: BulkActionsBarProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const handleApprove = async () => {
    await onApproveAll();
    setApproveDialogOpen(false);
  };

  const handleReject = async () => {
    await onRejectAll();
    setRejectDialogOpen(false);
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in-left">
        <div className="bg-card border rounded-lg shadow-lg px-6 py-4 flex items-center gap-4">
          <p className="text-sm font-medium">
            {selectedCount} item dipilih
          </p>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => setApproveDialogOpen(true)}
              disabled={loading}
            >
              <Check className="mr-2 h-4 w-4" />
              Setujui Semua
            </Button>
            
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={loading}
            >
              <X className="mr-2 h-4 w-4" />
              Tolak Semua
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Batal
            </Button>
          </div>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui {selectedCount} Pengajuan?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menyetujui {selectedCount} pengajuan sekaligus. 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={loading}>
              {loading ? 'Processing...' : 'Ya, Setujui'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak {selectedCount} Pengajuan?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menolak {selectedCount} pengajuan sekaligus. 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Processing...' : 'Ya, Tolak'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
