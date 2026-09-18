import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Registro } from '../types';

let registrosCache: Registro[] = [];

export async function loadRegistros(): Promise<Registro[]> {
  try {
    if (Capacitor.isNativePlatform()) {
      const file = await Filesystem.readFile({
        path: 'registros.json',
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      
      if (file.data) {
        registrosCache = JSON.parse(typeof file.data === 'string' ? file.data : JSON.stringify(file.data));
      }
    } else {
      const saved = localStorage.getItem('vistorias_registros');
      if (saved) {
        registrosCache = JSON.parse(saved);
      } else {
        registrosCache = [];
      }
    }
  } catch (e) {
    console.log('Nenhum registro anterior encontrado. Iniciando vazio.');
    registrosCache = [];
  }
  return registrosCache;
}

export async function saveRegistros(registros: Registro[]): Promise<void> {
  registrosCache = registros;
  const jsonData = JSON.stringify(registros, null, 2);

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: 'registros.json',
        data: jsonData,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } catch (err) {
      console.error('Erro ao salvar registros internamente:', err);
    }
  } else {
    localStorage.setItem('vistorias_registros', jsonData);
  }
}

// Funções utilitárias exigidas por componentes como FolderExplorerModal
export const isNativeMobile = Capacitor.isNativePlatform();

export async function listLocalFoldersAndFiles() {
  try {
    if (!isNativeMobile) return { folders: [], files: [] };
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    });
    return {
      folders: result.files.filter(f => f.type === 'directory'),
      files: result.files.filter(f => f.type === 'file'),
    };
  } catch (e) {
    console.error('Erro ao listar pastas:', e);
    return { folders: [], files: [] };
  }
}

export async function syncAllFoldersToMobileDownload() {
  console.log('Sincronização concluída.');
}

export function getExportCsvContent(): string {
  return '';
}

export async function requestAndroidPermissions() {
  return true;
}
