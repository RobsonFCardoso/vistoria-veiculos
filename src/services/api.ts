import { Registro, RegistroFormData } from '../types';
import { savePhotoToMobileDownload, isNativeMobile } from '../utils/mobileStorage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const STORAGE_KEY = 'registros_vistorias';

// Base de dados limpa (Zero Data) - Sem registros fictícios
export const INITIAL_DEMO_REGISTROS: Registro[] = [];

/**
 * Formata a lista de registros no padrão CSV solicitado: ID,Placa,Status,Data,Fotos
 */
export function formatRegistrosToCsv(records: Registro[]): string {
  const header = 'ID,Placa,Status,Data,Fotos';
  const rows = records.map(r => {
    const dataStr = r.hora ? `${r.dia} ${r.hora}` : r.dia;
    const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanId = String(r.id).trim();
    const fotosArr: string[] = [
      `(${cleanId}_${cleanPlaca})_foto1.jpg`,
      `(${cleanId}_${cleanPlaca})_foto2.jpg`,
    ];
    if (r.foto3) {
      fotosArr.push(`(${cleanId}_${cleanPlaca})_foto3.jpg`);
    }
    if (r.foto4) {
      fotosArr.push(`(${cleanId}_${cleanPlaca})_foto4.jpg`);
    }
    return `${cleanId},${cleanPlaca},${r.status},${dataStr},${fotosArr.join(';')}`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Grava e atualiza o arquivo Registros.csv diretamente no aparelho celular via Capacitor Filesystem
 */
export async function writeRegistrosCsvToDevice(records: Registro[]): Promise<string> {
  const csvContent = formatRegistrosToCsv(records);

  if (isNativeMobile()) {
    try {
      await Filesystem.writeFile({
        path: 'Download/Registros.csv',
        data: csvContent,
        directory: Directory.ExternalStorage,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch (e) {
      console.warn('Gravação em ExternalStorage Download/Registros.csv falhou, tentando Documents:', e);
      try {
        await Filesystem.writeFile({
          path: 'Registros.csv',
          data: csvContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch (e2) {
        console.warn('Gravação em Documents Registros.csv falhou:', e2);
      }
    }
  }

  return csvContent;
}

/**
 * Retorna todos os registros armazenados no LocalStorage
 */
export function getLocalRegistros(): Registro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // Se estiver vazio pela primeira vez, inicializa com array vazio
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.error('Erro ao ler registros do LocalStorage:', err);
    return [];
  }
}

/**
 * 100% Offline: Lê os registros mantidos no LocalStorage (chave 'registros_vistorias')
 */
export async function fetchRegistros(): Promise<Registro[]> {
  const records = getLocalRegistros();
  try {
    writeRegistrosCsvToDevice(records).catch(() => {});
  } catch {}
  return records;
}

/**
 * 100% Offline: Busca um registro por ID
 */
export async function fetchRegistroById(id: string): Promise<Registro> {
  const records = getLocalRegistros();
  const found = records.find(r => r.id === id);
  if (!found) {
    throw new Error(`Registro com ID #${id} não encontrado.`);
  }
  return found;
}

/**
 * 100% Offline: Cria um novo registro
 * - Gravação e atualização imediata e síncrona no LocalStorage
 * - Grava as fotos no celular em Download/RegistroFotos/(ID_PLACA)
 * - Atualiza o arquivo Registros.csv no celular em bloco try/catch para tolerância a falhas
 */
export async function createRegistro(payload: RegistroFormData): Promise<Registro> {
  const currentRecords = getLocalRegistros();

  // Determina próximo ID sequencial
  let maxId = 0;
  for (const r of currentRecords) {
    const num = parseInt(r.id, 10);
    if (!isNaN(num) && num > maxId) {
      maxId = num;
    }
  }
  const nextId = String(maxId + 1);
  const cleanPlaca = payload.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Salva fotos fisicamente na pasta do celular (se capturadas)
  if (payload.foto1Base64) {
    savePhotoToMobileDownload(nextId, cleanPlaca, 1, payload.foto1Base64).catch(err => {
      console.warn('Erro ao salvar foto 1 no celular:', err);
    });
  }
  if (payload.foto2Base64) {
    savePhotoToMobileDownload(nextId, cleanPlaca, 2, payload.foto2Base64).catch(err => {
      console.warn('Erro ao salvar foto 2 no celular:', err);
    });
  }
  if (payload.foto3Base64) {
    savePhotoToMobileDownload(nextId, cleanPlaca, 3, payload.foto3Base64).catch(err => {
      console.warn('Erro ao salvar foto 3 (CNH) no celular:', err);
    });
  }
  if (payload.foto4Base64) {
    savePhotoToMobileDownload(nextId, cleanPlaca, 4, payload.foto4Base64).catch(err => {
      console.warn('Erro ao salvar foto 4 (CRLV) no celular:', err);
    });
  }

  const foto1Val = payload.foto1Base64
    ? (payload.foto1Base64.startsWith('data:') ? payload.foto1Base64 : `data:image/jpeg;base64,${payload.foto1Base64}`)
    : (payload.foto1Existing || '');

  const foto2Val = payload.foto2Base64
    ? (payload.foto2Base64.startsWith('data:') ? payload.foto2Base64 : `data:image/jpeg;base64,${payload.foto2Base64}`)
    : (payload.foto2Existing || '');

  const foto3Val = payload.foto3Base64
    ? (payload.foto3Base64.startsWith('data:') ? payload.foto3Base64 : `data:image/jpeg;base64,${payload.foto3Base64}`)
    : (payload.foto3Existing || '');

  const foto4Val = payload.foto4Base64
    ? (payload.foto4Base64.startsWith('data:') ? payload.foto4Base64 : `data:image/jpeg;base64,${payload.foto4Base64}`)
    : (payload.foto4Existing || '');

  const newRecord: Registro = {
    id: nextId,
    nomeBlitz: payload.nomeBlitz?.trim() || 'Operação de Vistoria',
    dia: payload.dia,
    hora: payload.hora,
    placa: cleanPlaca,
    foto1: foto1Val,
    foto2: foto2Val,
    foto3: foto3Val,
    foto4: foto4Val,
    status: payload.status,
  };

  // 1. Gravação imediata e síncrona no LocalStorage
  const updatedRecords = [newRecord, ...currentRecords];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao gravar no localStorage:', lsErr);
  }

  // 2. Gravação em segundo plano no CSV com try/catch para não bloquear o salvamento
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV no dispositivo celular:', csvErr);
  }

  return newRecord;
}

/**
 * 100% Offline: Atualiza um registro existente no LocalStorage e no CSV
 */
export async function updateRegistro(id: string, payload: Partial<RegistroFormData>): Promise<Registro> {
  const currentRecords = getLocalRegistros();
  const existing = currentRecords.find(r => r.id === id);
  if (!existing) {
    throw new Error(`Registro com ID #${id} não encontrado.`);
  }

  const cleanPlaca = payload.placa
    ? payload.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    : existing.placa;

  // Salva novas fotos fisicamente caso tenham sido alteradas
  if (payload.foto1Base64) {
    savePhotoToMobileDownload(id, cleanPlaca, 1, payload.foto1Base64).catch(err => {
      console.warn('Erro ao salvar foto 1 atualizada:', err);
    });
  }
  if (payload.foto2Base64) {
    savePhotoToMobileDownload(id, cleanPlaca, 2, payload.foto2Base64).catch(err => {
      console.warn('Erro ao salvar foto 2 atualizada:', err);
    });
  }
  if (payload.foto3Base64) {
    savePhotoToMobileDownload(id, cleanPlaca, 3, payload.foto3Base64).catch(err => {
      console.warn('Erro ao salvar foto 3 atualizada:', err);
    });
  }
  if (payload.foto4Base64) {
    savePhotoToMobileDownload(id, cleanPlaca, 4, payload.foto4Base64).catch(err => {
      console.warn('Erro ao salvar foto 4 atualizada:', err);
    });
  }

  const updated: Registro = {
    id,
    nomeBlitz: payload.nomeBlitz !== undefined ? payload.nomeBlitz : existing.nomeBlitz,
    dia: payload.dia || existing.dia,
    hora: payload.hora || existing.hora,
    placa: cleanPlaca,
    foto1: payload.foto1Base64
      ? (payload.foto1Base64.startsWith('data:') ? payload.foto1Base64 : `data:image/jpeg;base64,${payload.foto1Base64}`)
      : existing.foto1,
    foto2: payload.foto2Base64
      ? (payload.foto2Base64.startsWith('data:') ? payload.foto2Base64 : `data:image/jpeg;base64,${payload.foto2Base64}`)
      : existing.foto2,
    foto3: payload.foto3Base64
      ? (payload.foto3Base64.startsWith('data:') ? payload.foto3Base64 : `data:image/jpeg;base64,${payload.foto3Base64}`)
      : existing.foto3,
    foto4: payload.foto4Base64
      ? (payload.foto4Base64.startsWith('data:') ? payload.foto4Base64 : `data:image/jpeg;base64,${payload.foto4Base64}`)
      : existing.foto4,
    status: payload.status || existing.status,
  };

  // 1. Gravação imediata e síncrona no LocalStorage
  const updatedRecords = currentRecords.map(r => r.id === id ? updated : r);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao gravar no localStorage:', lsErr);
  }

  // 2. Atualização no CSV nativo com try/catch
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV no dispositivo celular:', csvErr);
  }

  return updated;
}

/**
 * 100% Offline: Exclui um registro do LocalStorage e do Registros.csv
 */
export async function deleteRegistro(id: string): Promise<void> {
  const currentRecords = getLocalRegistros();
  const updatedRecords = currentRecords.filter(r => r.id !== id);

  // 1. Gravação imediata e síncrona no LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao atualizar localStorage na exclusão:', lsErr);
  }

  // 2. Atualiza arquivo Registros.csv no celular com try/catch
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV na exclusão:', csvErr);
  }
}
