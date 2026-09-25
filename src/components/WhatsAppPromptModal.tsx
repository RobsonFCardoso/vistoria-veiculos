import React, { useState } from 'react';
import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { savePhotoToMobileDownload } from '../utils/mobileStorage';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Folder, 
  Download, 
  MessageCircle, 
  Image as ImageIcon,
  CheckCircle2,
  FileCheck
} from 'lucide-react';

interface WhatsAppPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  registro: Registro | null;
  reportText: string;
}

export function WhatsAppPromptModal({
  isOpen,
  onClose,
  registro,
  reportText,
}: WhatsAppPromptModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  if (!isOpen || !registro) return null;

  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const folderPath = `Download/RegistroFotos/${folderTag}/`;

  const foto1FileName = `${folderTag}_foto1.jpg`;
  const foto2FileName = `${folderTag}_foto2.jpg`;
  const foto3FileName = `${folderTag}_foto3.jpg`;
  const foto4FileName = `${folderTag}_foto4.jpg`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback manual copy
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleReopenWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(url, '_blank');
  };

  const handleDownloadAllPhotos = async () => {
    try {
      setDownloading(true);
      const downloadSingle = (url: string, name: string) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      if (registro.foto1) {
        downloadSingle(resolvePhotoSrc(registro.foto1), foto1FileName);
      }
      if (registro.foto2) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto2), foto2FileName), 200);
      }
      if (registro.foto3) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto3), foto3FileName), 400);
      }
      if (registro.foto4) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto4), foto4FileName), 600);
      }

      setDownloadMsg('Fotos baixadas para a pasta de downloads do aparelho!');
      setTimeout(() => setDownloadMsg(null), 4000);
    } catch (err: any) {
      alert('Erro ao baixar fotos: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Envio via WhatsApp
              </h2>
              <p className="text-xs text-slate-500">
                Vistoria #{registro.id} — Placa {cleanPlaca}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Status Alert */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-xs sm:text-sm">
                O WhatsApp foi aberto com o texto do relatório!
              </p>
              <p className="text-xs text-emerald-800">
                Para anexar as fotos salvas, basta seguir as instruções abaixo na conversa aberta.
              </p>
            </div>
          </div>

          {downloadMsg && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-600" />
              <span>{downloadMsg}</span>
            </div>
          )}

          {/* Passo a Passo de Anexo */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Como anexar as fotos na conversa:
            </h3>
            <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside">
              <li>
                Na conversa do WhatsApp, toque no ícone de <strong>anexo (📎)</strong> e escolha <strong>Galeria</strong> ou <strong>Arquivos</strong>.
              </li>
              <li>
                Acesse a pasta de fotos do registro salva no aparelho:
                <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] font-bold text-slate-800 flex items-center gap-1.5 break-all">
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{folderPath}</span>
                </div>
              </li>
              <li>
                Selecione as fotos correspondentes e envie junto com o texto do relatório.
              </li>
            </ol>
          </div>

          {/* Lista de Fotos Disponíveis */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Arquivos de Fotos Disponíveis</span>
              <button
                type="button"
                onClick={handleDownloadAllPhotos}
                disabled={downloading}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Baixar Fotos Novamente</span>
              </button>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate font-medium">Foto 1 (Frente)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {registro.foto1 ? 'OK' : 'Ausente'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate font-medium">Foto 2 (Atrás)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {registro.foto2 ? 'OK' : 'Ausente'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <FileCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium">Foto 3 (CNH)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {registro.foto3 ? 'OK' : 'Ausente'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <FileCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium">Foto 4 (CRLV)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {registro.foto4 ? 'OK' : 'Ausente'}
                </span>
              </div>
            </div>
          </div>

          {/* Pré-visualização do Relatório */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600">
                Texto do Relatório Formatado:
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {reportText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Texto Copiado' : 'Copiar Relatório'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReopenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Reabrir WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
