import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Registro } from '../types';

// Estado inicial vazio para o app abrir limpo
let registrosCache: Registro[] = [];

export async function loadRegistros(): Promise<Registro[]> {
  try {
    if (Capacitor.isNativePlatform()) {
      const file = await Filesystem.readFile({
        path: 'Registros.csv',
        directory: Directory.Data, // Usa diretório interno seguro do app
        encoding: Encoding.UTF8,
      });
      // Lógica de parsing do CSV para registros...
      // Se não houver arquivo, retorna array vazio []
    }
  } catch (e) {
    console.log('Nenhum registro anterior encontrado ou arquivo vazio.');
    registrosCache = [];
  }
  return registrosCache;
}

export async function saveRegistros(registros: Registro[]): Promise<void> {
  registrosCache = registros;
  const csvContent = convertToCSV(registros);

  if (Capacitor.isNativePlatform()) {
    try {
      // Salva no diretório interno de dados do app (evita EACCES Permission denied)
      await Filesystem.writeFile({
        path: 'Registros.csv',
        data: csvContent,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
    } catch (err) {
      console.error('Erro ao salvar Registros.csv internamente:', err);
    }
  } else {
    localStorage.setItem('vistorias_registros', JSON.stringify(registros));
  }
}
