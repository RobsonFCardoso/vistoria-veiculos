import { useState } from 'react';
import { Registro } from '../types';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';
import {
  savePhotoToMobileDownload,
  getNativePhotoUri,
  getPhotoFileName,
  isNativeMobile,
  getPhotoDataUrl,
} from '../services/registroStorage';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { Share } from '@capacitor/share';
import { 
  ArrowLeft, 
  Edit3, 
  Trash2, 
  FileText, 
  Share2, 
  Calendar, 
  Clock, 
  Folder, 
  CheckCircle2, 
  XCircle, 
  Download, 
  ZoomIn, 
  X, 
  AlertTriangle,
  Shield,
  Smartphone
} from 'lucide-react';

interface RegistroDetailViewProps {
  registro: Registro;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

export function RegistroDetailView({ registro, onBack, onEdit, onDelete }: RegistroDetailViewProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [sharingPhotosOnly, setSharingPhotosOnly] = useState(false);
  const [savingDownload, setSavingDownload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeZoomPhoto, setActiveZoomPhoto] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const isAprovado = registro.status === 'APROVADO';

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      const { doc, fileName } = await generateVehicleReportPDF(registro);
      doc.save(fileName);
      setNotification(`Relatório "${fileName}" gerado e baixado com sucesso!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  /**
   * 1. Função "Compartilhar no WhatsApp" (Texto + Imagens):
   * Envia o texto completo do relatório de vistoria juntamente com os arquivos de imagem das fotos.
   */
  const handleShareWhatsApp = async () => {
    try {
      setSharingWhatsApp(true);

      const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanId = String(registro.id).trim();
      const foto1FileName = getPhotoFileName(cleanId, 1);
      const foto2FileName = getPhotoFileName(cleanId, 2);
      const relativeFolder = `Download/RegistroFoto/${cleanPlaca}/`;

      const icon = registro.status === 'APROVADO' ? '✅' : '❌';
      const blitzText = registro.nomeBlitz ? `🛡️ *Nome Blitz:* ${registro.nomeBlitz}\n` : '';

      const textoRelatorioCompleto = 
`🚗 *RELATÓRIO DE VISTORIA VEICULAR*
━━━━━━━━━━━━━━━━━━━━
📋 *ID do Registro:* #${cleanId}
${blitzText}🚙 *Placa:* ${cleanPlaca}
📅 *Data:* ${registro.dia}
⏰ *Hora:* ${registro.hora || '--:--'}
${icon} *Status:* *${registro.status}*
━━━━━━━━━━━━━━━━━━━━
📸 *FOTOS SALVAS NO CELULAR:*
• *Foto 1:* ${foto1FileName} salva na pasta ${relativeFolder}
• *Foto 2:* ${foto2FileName} salva na pasta ${relativeFolder}
━━━━━━━━━━━━━━━━━━━━
_Emitido via Sistema de Vistorias e Registros._`;

      // Garante que os caminhos das fotos sejam convertidos para URIs nativas usando Filesystem.getUri()
      const [uriFoto1, uriFoto2] = await Promise.all([
        getNativePhotoUri(registro, 1),
        getNativePhotoUri(registro, 2),
      ]);

      const filesToShare = [uriFoto1, uriFoto2].filter(Boolean);

      await Share.share({
        title: 'Vistoria Veicular',
        text: textoRelatorioCompleto, // Texto do relatório com os dados do veículo
        files: filesToShare,          // Array de URIs obtidas via Filesystem.getUri()
      });

      setNotification('Compartilhamento iniciado com sucesso!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      if (err?.message && (err.message.includes('canceled') || err.message.includes('cancelled') || err.name === 'AbortError')) {
        return; // Usuário cancelou o diálogo de compartilhamento
      }
      console.warn('Share.share WhatsApp error:', err);
      // Fallback para navegador web (WhatsApp Web) caso não seja dispositivo nativo
      if (!isNativeMobile()) {
        const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanId = String(registro.id).trim();
        const icon = registro.status === 'APROVADO' ? '✅' : '❌';
        const blitzText = registro.nomeBlitz ? `🛡️ *Nome Blitz:* ${registro.nomeBlitz}\n` : '';
        const fallbackText = `🚗 *RELATÓRIO DE VISTORIA VEICULAR*\n📋 *ID:* #${cleanId}\n${blitzText}🚙 *Placa:* ${cleanPlaca}\n📅 *Data:* ${registro.dia}\n⏰ *Hora:* ${registro.hora || '--:--'}\n${icon} *Status:* *${registro.status}*`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackText)}`, '_blank');
        return;
      }
      alert('Erro ao compartilhar: ' + (err.message || 'Falha no compartilhamento'));
    } finally {
      setSharingWhatsApp(false);
    }
  };

  /**
   * 2. Função "Enviar Fotos no WhatsApp" (Apenas Imagens):
   * Envia exclusivamente os arquivos de imagem das fotos, sem incluir nenhuma mensagem de texto.
   */
  const handleSharePhotosOnly = async () => {
    try {
      setSharingPhotosOnly(true);

      // Garante que os caminhos das fotos sejam convertidos para URIs nativas usando Filesystem.getUri()
      const [uriFoto1, uriFoto2] = await Promise.all([
        getNativePhotoUri(registro, 1),
        getNativePhotoUri(registro, 2),
      ]);

      const filesToShare = [uriFoto1, uriFoto2].filter(Boolean);

      if (filesToShare.length === 0) {
        alert('Nenhuma foto encontrada para compartilhar.');
        return;
      }

      await Share.share({
        title: 'Fotos da Vistoria',
        files: filesToShare, // Apenas as URIs das imagens, omitindo o parâmetro 'text'
      });

      setNotification('Compartilhamento das fotos iniciado!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      if (err?.message && (err.message.includes('canceled') || err.message.includes('cancelled') || err.name === 'AbortError')) {
        return; // Usuário cancelou
      }
      console.warn('Share.share Photos Only error:', err);
      if (!isNativeMobile()) {
        alert('O compartilhamento direto de fotos via @capacitor/share é ativado no dispositivo Android.');
        return;
      }
      alert('Erro ao enviar fotos: ' + (err.message || 'Falha no compartilhamento'));
    } finally {
      setSharingPhotosOnly(false);
    }
  };

  const foto1Url = resolvePhotoSrc(registro.foto1);
  const foto2Url = resolvePhotoSrc(registro.foto2);

  const handleSaveToPhoneDownload = async () => {
    try {
      setSavingDownload(true);
      const foto1 = await getPhotoDataUrl(registro.foto1);
      const foto2 = await getPhotoDataUrl(registro.foto2);
      if (!foto1 || !foto2) throw new Error('As duas fotos precisam estar disponíveis.');

      await savePhotoToMobileDownload(registro.id, registro.placa, 1, foto1);
      await savePhotoToMobileDownload(registro.id, registro.placa, 2, foto2);
      setNotification(`Fotos salvas em Download/RegistroFoto/${registro.placa}/`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      alert('Erro ao salvar na pasta Download: ' + err.message);
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await onDelete();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 text-xs sm:text-sm font-semibold border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs sm:text-sm font-semibold self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </button>

        {/* Primary Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Botão "Editar" */}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Editar</span>
          </button>

          {/* Botão "Excluir" */}
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Excluir</span>
          </button>

          {/* Botão "Gerar Relatório em PDF" */}
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {generatingPdf ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-emerald-400" />
            )}
            <span>Gerar Relatório PDF</span>
          </button>

          {/* Botão "Enviar/Compartilhar via WhatsApp com Fotos" */}
          <button
            onClick={handleShareWhatsApp}
            disabled={sharingWhatsApp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-60"
            title="Compartilha os dados da vistoria e anexa as fotos 1 e 2 no WhatsApp"
          >
            {sharingWhatsApp ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span>{sharingWhatsApp ? 'Preparando Fotos...' : 'Compartilhar no WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* Vehicle Overview Header Card */}
      <div className={`p-6 rounded-2xl border bg-white shadow-xs ${
        isAprovado ? 'border-emerald-200' : 'border-rose-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Brazilian Plate */}
            <VehiclePlateBadge placa={registro.placa} size="lg" />

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Registro #{registro.id}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-500 font-mono">
                  Registros.csv
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Vistoria Veicular - {registro.placa}
              </h1>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm sm:text-base font-extrabold tracking-wide uppercase self-start sm:self-auto shadow-xs ${
            isAprovado 
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}>
            {isAprovado ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-700" />
            )}
            <span>STATUS: {registro.status}</span>
          </div>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
            <Shield className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nome Blitz</span>
            <span className="text-base font-extrabold text-slate-900 truncate block">
              {registro.nomeBlitz || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Data (DIA)</span>
            <span className="text-base font-extrabold text-slate-900 block">{registro.dia}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Horário (HORA)</span>
            <span className="text-base font-extrabold text-slate-900 block">{registro.hora}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
            <Folder className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pasta no Celular (Download)</span>
            <span className="text-xs font-mono font-bold text-slate-800 truncate block">
              {`Download/RegistroFoto/${registro.placa}/`}
            </span>
          </div>
        </div>
      </div>

      {/* Photos Section: FOTO1 e FOTO2 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Galeria de Fotos da Vistoria
            </h2>
            <p className="text-xs text-slate-500">
              Fotos salvas no padrão rigoroso <span className="font-mono text-slate-700">({registro.id}_{registro.placa})_fotoX.jpg</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveToPhoneDownload}
              disabled={savingDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Salvar fotos na subpasta Download/RegistroFoto/ deste veículo no celular"
            >
              {savingDownload ? (
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Salvar na Pasta Download</span>
            </button>

            <button
              onClick={handleSharePhotosOnly}
              disabled={sharingPhotosOnly}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Enviar exclusivamente os arquivos de imagem das fotos (sem texto)"
            >
              {sharingPhotosOnly ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{sharingPhotosOnly ? 'Preparando...' : 'Enviar Fotos no WhatsApp'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Photo 1 Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Foto 1 (Principal)
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-400">
                  ({registro.id}_{registro.placa})_foto1.jpg
                </span>
                <a
                  href={foto1Url}
                  download={`ID${registro.id}_foto1.jpg`}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  title="Baixar Foto 1"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div
              onClick={() => setActiveZoomPhoto(foto1Url)}
              className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-xs"
            >
              <img
                src={foto1Url}
                alt="Foto 1 da Vistoria"
                className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f1f5f9"/><text x="200" y="150" font-size="16" text-anchor="middle" fill="%2394a3b8">Foto 1</text></svg>';
                }}
              />
              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                <ZoomIn className="w-5 h-5" />
                <span>Ampliar Foto</span>
              </div>
            </div>
          </div>

          {/* Photo 2 Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Foto 2 (Detalhe / Avaria)
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-400">
                  ({registro.id}_{registro.placa})_foto2.jpg
                </span>
                <a
                  href={foto2Url}
                  download={`ID${registro.id}_foto2.jpg`}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  title="Baixar Foto 2"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div
              onClick={() => setActiveZoomPhoto(foto2Url)}
              className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-xs"
            >
              <img
                src={foto2Url}
                alt="Foto 2 da Vistoria"
                className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f1f5f9"/><text x="200" y="150" font-size="16" text-anchor="middle" fill="%2394a3b8">Foto 2</text></svg>';
                }}
              />
              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                <ZoomIn className="w-5 h-5" />
                <span>Ampliar Foto</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {activeZoomPhoto && (
        <div
          onClick={() => setActiveZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm p-4 flex items-center justify-center cursor-zoom-out"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setActiveZoomPhoto(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition"
              title="Fechar"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={activeZoomPhoto}
              alt="Foto Ampliada"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Confirmar Exclusão de Registro?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Tem certeza que deseja excluir o registro do veículo com placa <span className="font-mono font-bold text-slate-900">{registro.placa}</span> (ID #{registro.id})? Esta alteração será refletida no arquivo <span className="font-mono">Registros.csv</span>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
