import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { isNativeMobile, saveAllPhotosToMobile, normalizeToBase64 } from '../utils/mobileStorage';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
 * Formata o relatório de vistoria veicular exatamente conforme a especificação:
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
 * Converte foto em arquivo temporário na pasta de cache do dispositivo
 * Retornando o URI nativo para compartilhamento com @capacitor/share
 */
export async function savePhotoToTempCacheFile(
  photoData: string | undefined | null,
  fileName: string
): Promise<string | null> {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (!trimmed) return null;

  try {
    const cleanB64 = await normalizeToBase64(trimmed);
    if (!cleanB64) return null;

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
 * Converte caminho ou base64 de uma foto em um objeto File nativo
 */
export async function convertPhotoToFile(
  photoData: string | undefined | null,
  fileName: string
): Promise<File | null> {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('data:')) {
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
      if (resolvedUrl.startsWith('data:')) {
        return convertPhotoToFile(resolvedUrl, fileName);
      }
      const res = await fetch(resolvedUrl);
      if (res.ok) {
        const blob = await res.blob();
        return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      }
    }
  } catch (err) {
    console.warn(`Erro ao converter imagem ${fileName} em File:`, err);
  }
  return null;
}

/**
 * Converte as 4 fotos do registro em objetos File para Web Share API
 */
export async function getRegistroImageFiles(registro: Registro): Promise<File[]> {
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  const [f1, f2, f3, f4] = await Promise.all([
    convertPhotoToFile(registro.foto1, `${folderTag}_foto1.jpg`),
    convertPhotoToFile(registro.foto2, `${folderTag}_foto2.jpg`),
    convertPhotoToFile(registro.foto3, `${folderTag}_foto3.jpg`),
    convertPhotoToFile(registro.foto4, `${folderTag}_foto4.jpg`),
  ]);

  return [f1, f2, f3, f4].filter((f): f is File => Boolean(f));
}

export interface ShareResult {
  sharedDirectly: boolean;
  needsPrompt: boolean;
  messageText: string;
  pdfBlob?: Blob;
  pdfFileName?: string;
}

/**
 * Envia o registro via WhatsApp com as 4 FOTOS REAIS salvas anexadas
 * junto com o relatório formatado como LEGENDA (caption), utilizando Web Share API / Capacitor.
 * 
 * Se o compartilhamento nativo de múltiplos arquivos não for suportado:
 * 1. Salva automaticamente as 4 fotos na pasta local Download/RegistroFotos/((ID)_(PLACA))/
 * 2. Gera automaticamente o PDF da vistoria com as 4 fotos anexadas
 * 3. Abre o WhatsApp com o texto do relatório e exibe o modal orientador com acesso ao PDF e fotos
 */
export async function sendRegistroToWhatsApp(registro: Registro): Promise<ShareResult> {
  const messageText = generateWhatsAppReportText(registro);
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  // =========================================================================
  // MÉTODO PRINCIPAL 1: DISPOSITIVO NATIVO ANDROID / IOS COM @CAPACITOR/SHARE
  // =========================================================================
  if (isNativeMobile()) {
    try {
      // Salva as 4 fotos temporariamente em Directory.Cache em paralelo via Promise.all
      const [u1, u2, u3, u4] = await Promise.all([
        savePhotoToTempCacheFile(registro.foto1, `share_${folderTag}_foto1.jpg`),
        savePhotoToTempCacheFile(registro.foto2, `share_${folderTag}_foto2.jpg`),
        savePhotoToTempCacheFile(registro.foto3, `share_${folderTag}_foto3.jpg`),
        savePhotoToTempCacheFile(registro.foto4, `share_${folderTag}_foto4.jpg`),
      ]);

      const fileUris = [u1, u2, u3, u4].filter((u): u is string => Boolean(u));

      if (fileUris.length > 0) {
        await Share.share({
          title: `Vistoria - Placa ${cleanPlaca}`,
          text: messageText, // O relatório entra como legenda
          files: fileUris,   // Array com os URIs locais das 4 fotos
          dialogTitle: `Enviar Vistoria - Placa ${cleanPlaca}`,
        });

        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (nativeErr: any) {
      if (nativeErr?.message?.includes('canceled') || nativeErr?.message?.includes('cancel')) {
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
      console.warn('Capacitor Share com arquivos falhou, avançando para fallback:', nativeErr);
    }
  }

  // =========================================================================
  // MÉTODO PRINCIPAL 2: NAVEGADOR COM WEB SHARE API SUPORTANDO MULTI-ARQUIVOS
  // =========================================================================
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const files = await getRegistroImageFiles(registro);
      const canShareFiles =
        files.length > 0 &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files });

      if (canShareFiles) {
        await navigator.share({
          files,
          text: messageText,
          title: `Vistoria - Placa ${cleanPlaca}`,
        });

        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (webErr: any) {
      if (webErr?.name === 'AbortError') {
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
      console.warn('Web Share API não completou, avançando para fallback:', webErr);
    }
  }

  // =========================================================================
  // MÉTODO FALLBACK: SALVA FOTOS + GERA PDF DA VISTORIA + ABRE WHATSAPP + MODAL
  // =========================================================================
  let pdfBlob: Blob | undefined;
  let pdfFileName: string | undefined;

  try {
    // 1. Salva as 4 fotos no armazenamento do dispositivo em Download/RegistroFotos/((ID)_(PLACA))/
    await saveAllPhotosToMobile(cleanId, cleanPlaca, {
      foto1: registro.foto1,
      foto2: registro.foto2,
      foto3: registro.foto3,
      foto4: registro.foto4,
    }).catch(err => console.warn('Aviso no salvamento de fotos do fallback:', err));

    // 2. Gera o PDF oficial da vistoria contendo as 4 fotos anexadas
    const pdfRes = await generateVehicleReportPDF(registro);
    pdfBlob = pdfRes.blob;
    pdfFileName = pdfRes.fileName;
  } catch (pdfErr) {
    console.warn('Erro ao gerar PDF no fluxo de fallback:', pdfErr);
  }

  // 3. Copia o texto do relatório formatado para a área de transferência
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(messageText);
    }
  } catch (clipErr) {
    console.warn('Clipboard writeText indisponível:', clipErr);
  }

  // 4. Abre o WhatsApp com a mensagem preenchida
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  window.open(whatsappUrl, '_blank');

  return {
    sharedDirectly: false,
    needsPrompt: true,
    messageText,
    pdfBlob,
    pdfFileName,
  };
}

export const compartilharVistoria = sendRegistroToWhatsApp;
