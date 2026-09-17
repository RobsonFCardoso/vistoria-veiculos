import { useState, useEffect, useCallback } from 'react';
import { Registro, RegistroFormData, ActiveView } from './types';
import { fetchRegistros, fetchRegistroById, createRegistro, updateRegistro, deleteRegistro } from './services/api';
import { DashboardView } from './components/DashboardView';
import { RegistroFormView } from './components/RegistroFormView';
import { RegistroDetailView } from './components/RegistroDetailView';
import { savePhotoToMobileDownload } from './utils/mobileStorage';
import { Car, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'dashboard' });
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active record state for Edit and View screens
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRegistros();
      setRegistros(data);
    } catch (err: any) {
      console.error('Erro ao carregar registros:', err);
      setError(err.message || 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate to View screen for a specific record
  const handleSelectRegistro = async (id: string) => {
    try {
      setLoading(true);
      const reg = await fetchRegistroById(id);
      setSelectedRegistro(reg);
      setActiveView({ type: 'view', id });
    } catch (err: any) {
      alert('Erro ao abrir registro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to Edit screen
  const handleEditRegistro = (id: string) => {
    const reg = registros.find(r => r.id === id) || selectedRegistro;
    if (reg) {
      setSelectedRegistro(reg);
      setActiveView({ type: 'edit', id });
    }
  };

  // Handle Save (Create or Edit)
  const handleSaveForm = async (formData: RegistroFormData) => {
    if (activeView.type === 'edit') {
      const updated = await updateRegistro(activeView.id, formData);
      // If new photos were captured, save them in the phone's Download folder too
      if (formData.foto1Base64) {
        savePhotoToMobileDownload(updated.id, updated.placa, 1, formData.foto1Base64).catch(() => {});
      }
      if (formData.foto2Base64) {
        savePhotoToMobileDownload(updated.id, updated.placa, 2, formData.foto2Base64).catch(() => {});
      }
      showToast(`Registro da placa ${updated.placa} atualizado com sucesso!`);
      await loadData();
      setSelectedRegistro(updated);
      setActiveView({ type: 'view', id: updated.id });
    } else {
      const created = await createRegistro(formData);
      // Save created photos in phone's Download folder
      if (formData.foto1Base64) {
        savePhotoToMobileDownload(created.id, created.placa, 1, formData.foto1Base64).catch(() => {});
      }
      if (formData.foto2Base64) {
        savePhotoToMobileDownload(created.id, created.placa, 2, formData.foto2Base64).catch(() => {});
      }
      showToast(`Novo registro criado com sucesso para a placa ${created.placa}!`);
      await loadData();
      setSelectedRegistro(created);
      setActiveView({ type: 'view', id: created.id });
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    await deleteRegistro(id);
    showToast(`Registro #${id} excluído com sucesso do CSV.`);
    await loadData();
    setActiveView({ type: 'dashboard' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Global Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => setActiveView({ type: 'dashboard' })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 group-hover:scale-105 transition">
              <Car className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                  Vistorias & Registros
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 hidden sm:inline-block">
                  CSV Integrado
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Inspeção Veicular • Registros.csv
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {activeView.type !== 'create' && (
              <button
                onClick={() => {
                  setSelectedRegistro(null);
                  setActiveView({ type: 'create' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <span>+ Novo Registro</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 border border-slate-800 text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {activeView.type === 'dashboard' && (
          <DashboardView
            registros={registros}
            loading={loading}
            onRefresh={loadData}
            onCreateNew={() => {
              setSelectedRegistro(null);
              setActiveView({ type: 'create' });
            }}
            onSelectRegistro={handleSelectRegistro}
          />
        )}

        {/* Create or Edit View */}
        {(activeView.type === 'create' || activeView.type === 'edit') && (
          <RegistroFormView
            initialData={activeView.type === 'edit' ? selectedRegistro : null}
            onSave={handleSaveForm}
            onCancel={() => {
              if (activeView.type === 'edit' && selectedRegistro) {
                setActiveView({ type: 'view', id: selectedRegistro.id });
              } else {
                setActiveView({ type: 'dashboard' });
              }
            }}
          />
        )}

        {/* View / Detail Screen */}
        {activeView.type === 'view' && selectedRegistro && (
          <RegistroDetailView
            registro={selectedRegistro}
            onBack={() => setActiveView({ type: 'dashboard' })}
            onEdit={() => handleEditRegistro(selectedRegistro.id)}
            onDelete={() => handleDelete(selectedRegistro.id)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/60 py-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistema de Vistorias e Registros Veiculares</span>
          <span className="font-mono text-slate-400 text-[11px]">
            Registros.csv (delimitador ;) • RegistroFotos/(ID_PLACA)
          </span>
        </div>
      </footer>
    </div>
  );
}
