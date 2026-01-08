import { useState, useEffect } from 'react';
import { Bookmark, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: {
    dateRange?: { from: Date; to: Date };
    departments?: string[];
    statuses?: string[];
    roles?: string[];
  };
  isDefault?: boolean;
}

interface FilterPresetsProps {
  onApplyPreset: (preset: FilterPreset) => void;
  currentFilters?: any;
}

export function FilterPresets({ onApplyPreset, currentFilters }: FilterPresetsProps) {
  const { toast } = useToast();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  // Load presets from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem('filterPresets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error('Error loading presets:', error);
      }
    }
  }, []);

  // Save presets to localStorage
  const savePresets = (updatedPresets: FilterPreset[]) => {
    setPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
  };

  const handleSavePreset = () => {
    if (!currentFilters || (!currentFilters.dateRange?.from && !currentFilters.departments?.length && !currentFilters.statuses?.length && !currentFilters.roles?.length)) {
      toast({
        title: "Error",
        description: "Tidak ada filter yang aktif untuk disimpan",
        variant: "destructive"
      });
      return;
    }

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName || `Filter ${presets.length + 1}`,
      description: presetDescription || 'Custom filter preset',
      filters: { ...currentFilters },
      isDefault: false
    };

    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    
    setPresetName('');
    setPresetDescription('');
    setIsDialogOpen(false);
    
    toast({
      title: "Success",
      description: "Filter preset berhasil disimpan"
    });
  };

  const handleUpdatePreset = () => {
    if (!editingPreset) return;

    const updatedPreset: FilterPreset = {
      ...editingPreset,
      name: presetName || editingPreset.name,
      description: presetDescription || editingPreset.description,
      filters: currentFilters ? { ...currentFilters } : editingPreset.filters
    };

    const updatedPresets = presets.map(p => p.id === editingPreset.id ? updatedPreset : p);
    savePresets(updatedPresets);
    
    setEditingPreset(null);
    setPresetName('');
    setPresetDescription('');
    setIsDialogOpen(false);
    
    toast({
      title: "Success",
      description: "Filter preset berhasil diperbarui"
    });
  };

  const handleDeletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    savePresets(updatedPresets);
    
    toast({
      title: "Success",
      description: "Filter preset berhasil dihapus"
    });
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset);
    toast({
      title: "Filter Applied",
      description: `Preset "${preset.name}" berhasil diterapkan`
    });
  };

  const openEditDialog = (preset: FilterPreset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetDescription(preset.description);
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          Filter Presets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Save Current Filter */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nama preset"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => setIsDialogOpen(true)}
              disabled={!currentFilters || (!currentFilters.dateRange?.from && !currentFilters.departments?.length && !currentFilters.statuses?.length && !currentFilters.roles?.length)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </div>

          {/* Preset List */}
          <div className="space-y-2">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Belum ada preset tersimpan</p>
                <p className="text-sm">Setel filter dan simpan sebagai preset untuk digunakan kembali</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{preset.name}</h4>
                        {preset.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{preset.description}</p>
                      <div className="flex gap-1 mt-1">
                        {preset.filters.dateRange?.from && (
                          <Badge variant="outline" className="text-xs">
                            Tanggal
                          </Badge>
                        )}
                        {preset.filters.departments?.length && (
                          <Badge variant="outline" className="text-xs">
                            {preset.filters.departments.length} Department
                          </Badge>
                        )}
                        {preset.filters.statuses?.length && (
                          <Badge variant="outline" className="text-xs">
                            {preset.filters.statuses.length} Status
                          </Badge>
                        )}
                        {preset.filters.roles?.length && (
                          <Badge variant="outline" className="text-xs">
                            {preset.filters.roles.length} Role
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyPreset(preset)}
                      >
                        Terapkan
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(preset)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPreset ? 'Edit Preset' : 'Simpan Preset'}
              </DialogTitle>
              <DialogDescription>
                {editingPreset ? 'Perbarui filter preset yang ada' : 'Simpan filter aktif sebagai preset untuk digunakan kembali'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Preset</Label>
                <Input
                  id="name"
                  placeholder="Masukkan nama preset"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Deskripsi</Label>
                <Input
                  id="description"
                  placeholder="Deskripsi preset (opsional)"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={editingPreset ? handleUpdatePreset : handleSavePreset}>
                {editingPreset ? 'Perbarui' : 'Simpan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
