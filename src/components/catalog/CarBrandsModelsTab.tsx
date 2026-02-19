import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Car, Loader2, Check, X, Pencil, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImportCarBrandsDialog } from './ImportCarBrandsDialog';
import { logEventDirect } from '@/hooks/useEventLog';

interface CarBrandModel {
  id: string;
  brand: string;
  model: string | null;
  created_at: string;
}

export function CarBrandsModelsTab({ canManage = true }: { canManage?: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<CarBrandModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModelValue, setEditingModelValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const newBrandRef = useRef<HTMLInputElement>(null);
  const newModelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('car_brands_models')
        .select('*')
        .order('brand')
        .order('model');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading car brands:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const brands = useMemo(() => {
    const set = new Set(items.map(i => i.brand));
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [items]);

  const modelsForBrand = useMemo(() => {
    if (!selectedBrand) return [];
    return items.filter(i => i.brand === selectedBrand && i.model);
  }, [items, selectedBrand]);

  // --- Brand actions ---
  const addBrand = async () => {
    const name = newBrand.trim();
    if (!name) return;
    if (brands.includes(name)) {
      toast({ title: 'Такая марка уже есть', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('car_brands_models')
        .insert({ brand: name, model: null });
      if (error) throw error;
      toast({ title: `Марка «${name}» добавлена` });
      logEventDirect({ action: 'create', category: 'service', entityType: 'car_brand', fieldAccessed: `Новая марка: ${name}` });
      setNewBrand('');
      setSelectedBrand(name);
      loadData();
    } catch {
      toast({ title: 'Ошибка добавления', variant: 'destructive' });
    }
  };

  const deleteBrand = async (brand: string) => {
    try {
      const { error } = await supabase
        .from('car_brands_models')
        .delete()
        .eq('brand', brand);
      if (error) throw error;
      toast({ title: `Марка «${brand}» удалена` });
      logEventDirect({ action: 'delete', category: 'service', entityType: 'car_brand', fieldAccessed: `Удаление марки: ${brand}` });
      if (selectedBrand === brand) setSelectedBrand(null);
      loadData();
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  // --- Model actions ---
  const addModel = async () => {
    const name = newModel.trim();
    if (!name || !selectedBrand) return;
    const exists = modelsForBrand.some(m => m.model?.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast({ title: 'Такая модель уже есть', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('car_brands_models')
        .insert({ brand: selectedBrand, model: name });
      if (error) throw error;
      toast({ title: `Модель «${name}» добавлена` });
      logEventDirect({ action: 'create', category: 'service', entityType: 'car_model', fieldAccessed: `Модель: ${selectedBrand} ${name}` });
      setNewModel('');
      loadData();
    } catch {
      toast({ title: 'Ошибка добавления', variant: 'destructive' });
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const { error } = await supabase.from('car_brands_models').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Модель удалена' });
      logEventDirect({ action: 'delete', category: 'service', entityType: 'car_model', entityId: id, fieldAccessed: 'Удаление модели' });
      loadData();
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const startEditModel = (item: CarBrandModel) => {
    setEditingModelId(item.id);
    setEditingModelValue(item.model || '');
  };

  const saveEditModel = async () => {
    if (!editingModelId) return;
    const name = editingModelValue.trim();
    if (!name) { setEditingModelId(null); return; }
    try {
      const { error } = await supabase
        .from('car_brands_models')
        .update({ model: name })
        .eq('id', editingModelId);
      if (error) throw error;
      toast({ title: 'Модель обновлена' });
      logEventDirect({ action: 'update', category: 'service', entityType: 'car_model', entityId: editingModelId, fieldAccessed: `Переименование модели: ${name}` });
      setEditingModelId(null);
      loadData();
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Left panel — Brands */}
      <div className="w-[30%] min-w-[220px] flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <Car className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm">Марки</h3>
          <span className="text-xs text-muted-foreground">({brands.length})</span>
          {canManage && (
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs gap-1" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Импорт
            </Button>
          )}
        </div>

        {canManage && (
          <div className="p-2 border-b">
            <form
              onSubmit={(e) => { e.preventDefault(); addBrand(); }}
              className="flex gap-1"
            >
              <Input
                ref={newBrandRef}
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Новая марка…"
                className="h-8 text-sm"
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={!newBrand.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-1">
            {brands.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Нет марок</p>
            ) : (
              brands.map((brand) => (
                <div
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={cn(
                    'group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
                    selectedBrand === brand
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted'
                  )}
                >
                  <span className="truncate">{brand}</span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteBrand(brand); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel — Models */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">
            {selectedBrand ? `Модели — ${selectedBrand}` : 'Модели'}
          </h3>
        </div>

        {!selectedBrand ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            ← Выберите марку слева
          </div>
        ) : (
          <>
            {canManage && (
              <div className="p-2 border-b">
                <form
                  onSubmit={(e) => { e.preventDefault(); addModel(); }}
                  className="flex gap-1"
                >
                  <Input
                    ref={newModelRef}
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder={`Новая модель для ${selectedBrand}…`}
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={!newModel.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-2">
                {modelsForBrand.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Нет моделей. Добавьте первую выше.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                    {modelsForBrand.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted text-sm transition-colors"
                      >
                        {editingModelId === item.id ? (
                          <form
                            onSubmit={(e) => { e.preventDefault(); saveEditModel(); }}
                            className="flex items-center gap-1 flex-1"
                          >
                            <Input
                              autoFocus
                              value={editingModelValue}
                              onChange={(e) => setEditingModelValue(e.target.value)}
                              className="h-7 text-sm flex-1"
                              onBlur={saveEditModel}
                              onKeyDown={(e) => { if (e.key === 'Escape') setEditingModelId(null); }}
                            />
                            <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                              <Check className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingModelId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        ) : (
                          <>
                            <span className="flex-1 truncate">{item.model}</span>
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                  onClick={() => startEditModel(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                                  onClick={() => deleteModel(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      <ImportCarBrandsDialog open={importOpen} onOpenChange={setImportOpen} onComplete={loadData} />
    </div>
  );
}
