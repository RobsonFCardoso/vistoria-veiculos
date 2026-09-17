import { Registro, RegistroFormData } from '../types';
import { savePhotoToMobileDownload, isNativeMobile } from '../utils/mobileStorage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const STORAGE_KEY = 'registros_vistorias';

const INITIAL_DEMO_REGISTROS: Registro[] = [
  {
    id: '1',
    nomeBlitz: 'Operação Trânsito Seguro',
    dia: '2026-09-17',
    hora: '09:15',
    placa: 'BRA2E19',
    foto1: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="%231e293b" width="600" height="400"/><text fill="%23ffffff" font-family="sans-serif" font-size="26" font-weight="bold" x="50%25" y="45%25" text-anchor="middle">VISTORIA BRA2E19 - FRENTE</text><text fill="%2334d399" font-family="sans-serif" font-size="18" font-weight="bold" x="50%25" y="58%25" text-anchor="middle">STATUS: APROVADO</text></svg>',
    foto2: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="%231e293b" width="600" height="400"/><text fill="%23ffffff" font-family="sans-serif" font-size="26" font-weight="bold" x="50%25" y="45%25" text-anchor="middle">VISTORIA BRA2E19 - TRASEIRA</text><text fill="%2334d399" font-family="sans-serif" font-size="18" font-weight="bold" x="50%25" y="58%25" text-anchor="middle">SEM AVARIAS</text></svg>',
    status: 'APROVADO',
  },
  {
    id: '2',
    nomeBlitz: 'Fiscalização Integrada',
    dia: '2026-09-17',
    hora: '10:40',
    placa: 'RIO4A22',
    foto1: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="%23334155" width="600" height="400"/><text fill="%23ffffff" font-family="sans-serif" font-size="26" font-weight="bold" x="50%25" y="45%25" text-anchor="middle">VISTORIA RIO4A22 - FRENTE</text><text fill="%23f87171" font-family="sans-serif" font-size="18" font-weight="bold" x="50%25" y="58%25" text-anchor="middle">STATUS: REPROVADO</text></svg>',
    foto2: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="%23334155" width="600" height="400"/><text fill="%23ffffff" font-family="sans-serif" font-size="26" font-weight="bold" x="50%25" y="45%25" text-anchor="middle">VISTORIA RIO4A22 - LATERAL</text><text fill="%23f87171" font-family="sans-serif" font-size="18" font-weight="bold" x="50%25" y="58%25" text-anchor="middle">AVARIA CONSTATADA</text></svg>',
    status: 'REPROVADO',
  },
];

/**
 * Formata a lista de registros no padrão CSV solicitado: ID,Placa,Status,Data,Fotos
 */
export function formatRegistrosToCsv(records: Registro[]): string {
  const header = 'ID,Placa,Status,Data,Fotos';
  const rows = records.map(r => {
    const dataStr = r.hora ? `${r.dia} ${r.hora}` : r.dia;
    const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanId = String(r.id).trim();
    const foto1Name = `(${cleanId}_${cleanPlaca})_foto1.jpg`;
    const foto2Name = `(${cleanId}_${cleanPlaca})_foto2.jpg`;
    const fotosStr = `${foto1Name};${foto2Name}`;
    return `${cleanId},${cleanPlaca},${r.status},${dataStr},${fotosStr}`;
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Se estiver vazio pela primeira vez, inicializa com registros modelo
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_REGISTROS));
    writeRegistrosCsvToDevice(INITIAL_DEMO_REGISTROS).catch(() => {});
    return INITIAL_DEMO_REGISTROS;
  } catch (err) {
    console.error('Erro ao ler registros do LocalStorage:', err);
    return INITIAL_DEMO_REGISTROS;
  }
}

/**
 * 100% Offline: Lê os registros mantidos no LocalStorage (chave 'registros_vistorias')
 */
export async function fetchRegistros(): Promise<Registro[]> {
  const records = getLocalRegistros();
  // Assegura que o arquivo CSV esteja sincronizado com o dispositivo
  writeRegistrosCsvToDevice(records).catch(() => {});
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
 * - Salva objeto completo no array em localStorage ('registros_vistorias')
 * - Grava as fotos no celular em Download/RegistroFotos/(ID_PLACA)
 * - Atualiza o arquivo Registros.csv no celular
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

  const foto1Val = payload.foto1Base64
    ? (payload.foto1Base64.startsWith('data:') ? payload.foto1Base64 : `data:image/jpeg;base64,${payload.foto1Base64}`)
    : (payload.foto1Existing || '');

  const foto2Val = payload.foto2Base64
    ? (payload.foto2Base64.startsWith('data:') ? payload.foto2Base64 : `data:image/jpeg;base64,${payload.foto2Base64}`)
    : (payload.foto2Existing || '');

  const newRecord: Registro = {
    id: nextId,
    nomeBlitz: payload.nomeBlitz?.trim() || 'Operação de Vistoria',
    dia: payload.dia,
    hora: payload.hora,
    placa: cleanPlaca,
    foto1: foto1Val,
    foto2: foto2Val,
    status: payload.status,
  };

  const updatedRecords = [newRecord, ...currentRecords];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));

  // Atualiza arquivo Registros.csv na memória do celular
  await writeRegistrosCsvToDevice(updatedRecords);

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
    status: payload.status || existing.status,
  };

  const updatedRecords = currentRecords.map(r => r.id === id ? updated : r);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));

  await writeRegistrosCsvToDevice(updatedRecords);

  return updated;
}

/**
 * 100% Offline: Exclui um registro do LocalStorage e do Registros.csv
 */
export async function deleteRegistro(id: string): Promise<void> {
  const currentRecords = getLocalRegistros();
  const updatedRecords = currentRecords.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));

  // Atualiza arquivo Registros.csv no celular
  await writeRegistrosCsvToDevice(updatedRecords);
}
