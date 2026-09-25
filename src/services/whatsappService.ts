import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { isNativeMobile } from '../utils/mobileStorage';
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
 * Converte caminho, URL ou Base64 de uma foto em um objeto File real usando fetch e blob
 */
export async function convertPhotoToFile(
  photoData: string | undefined | null,
  fileName: string
): Promise<File | null> {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (!trimmed) return null;

  try {
    // 1. Caso seja Data URL (data:image/jpeg;base64,...)
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

    // 2. Caso seja Base64 puro (sem o prefixo data:)
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

    // 3. Caso seja URL (blob:, http:, https: ou caminho resolvido)
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
 * Converte as 4 fotos do registro em objetos File para compartilhamento múltiplo
 */
export async function getRegistroImageFiles(registro: Registro): Promise<File[]> {
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const files: File[] = [];

  const [f1, f2, f3, f4] = await Promise.all([
    convertPhotoToFile(registro.foto1, `${folderTag}_foto1.jpg`),
    convertPhotoToFile(registro.foto2, `${folderTag}_foto2.jpg`),
    convertPhotoToFile(registro.foto3, `${folderTag}_foto3.jpg`),
    convertPhotoToFile(registro.foto4, `${folderTag}_foto4.jpg`),
  ]);

  if (f1) files.push(f1);
  if (f2) files.push(f2);
  if (f3) files.push(f3);
  if (f4) files.push(f4);

  return files;
}

/**
 * Envia o registro via WhatsApp com as 4 FOTOS REAIS salvas anexadas
 * junto com o relatório formatado como LEGENDA (caption), utilizando Web Share API / Capacitor.
 * Se o compartilhamento de arquivos não for suportado, executa fallback: copia texto e abre o link do WhatsApp.
 */
export async function sendRegistroToWhatsApp(registro: Registro): Promise<{
  sharedDirectly: boolean;
  needsPrompt: boolean;
  messageText: string;
}> {
  const messageText = generateWhatsAppReportText(registro);

  // 1. Converter as fotos do registro em objetos File reais
  let files: File[] = [];
  try {
    files = await getRegistroImageFiles(registro);
  } catch (err) {
    console.warn('Erro ao obter arquivos de foto para compartilhamento:', err);
  }

  // 2. Verificar se o navegador/dispositivo suporta compartilhamento de arquivos (Web Share API)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const canShareWithFiles =
        files.length > 0 &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files });

      if (canShareWithFiles) {
        // Envia as 4 fotos reais com o relatório como legenda
        await navigator.share({
          files,
          text: messageText,
          title: `Vistoria Veicular - ${registro.placa}`,
        });

        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (shareErr: any) {
      // Se o usuário cancelou a folha de compartilhamento nativa, encerra graciosamente
      if (shareErr?.name === 'AbortError') {
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
      console.warn('Web Share com arquivos indisponível ou falhou, tentando alternativa nativa:', shareErr);
    }
  }

  // 3. Suporte Capacitor Mobile Nativo com URIs das fotos no cache
  if (isNativeMobile()) {
    try {
      const cleanId = String(registro.id).trim();
      const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const folderTag = `(${cleanId}_${cleanPlaca})`;
      const fileUris: string[] = [];

      const saveTempForShare = async (photoData: string | undefined, index: number): Promise<string | null> => {
        if (!photoData) return null;
        try {
          const cleanB64 = photoData.includes(',') ? photoData.split(',')[1] : photoData;
          if (cleanB64.startsWith('/') || cleanB64.startsWith('http')) {
            const res = await fetch(resolvePhotoSrc(photoData));
            const blob = await res.blob();
            const b64 = await blobToBase64(blob);
            const saved = await Filesystem.writeFile({
              path: `share_temp_${folderTag}_foto${index}.jpg`,
              data: b64,
              directory: Directory.Cache,
            });
            return saved.uri;
          } else {
            const saved = await Filesystem.writeFile({
              path: `share_temp_${folderTag}_foto${index}.jpg`,
              data: cleanB64,
              directory: Directory.Cache,
            });
            return saved.uri;
          }
        } catch (e) {
          console.warn(`Erro ao preparar foto ${index} no cache:`, e);
          return null;
        }
      };

      const [u1, u2, u3, u4] = await Promise.all([
        saveTempForShare(registro.foto1, 1),
        saveTempForShare(registro.foto2, 2),
        saveTempForShare(registro.foto3, 3),
        saveTempForShare(registro.foto4, 4),
      ]);

      if (u1) fileUris.push(u1);
      if (u2) fileUris.push(u2);
      if (u3) fileUris.push(u3);
      if (u4) fileUris.push(u4);

      if (fileUris.length > 0) {
        await Share.share({
          title: `Vistoria Veicular - ${cleanPlaca}`,
          text: messageText,
          files: fileUris,
          dialogTitle: 'Enviar Vistoria via WhatsApp',
        });
        return {
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (nativeErr: any) {
      if (nativeErr?.message?.includes('canceled') || nativeErr?.message?.includes('cancel')) {
        return { sharedDirectly: true, needsPrompt: false, messageText };
      }
      console.warn('Capacitor Share nativo falhou:', nativeErr);
    }
  }

  // 4. Fallback padrão: copia o texto do relatório para a área de transferência e abre o link do WhatsApp
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(messageText);
    }
  } catch (clipErr) {
    console.warn('Clipboard writeText indisponível:', clipErr);
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  window.open(whatsappUrl, '_blank');

  return {
    sharedDirectly: false,
    needsPrompt: true,
    messageText,
  };
}
