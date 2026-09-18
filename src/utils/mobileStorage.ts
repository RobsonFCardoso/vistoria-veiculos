import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Registro } from '../types';

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
 * Helper to convert a Blob to base64 string without data URL prefix
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
 * Saves an individual photo into the smartphone's Download/RegistroFotos/ subfolder via Capacitor Filesystem
 */
export async function savePhotoToMobileDownload(
  recordId: string,
  placa: string,
  photoIndex: 1 | 2,
  base64Data: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanId = String(recordId).trim();
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const fileName = `${folderTag}_foto${photoIndex}.jpg`;
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  if (isNativeMobile()) {
    try {
      const targetFolder = `Download/RegistroFotos/${folderTag}`;

      // 1. Create subfolder inside phone's Download directory
      try {
        await Filesystem.mkdir({
          path: targetFolder,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
      } catch {
        // Fallback for devices restricting direct root ExternalStorage access
        await Filesystem.mkdir({
          path: `RegistroFotos/${folderTag}`,
          directory: Directory.Documents,
          recursive: true,
        });
      }

      // 2. Write file
      try {
        const fileResult = await Filesystem.writeFile({
          path: `${targetFolder}/${fileName}`,
          data: cleanBase64,
          directory: Directory.ExternalStorage,
        });
        return { success: true, path: fileResult.uri };
      } catch {
        const fallbackResult = await Filesystem.writeFile({
          path: `RegistroFotos/${folderTag}/${fileName}`,
          data: cleanBase64,
          directory: Directory.Documents,
        });
        return { success: true, path: fallbackResult.uri };
      }
    } catch (err: any) {
      console.warn('Erro ao gravar arquivo na pasta Download do celular:', err);
      return { success: false, error: err.message };
    }
  }

  return { success: true, path: `RegistroFotos/${folderTag}/${fileName}` };
}

/**
 * Syncs the entire RegistroFotos structure (and all subfolders) into the smartphone's Download folder
 */
export async function syncAllFoldersToMobileDownload(
  registros: Registro[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; savedCount: number }> {
  let savedCount = 0;
  const totalSteps = registros.length * 2;

  // If running inside Capacitor Native APK on Android:
  if (isNativeMobile()) {
    try {
      onProgress?.(0, totalSteps, 'Criando pasta raiz Download/RegistroFotos...');

      // Ensure root Download/RegistroFotos directory exists
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
        const folderTag = `(${r.id}_${r.placa.trim().toUpperCase()})`;
        const targetSubfolder = `Download/RegistroFotos/${folderTag}`;

        // Create subfolder
        try {
          await Filesystem.mkdir({
            path: targetSubfolder,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
        } catch {
          await Filesystem.mkdir({
            path: `RegistroFotos/${folderTag}`,
            directory: Directory.Documents,
            recursive: true,
          });
        }

        // Save Foto 1
        onProgress?.(savedCount + 1, totalSteps, `Salvando foto 1 de ${r.placa}...`);
        try {
          const url1 = r.foto1.startsWith('/') ? r.foto1 : `/${r.foto1}`;
          const res1 = await fetch(url1);
          if (res1.ok) {
            const blob1 = await res1.blob();
            const b64 = await blobToBase64(blob1);
            await Filesystem.writeFile({
              path: `${targetSubfolder}/${folderTag}_foto1.jpg`,
              data: b64,
              directory: Directory.ExternalStorage,
            }).catch(async () => {
              await Filesystem.writeFile({
                path: `RegistroFotos/${folderTag}/${folderTag}_foto1.jpg`,
                data: b64,
                directory: Directory.Documents,
              });
            });
            savedCount++;
          }
        } catch (err) {
          console.warn(`Erro ao baixar foto 1 de ${r.placa}:`, err);
        }

        // Save Foto 2
        onProgress?.(savedCount + 1, totalSteps, `Salvando foto 2 de ${r.placa}...`);
        try {
          const url2 = r.foto2.startsWith('/') ? r.foto2 : `/${r.foto2}`;
          const res2 = await fetch(url2);
          if (res2.ok) {
            const blob2 = await res2.blob();
            const b64 = await blobToBase64(blob2);
            await Filesystem.writeFile({
              path: `${targetSubfolder}/${folderTag}_foto2.jpg`,
              data: b64,
              directory: Directory.ExternalStorage,
            }).catch(async () => {
              await Filesystem.writeFile({
                path: `RegistroFotos/${folderTag}/${folderTag}_foto2.jpg`,
                data: b64,
                directory: Directory.Documents,
              });
            });
            savedCount++;
          }
        } catch (err) {
          console.warn(`Erro ao baixar foto 2 de ${r.placa}:`, err);
        }
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

  // 100% Offline: No ambiente web/navegador, gera o ZIP client-side usando JSZip
  try {
    onProgress?.(1, 2, 'Compactando fotos no navegador...');
    const JSZipModule = (await import('jszip')).default;
    const zip = new JSZipModule();
    const rootFolder = zip.folder('RegistroFotos');

    for (const r of registros) {
      const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const folderTag = `(${r.id}_${cleanPlaca})`;
      const sub = rootFolder?.folder(folderTag);

      if (r.foto1 && r.foto1.includes(',')) {
        sub?.file(`${folderTag}_foto1.jpg`, r.foto1.split(',')[1], { base64: true });
      }
      if (r.foto2 && r.foto2.includes(',')) {
        sub?.file(`${folderTag}_foto2.jpg`, r.foto2.split(',')[1], { base64: true });
      }
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
      message: 'Download concluído! O arquivo "RegistroFotos_Download.zip" com a pasta e todas as subpastas foi gravado no dispositivo.',
      savedCount: totalSteps,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro ao transferir arquivos: ' + err.message,
      savedCount: 0,
    };
  }
}
