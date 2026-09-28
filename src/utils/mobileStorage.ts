import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Registro } from '../types';
import { resolvePhotoSrc } from './photoUrl';

/**
 * Checks if the current environment is running natively inside Capacitor (Android/iOS)
 */
export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Converte qualquer fonte de imagem (data URL, base64 puro, blob URL, caminho relativo) em Base64 puro
 */
export async function normalizeToBase64(photoData: string | undefined | null): Promise<string> {
  if (!photoData || typeof photoData !== 'string') return '';
  const trimmed = photoData.trim();
  if (!trimmed) return '';

  // 1. Data URL (data:image/jpeg;base64,...)
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    return commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : trimmed;
  }

  // 2. Base64 puro (sem header data:)
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy') || trimmed.length > 200 && !trimmed.includes('/')) {
    return trimmed;
  }

  // 3. URL ou caminho relativo (blob:, http:, /...)
  try {
    const resolvedUrl = resolvePhotoSrc(trimmed);
    if (resolvedUrl.startsWith('data:')) {
      const commaIndex = resolvedUrl.indexOf(',');
      return commaIndex !== -1 ? resolvedUrl.slice(commaIndex + 1) : resolvedUrl;
    }
    const res = await fetch(resolvedUrl);
    if (res.ok) {
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIndex = result.indexOf(',');
          resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn('Erro ao normalizar imagem para Base64:', e);
  }

  return '';
}

export interface FotosInput {
  foto1?: string;
  foto2?: string;
  foto3?: string;
  foto4?: string;
}

/**
 * Salva de forma garantida e paralela as 4 fotos do registro no armazenamento interno do celular
 * Diretório: Download/RegistroFotos/((ID)_(PLACA))/
 * Arquivos: ((ID)_(PLACA))_foto1.jpg, ((ID)_(PLACA))_foto2.jpg, ((ID)_(PLACA))_foto3.jpg, ((ID)_(PLACA))_foto4.jpg
 */
