import React, { useState, useEffect, FormEvent } from 'react';
import { Registro, RegistroFormData, RegistroStatus } from '../types';
import { CameraCaptureModal } from './CameraCaptureModal';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { ArrowLeft, Camera, Check, Clock, Calendar, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, Shield } from 'lucide-react';
import { resolvePhotoSrc } from '../utils/photoUrl';

interface RegistroFormViewProps {
  initialData?: Registro | null;
  onSave: (data: RegistroFormData) => Promise<void>;
  onCancel: () => void;
}

export function RegistroFormView({ initialData, onSave, onCancel }: RegistroFormViewProps) {
  const isEditing = !!initialData;

  // Helpers for current date & time
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [nomeBlitz, setNomeBlitz] = useState(initialData?.nomeBlitz || '');
  const [dia, setDia] = useState(initialData?.dia || getTodayDate());
  const [hora, setHora] = useState(initialData?.hora || getCurrentTime());
  const [placa, setPlaca] = useState(initialData?.placa || '');
  const [status, setStatus] = useState<RegistroStatus>(initialData?.status || 'APROVADO');

  // Photo states
  const [foto1Base64, setFoto1Base64] = useState<string | undefined>(undefined);
  const [foto2Base64, setFoto2Base64] = useState<string | undefined>(undefined);
  const [foto1Preview, setFoto1Preview] = useState<string | undefined>(initialData?.foto1);
  const [foto2Preview, setFoto2Preview] = useState<string | undefined>(initialData?.foto2);

  // Active camera modal state
  const [cameraTarget, setCameraTarget] = useState<1 | 2 | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto uppercase plate
  const handlePlacaChange = (val: string) => {
    // Keep letters and numbers, max 8 chars
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
    setPlaca(cleaned);
  };

  const handlePhotoCaptured = (base64: string) => {
    if (cameraTarget === 1) {
      setFoto1Base64(base64);
      setFoto1Preview(base64);
    } else if (cameraTarget === 2) {
      setFoto2Base64(base64);
      setFoto2Preview(base64);
    }
    setCameraTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanPlaca || cleanPlaca.length < 5) {
      setErrorMessage('Por favor, informe uma placa válida (mínimo 5 caracteres alfanuméricos).');
      return;
    }

    if (!dia || !hora) {
      setErrorMessage('Data e hora são obrigatórias.');
      return;
    }

    if (!foto1Preview || !foto2Preview) {
      setErrorMessage('As duas fotos são obrigatórias para concluir o registro.');
      return;
    }

    try {
      setSubmitting(true);
      await onSave({
        nomeBlitz: nomeBlitz.trim(),
        dia,
        hora,
        placa: cleanPlaca,
        status,
        foto1Base64,
        foto2Base64,
        foto1Existing: initialData?.foto1,
        foto2Existing: initialData?.foto2
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao salvar o registro.');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
          {isEditing ? `Editando ID #${initialData?.id}` : 'Novo Cadastro'}
        </span>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isEditing ? 'Editar Registro de Vistoria' : 'Criar Novo Registro'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Preencha os dados do veículo e capture as fotos obrigatórias em tempo real através da câmera.
          </p>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção ao preencher:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Selection: Segmented Control APROVADO / REPROVADO */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Resultado da Vistoria (STATUS) *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('APROVADO')}
                className={`py-3.5 px-4 rounded-xl border-2 flex items-center justify-center gap-2.5 font-bold text-sm transition cursor-pointer ${
                  status === 'APROVADO'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className={`w-5 h-5 ${status === 'APROVADO' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>APROVADO</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('REPROVADO')}
                className={`py-3.5 px-4 rounded-xl border-2 flex items-center justify-center gap-2.5 font-bold text-sm transition cursor-pointer ${
                  status === 'REPROVADO'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className={`w-5 h-5 ${status === 'REPROVADO' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>REPROVADO</span>
              </button>
            </div>
          </div>

          {/* Campo: NOME DA BLITZ (Posicionado antes de PLACA DO VEÍCULO) */}
          <div className="space-y-2">
            <label htmlFor="nome-blitz-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Nome da Blitz
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="nome-blitz-input"
                type="text"
                placeholder="Ex: Operação Lei Seca, Blitz Central, Ponto 01..."
                value={nomeBlitz}
                onChange={(e) => setNomeBlitz(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-400">Identificação da operação fiscalizatória ou ponto da blitz.</p>
          </div>

          {/* Vehicle License Plate (PLACA) */}
          <div className="space-y-2">
            <label htmlFor="placa-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Placa do Veículo *
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <input
                  id="placa-input"
                  type="text"
                  required
                  placeholder="Ex: ABC1D23 ou ABC1234"
                  value={placa}
                  onChange={(e) => handlePlacaChange(e.target.value)}
                  maxLength={8}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-mono font-bold tracking-wider text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              {/* Real-time Brazilian Plate Preview */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Visualização:</span>
                <VehiclePlateBadge placa={placa || 'PLACA'} size="md" />
              </div>
            </div>
          </div>

          {/* DIA and HORA fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="dia-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Data (DIA) *
                </label>
                <button
                  type="button"
                  onClick={() => setDia(getTodayDate())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Hoje
                </button>
              </div>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="dia-input"
                  type="date"
                  required
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="hora-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Hora *
                </label>
                <button
                  type="button"
                  onClick={() => setHora(getCurrentTime())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Agora
                </button>
              </div>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hora-input"
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Photos (FOTO1 e FOTO2) - Trigger mobile camera */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Captura de Fotos (FOTO 1 e FOTO 2) *
                </label>
                <p className="text-xs text-slate-500">
                  Ao clicar em cada campo, a câmera do dispositivo é acionada em tempo real.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">RegistroFoto/</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo 1 Trigger Card */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <span>Foto 1 (Ex: Frente / Ângulo Principal)</span>
                  {foto1Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </span>

                <div
                  onClick={() => setCameraTarget(1)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-4 text-center transition-all ${
                    foto1Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto1Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto1Preview)}
                        alt="Foto 1 Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Foto 1 Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Acionar Câmera para Foto 1
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar ao vivo
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo 2 Trigger Card */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <span>Foto 2 (Ex: Traseira / Avaria / Detalhe)</span>
                  {foto2Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </span>

                <div
                  onClick={() => setCameraTarget(2)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-4 text-center transition-all ${
                    foto2Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto2Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto2Preview)}
                        alt="Foto 2 Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Foto 2 Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Acionar Câmera para Foto 2
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar ao vivo
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="py-3 px-5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando no CSV e Gravando Fotos...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Concluir e Salvar Registro'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      {cameraTarget !== null && (
        <CameraCaptureModal
          title={`Capturar ${cameraTarget === 1 ? 'Foto 1 (Principal)' : 'Foto 2 (Detalhe)'}`}
          onCapture={handlePhotoCaptured}
          onClose={() => setCameraTarget(null)}
        />
      )}
    </div>
  );
}
