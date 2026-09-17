import React, { useState, useMemo } from 'react';
import { Registro } from '../types';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { FolderExplorerModal } from './FolderExplorerModal';
import { Plus, CheckCircle2, XCircle, Search, FileSpreadsheet, Calendar, Clock, RefreshCw, Car, FolderOpen, Smartphone } from 'lucide-react';
import { getExportCsvContent, isNativeMobile } from '../services/androidStorage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface DashboardViewProps {
  registros: Registro[];
  loading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  onSelectRegistro: (id: string) => void;
}

export function DashboardView({
  registros,
  loading,
  onRefresh,
  onCreateNew,
  onSelectRegistro
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APROVADO' | 'REPROVADO'>('ALL');
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const csvContent = await getExportCsvContent();

      // No Android nativo, garante que é salvo em Download/Registros.csv
      if (isNativeMobile()) {
        try {
          await Filesystem.writeFile({
            path: 'Download/Registros.csv',
            data: csvContent,
            directory: Directory.ExternalStorage,
            encoding: Encoding.UTF8,
            recursive: true
          });
        } catch (fsErr) {
          console.warn('Erro ao salvar no ExternalStorage Download/Registros.csv:', fsErr);
        }
      }

      // Dispara download via Blob no navegador / WebView
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Registros.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erro ao exportar CSV: ' + err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  // Filter records
  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      const matchesSearch =
        r.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.includes(searchTerm) ||
        r.dia.includes(searchTerm) ||
        (r.nomeBlitz && r.nomeBlitz.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [registros, searchTerm, statusFilter]);

  const aprovados = useMemo(() => {
    return filteredRegistros.filter(r => r.status === 'APROVADO');
  }, [filteredRegistros]);

  const reprovados = useMemo(() => {
    return filteredRegistros.filter(r => r.status === 'REPROVADO');
  }, [filteredRegistros]);

  const totalAprovadosCount = useMemo(() => registros.filter(r => r.status === 'APROVADO').length, [registros]);
  const totalReprovadosCount = useMemo(() => registros.filter(r => r.status === 'REPROVADO').length, [registros]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase">
            <Car className="w-4 h-4" />
            <span>Controle de Vistorias Veiculares</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Painel de Registros
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs sm:text-sm text-slate-500">
              Armazenamento em <span className="font-mono font-medium text-slate-700">Registros.csv</span> e fotos em <span className="font-mono font-medium text-slate-700">RegistroFotos/</span>
            </p>
            {/* Botão para acessar a pasta onde estão sendo salvas as fotos */}
            <button
              id="btn-acessar-pasta-fotos"
              onClick={() => setShowFolderExplorer(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 text-xs font-bold border border-indigo-200/80 transition cursor-pointer shadow-2xs"
              title="Acessar a pasta onde estão sendo salvas as fotos e salvar na pasta Download do celular"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Acessar Pasta de Fotos</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowFolderExplorer(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-700 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer"
            title="Abrir explorador de fotos e salvar na pasta Download do celular"
          >
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>Pasta de Fotos</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Exportar arquivo Registros.csv para o aparelho"
          >
            {exportingCsv ? (
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            )}
            <span>{exportingCsv ? 'Exportando...' : 'Baixar CSV'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Destaque: Botão "Criar novo Registro" */}
          <button
            id="btn-criar-novo-registro"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold tracking-tight shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Criar novo Registro</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'ALL'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Geral</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block">{registros.length}</span>
        </div>

        <div
          onClick={() => setStatusFilter('APROVADO')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'APROVADO'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider">Aprovados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1 block">{totalAprovadosCount}</span>
        </div>

        <div
          onClick={() => setStatusFilter('REPROVADO')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'REPROVADO'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-700 uppercase tracking-wider">Reprovados</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-800 mt-1 block">{totalReprovadosCount}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por placa, ID ou data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Segmented Filter Control */}
        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl self-start sm:self-auto text-xs font-semibold text-slate-600">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Todos ({registros.length})
          </button>
          <button
            onClick={() => setStatusFilter('APROVADO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              statusFilter === 'APROVADO' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Aprovados ({totalAprovadosCount})
          </button>
          <button
            onClick={() => setStatusFilter('REPROVADO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              statusFilter === 'REPROVADO' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'hover:text-rose-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Reprovados ({totalReprovadosCount})
          </button>
        </div>
      </div>

      {/* Main Categories Section: Duas Categorias Visuais Bem Claras (APROVADO / REPROVADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category: APROVADO */}
        {(statusFilter === 'ALL' || statusFilter === 'APROVADO') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <h2 className="font-bold text-sm sm:text-base tracking-wide uppercase">
                  Veículos Aprovados
                </h2>
              </div>
              <span className="bg-emerald-800/80 text-emerald-100 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-600">
                {aprovados.length} {aprovados.length === 1 ? 'veículo' : 'veículos'}
              </span>
            </div>

            {aprovados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-emerald-200 p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm font-medium text-slate-500">Nenhum veículo aprovado encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {aprovados.map((item) => (
                  <RegistroCard
                    key={item.id}
                    registro={item}
                    onSelect={() => onSelectRegistro(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category: REPROVADO */}
        {(statusFilter === 'ALL' || statusFilter === 'REPROVADO') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-rose-700 text-white px-4 py-3 rounded-xl shadow-xs">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-200" />
                <h2 className="font-bold text-sm sm:text-base tracking-wide uppercase">
                  Veículos Reprovados
                </h2>
              </div>
              <span className="bg-rose-800/80 text-rose-100 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-600">
                {reprovados.length} {reprovados.length === 1 ? 'veículo' : 'veículos'}
              </span>
            </div>

            {reprovados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-rose-200 p-8 text-center text-slate-400">
                <XCircle className="w-8 h-8 text-rose-300 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm font-medium text-slate-500">Nenhum veículo reprovado encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {reprovados.map((item) => (
                  <RegistroCard
                    key={item.id}
                    registro={item}
                    onSelect={() => onSelectRegistro(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Explorador da Pasta de Fotos */}
      <FolderExplorerModal
        isOpen={showFolderExplorer}
        onClose={() => setShowFolderExplorer(false)}
        registros={registros}
      />
    </div>
  );
}

interface RegistroCardProps {
  key?: string;
  registro: Registro;
  onSelect: () => void;
}

function RegistroCard({ registro, onSelect }: RegistroCardProps) {
  const isAprovado = registro.status === 'APROVADO';

  return (
    <div
      onClick={onSelect}
      className={`group bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99] flex items-center justify-between gap-4 ${
        isAprovado
          ? 'border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50/20'
          : 'border-rose-100 hover:border-rose-400 hover:bg-rose-50/20'
      }`}
    >
      <div className="flex items-center gap-3.5">
        {/* Clickable Brazilian Plate */}
        <VehiclePlateBadge placa={registro.placa} size="md" />

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              ID #{registro.id}
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isAprovado
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {registro.status}
            </span>
            {registro.nomeBlitz && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full truncate max-w-[130px] sm:max-w-[200px]" title={registro.nomeBlitz}>
                {registro.nomeBlitz}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {registro.dia}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {registro.hora}
            </span>
          </div>
        </div>
      </div>

      {/* Mini Thumbnails */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
          <img
            src={registro.foto1.startsWith('/') ? registro.foto1 : `/${registro.foto1}`}
            alt="Foto 1"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={(e) => {
              // Fallback
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23e2e8f0"/><text x="20" y="24" font-size="10" text-anchor="middle" fill="%2394a3b8">F1</text></svg>';
            }}
          />
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
          <img
            src={registro.foto2.startsWith('/') ? registro.foto2 : `/${registro.foto2}`}
            alt="Foto 2"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={(e) => {
              // Fallback
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23e2e8f0"/><text x="20" y="24" font-size="10" text-anchor="middle" fill="%2394a3b8">F2</text></svg>';
            }}
          />
        </div>
      </div>
    </div>
  );
}
