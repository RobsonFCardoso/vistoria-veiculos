import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { isNativeMobile } from '../utils/mobileStorage';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Converte um Blob em Base64 puro
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Formato da legenda que deve acompanhar as fotos:
 *
 * 🚗 *RELATÓRIO DE VISTORIA VEICULAR*
 * ___________________________________
 *
 * 📋 *ID do Registro:* #{id}
 * 🛡️ *Nome Blitz:* {nomeBlitz}
 * 🛞 *Placa:* {placa}
 * 📅 *Data:* {dia}
 * ⏰ *Hora:* {hora}
 * ❌ *Status:* {status} (usar ❌ para REPROVADO, ✅ para APROVADO, ⏳ para Teste Em Andamento)
 * ___________________________________
 *
 * _Emitido via Sistema de Vistorias e Registros._
 */
export function generateWhatsAppReportText(registro: Registro): string {
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const blitzNome = registro.nomeBlitz || 'Não informada';

  let statusEmoji = '⏳';
  if (registro.status === 'APROVADO') {
    statusEmoji = '✅';
  } else if (registro.status === 'REPROVADO') {
    statusEmoji = '❌';
  }

  return `🚗 *RELATÓRIO DE VISTORIA VEICULAR*
___________________________________

📋 *ID do Registro:* #${cleanId}
🛡️ *Nome Blitz:* ${blitzNome}
🛞 *Placa:* ${cleanPlaca}
📅 *Data:* ${registro.dia}
⏰ *Hora:* ${registro.hora || '--:--'}
${statusEmoji} *Status:* ${registro.status}
___________________________________

_Emitido via Sistema de Vistorias e Registros._`;
}

/**
 * Converte foto em arquivo temporário no disco do aparelho (Directory.Cache)
 * e retorna o URI nativo para compartilhamento no Android
 */
export async function savePhotoToTempCacheFile(
  photoData: string | undefined | null,
  fileName: string
): Promise<string | null> {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (!trimmed) return null;

  try {
    let cleanB64 = '';

    if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
      cleanB64 = trimmed.split(',')[1] || '';
    } else if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy')) {
      cleanB64 = trimmed;
    } else {
      // Se for URL ou caminho local
      const resolved = resolvePhotoSrc(trimmed);
      if (resolved.startsWith('data:image/')) {
        cleanB64 = resolved.split(',')[1] || '';
      } else {
        const res = await fetch(resolved);
        if (!res.ok) return null;
        const blob = await res.blob();
        cleanB64 = await blobToBase64(blob);
      }
    }

    if (!cleanB64) return null;

    // Salva arquivo físico na pasta Cache do aparelho
    const fileResult = await Filesystem.writeFile({
      path: fileName,
      data: cleanB64,
      directory: Directory.Cache,
      recursive: true,
    });

    return fileResult.uri;
  } catch (err) {
    console.warn(`Erro ao salvar foto temporária ${fileName} no cache:`, err);
    return null;
  }
}

/**
 * Converte caminho/base64 de foto em objeto File (para Web Share API do navegador)
 */
export async function convertPhotoToFile(
  photoData: string | undefined | null,
  fileName: string
): Promise<File | null> {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
      const parts = trimmed.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return new File([blob], fileName, { type: mime });
    }

    if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy')) {
      const bstr = atob(trimmed);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: 'image/jpeg' });
      return new File([blob], fileName, { type: 'image/jpeg' });
    }

    const resolvedUrl = resolvePhotoSrc(trimmed);
    if (resolvedUrl) {
      if (resolvedUrl.startsWith('data:image/')) {
        return convertPhotoToFile(resolvedUrl, fileName);
      }
      const res = await fetch(resolvedUrl);
      if (res.ok) {
        const blob = await res.blob();
        const mimeType = blob.type || 'image/jpeg';
        return new File([blob], fileName, { type: mimeType });
      }
    }
  } catch (err) {
    console.warn(`Erro ao converter foto ${fileName} em File:`, err);
  }
  return null;
}