export async function saveAllPhotosToMobile(
  id: string,
  placa: string,
  fotos: FotosInput | (string | undefined)[]
): Promise<{
  success: boolean;
  folderPath: string;
  savedPhotos: { index: number; fileName: string; path?: string; saved: boolean }[];
}> {
  const cleanId = String(id).trim();
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const targetFolder = `Download/RegistroFotos/${folderTag}`;
  const fallbackFolder = `RegistroFotos/${folderTag}`;

  let f1: string | undefined;
  let f2: string | undefined;
  let f3: string | undefined;
  let f4: string | undefined;

  if (Array.isArray(fotos)) {
    [f1, f2, f3, f4] = fotos;
  } else {
    f1 = fotos.foto1;
    f2 = fotos.foto2;
    f3 = fotos.foto3;
    f4 = fotos.foto4;
  }

  const photoEntries: { index: 1 | 2 | 3 | 4; data?: string; fileName: string }[] = [
    { index: 1, data: f1, fileName: `${folderTag}_foto1.jpg` },
    { index: 2, data: f2, fileName: `${folderTag}_foto2.jpg` },
    { index: 3, data: f3, fileName: `${folderTag}_foto3.jpg` },
    { index: 4, data: f4, fileName: `${folderTag}_foto4.jpg` },
  ];

  const results: { index: number; fileName: string; path?: string; saved: boolean }[] = [];

  if (isNativeMobile()) {
    try {
      // 1. Garante que a pasta de destino exista no dispositivo
      let baseDir = Directory.ExternalStorage;
      let activeFolder = targetFolder;

      try {
        await Filesystem.mkdir({
          path: targetFolder,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
      } catch {
        try {
          await Filesystem.mkdir({
            path: fallbackFolder,
            directory: Directory.Documents,
            recursive: true,
          });
          baseDir = Directory.Documents;
          activeFolder = fallbackFolder;
        } catch (dirErr) {
          console.warn('Erro ao criar diretórios de fotos no celular:', dirErr);
        }
      }

      // 2. Grava todas as fotos informadas em paralelo via Promise.all
      const writeTasks = photoEntries.map(async (entry) => {
        if (!entry.data) {
          return { index: entry.index, fileName: entry.fileName, saved: false };
        }

        try {
          const cleanB64 = await normalizeToBase64(entry.data);
          if (!cleanB64) {
            return { index: entry.index, fileName: entry.fileName, saved: false };
          }

          const fileRes = await Filesystem.writeFile({
            path: `${activeFolder}/${entry.fileName}`,
            data: cleanB64,
            directory: baseDir,
            recursive: true,
          });

          return {
            index: entry.index,
            fileName: entry.fileName,
            path: fileRes.uri,
            saved: true,
          };
        } catch (writeErr) {
          console.warn(`Erro ao salvar foto ${entry.index} no celular:`, writeErr);
          // Tenta no Documents se ExternalStorage falhou
          try {
            const cleanB64 = await normalizeToBase64(entry.data);
            const fallbackRes = await Filesystem.writeFile({
              path: `${fallbackFolder}/${entry.fileName}`,
              data: cleanB64,
              directory: Directory.Documents,
              recursive: true,
            });
            return {
              index: entry.index,
              fileName: entry.fileName,
              path: fallbackRes.uri,
              saved: true,
            };
          } catch {
            return { index: entry.index, fileName: entry.fileName, saved: false };
          }
        }
      });

      const writeResults = await Promise.all(writeTasks);
      results.push(...writeResults);

      return {
        success: results.some(r => r.saved),
        folderPath: activeFolder,
        savedPhotos: results,
      };
    } catch (err: any) {
      console.warn('Erro geral ao salvar fotos no celular:', err);
    }
  }

  // Fallback quando executado em navegador web
  for (const entry of photoEntries) {
    results.push({
      index: entry.index,
      fileName: entry.fileName,
      path: `${targetFolder}/${entry.fileName}`,
      saved: Boolean(entry.data),
    });
  }

  return {
    success: true,
    folderPath: targetFolder,
    savedPhotos: results,
  };
}

/**
 * Salva uma foto individual (mantida para compatibilidade)
 */
export async function savePhotoToMobileDownload(
  recordId: string,
  placa: string,
  photoIndex: 1 | 2 | 3 | 4,
  base64Data: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const fotos: FotosInput = {};
  if (photoIndex === 1) fotos.foto1 = base64Data;
  if (photoIndex === 2) fotos.foto2 = base64Data;
  if (photoIndex === 3) fotos.foto3 = base64Data;
  if (photoIndex === 4) fotos.foto4 = base64Data;

  const res = await saveAllPhotosToMobile(recordId, placa, fotos);
  const item = res.savedPhotos.find(p => p.index === photoIndex);
  return {
    success: Boolean(item?.saved),
    path: item?.path,
  };
}

/**
 * Sincroniza a estrutura completa de pastas e as 4 fotos de todos os registros
 */
export async function syncAllFoldersToMobileDownload(
  registros: Registro[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; savedCount: number }> {
  let savedCount = 0;
  const totalSteps = registros.length * 4;

  if (isNativeMobile()) {
    try {
      onProgress?.(0, totalSteps, 'Criando pasta raiz Download/RegistroFotos...');

      await Filesystem.mkdir({
        path: 'Download/RegistroFotos',
        directory: Directory.ExternalStorage,
        recursive: true,
      }).catch(async () => {
        await Filesystem.mkdir({
          path: 'RegistroFotos',
          directory: Directory.Documents,
          recursive: true,
        });
      });

      for (let i = 0; i < registros.length; i++) {
        const r = registros[i];
        onProgress?.(i * 4 + 1, totalSteps, `Salvando fotos do registro #${r.id} (${r.placa})...`);

        const res = await saveAllPhotosToMobile(r.id, r.placa, {
          foto1: r.foto1,
          foto2: r.foto2,
          foto3: r.foto3,
          foto4: r.foto4,
        });

        savedCount += res.savedPhotos.filter(p => p.saved).length;
      }

      return {
        success: true,
        message: `${savedCount} fotos organizadas em suas respectivas subpastas criadas em Download/RegistroFotos/ no celular!`,
        savedCount,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Erro durante sincronização com a pasta Download: ' + err.message,
        savedCount,
      };
    }
  }

  // No navegador web, gera o ZIP com as 4 fotos de cada vistoria
  try {
    onProgress?.(1, 2, 'Compactando fotos no navegador...');
    const JSZipModule = (await import('jszip')).default;
    const zip = new JSZipModule();
    const rootFolder = zip.folder('RegistroFotos');

    for (const r of registros) {
      const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const folderTag = `(${r.id}_${cleanPlaca})`;
      const sub = rootFolder?.folder(folderTag);

      const addZipPhoto = async (photoData: string | undefined, name: string) => {
        if (!photoData) return;
        const b64 = await normalizeToBase64(photoData);
        if (b64) {
          sub?.file(name, b64, { base64: true });
          savedCount++;
        }
      };

      await Promise.all([
        addZipPhoto(r.foto1, `${folderTag}_foto1.jpg`),
        addZipPhoto(r.foto2, `${folderTag}_foto2.jpg`),
        addZipPhoto(r.foto3, `${folderTag}_foto3.jpg`),
        addZipPhoto(r.foto4, `${folderTag}_foto4.jpg`),
      ]);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RegistroFotos_Download.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'Download concluído! O arquivo "RegistroFotos_Download.zip" com todas as fotos foi gravado no dispositivo.',
      savedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro ao transferir arquivos: ' + err.message,
      savedCount: 0,
    };
  }
}