/**
 * Função principal para compartilhar vistoria com 4 fotos e legenda
 * Prioriza o compartilhamento nativo via Capacitor Share ou Web Share API com arquivos
 */
export async function compartilharVistoria(registro: Registro): Promise<{
  sharedDirectly: boolean;
  needsPrompt: boolean;
  messageText: string;
}> {
  const relatorioTexto = generateWhatsAppReportText(registro);
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  // 1. COMPARTILHAMENTO NATIVO VIA CAPACITOR SHARE (NO ANDROID / IOS)
  if (isNativeMobile()) {
    try {
      // Salva as 4 fotos temporariamente em Directory.Cache em paralelo via Promise.all
      const [uri1, uri2, uri3, uri4] = await Promise.all([
        savePhotoToTempCacheFile(registro.foto1, `share_${folderTag}_foto1.jpg`),
        savePhotoToTempCacheFile(registro.foto2, `share_${folderTag}_foto2.jpg`),
        savePhotoToTempCacheFile(registro.foto3, `share_${folderTag}_foto3.jpg`),
        savePhotoToTempCacheFile(registro.foto4, `share_${folderTag}_foto4.jpg`),
      ]);

      const filesToShare = [uri1, uri2, uri3, uri4].filter((uri): uri is string => Boolean(uri));

      if (filesToShare.length > 0) {
        await Share.share({
          title: `Vistoria - Placa ${cleanPlaca}`,
          text: relatorioTexto, // O relatório entra aqui como legenda
          files: filesToShare,  // Array com os URIs locais das fotos
          dialogTitle: `Vistoria - Placa ${cleanPlaca}`,
        });

        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText: relatorioTexto,
        };
      }
    } catch (nativeErr: any) {
      if (nativeErr?.message?.includes('canceled') || nativeErr?.message?.includes('cancel')) {
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText: relatorioTexto,
        };
      }
      console.warn('Capacitor Share nativo falhou, tentando fallback:', nativeErr);
    }
  }

  // 2. DISPOSITIVOS WEB / NAVEGADOR COM SUPORTE A WEB SHARE API DE ARQUIVOS
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const [f1, f2, f3, f4] = await Promise.all([
        convertPhotoToFile(registro.foto1, `${folderTag}_foto1.jpg`),
        convertPhotoToFile(registro.foto2, `${folderTag}_foto2.jpg`),
        convertPhotoToFile(registro.foto3, `${folderTag}_foto3.jpg`),
        convertPhotoToFile(registro.foto4, `${folderTag}_foto4.jpg`),
      ]);

      const files = [f1, f2, f3, f4].filter((f): f is File => Boolean(f));

      const canShareFiles =
        files.length > 0 &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files });

      if (canShareFiles) {
        await navigator.share({
          files,
          text: relatorioTexto,
          title: `Vistoria - Placa ${cleanPlaca}`,
        });

        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText: relatorioTexto,
        };
      }
    } catch (webErr: any) {
      if (webErr?.name === 'AbortError') {
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText: relatorioTexto,
        };
      }
      console.warn('Web Share API falhou, usando fallback WhatsApp link:', webErr);
    }
  }

  // 3. FALLBACK CASO O COMPARTILHAMENTO DE ARQUIVOS NÃO SEJA SUPORTADO:
  // Copia o texto para a área de transferência e abre o link do WhatsApp
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(relatorioTexto);
    }
  } catch (clipErr) {
    console.warn('Clipboard writeText indisponível:', clipErr);
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(relatorioTexto)}`;
  window.open(whatsappUrl, '_blank');

  return {
    sharedDirectly: false,
    needsPrompt: true,
    messageText: relatorioTexto,
  };
}

// Alias para compatibilidade com chamadas anteriores
export const sendRegistroToWhatsApp = compartilharVistoria;
