import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Registro, RegistroFormData } from '../types';
import { getCachedPhoto, setCachedPhoto, deleteCachedPhoto } from '../utils/indexedDbCache';

export const CSV_FILENAME = 'Registros.csv';
export const CSV_HEADER = 'ID,Placa,Status,Data,Fotos';
export const ROOT_PHOTOS_DIR = 'Download/RegistroFotos';
export const LOCALSTORAGE_KEY = 'registros_vistorias';

export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Solicita e verifica permissões nativas necessárias no Android (Câmera e Armazenamento)
 */
export async function requestAndroidPermissions(): Promise<{
  camera: boolean;
  storage: boolean;
}> {
  let cameraGranted = true;
  let storageGranted = true;

  if (isNativeMobile()) {
    try {
      const camStatus = await Camera.requestPermissions();
      cameraGranted = camStatus.camera === 'granted';
    } catch (e) {
      console.warn('Erro ao solicitar permissão de câmera:', e);
    }

    try {
      const fsStatus = await Filesystem.requestPermissions();
      storageGranted = fsStatus.publicStorage === 'granted';
    } catch (e) {
      console.warn('Erro ao solicitar permissão de armazenamento:', e);
    }
  }

  return { camera: cameraGranted, storage: storageGranted };
}

/**
 * Verifica se permissões foram concedidas
 */
export async function checkAndroidPermissions(): Promise<{
  camera: boolean;
  storage: boolean;
}> {
  let cameraGranted = true;
  let storageGranted = true;

  if (isNativeMobile()) {
    try {
      const camStatus = await Camera.checkPermissions();
      cameraGranted = camStatus.camera === 'granted';
    } catch {
      cameraGranted = false;
    }

    try {
      const fsStatus = await Filesystem.checkPermissions();
      storageGranted = fsStatus.publicStorage === 'granted';
    } catch {
      storageGranted = false;
    }
  }

  return { camera: cameraGranted, storage: storageGranted };
}

/**
 * Retorna o conteúdo de Registros.csv lido do armazenamento local do aparelho
 */
async function readRawCsvFromDevice(): Promise<string> {
  if (isNativeMobile()) {
    // Tenta primeiro em Directory.ExternalStorage (pasta Download pública)
    try {
      const res = await Filesystem.readFile({
        path: `Download/${CSV_FILENAME}`,
        directory: Directory.ExternalStorage,
      });
      if (typeof res.data === 'string') return res.data;
    } catch {
      // Fallback para Documents caso o dispositivo tenha restrições de permissão pública
      try {
        const res = await Filesystem.readFile({
          path: CSV_FILENAME,
          directory: Directory.Documents,
        });
        if (typeof res.data === 'string') return res.data;
      } catch {
        // Arquivo ainda não existe
      }
    }
  }

  // Fallback para Web / LocalStorage
  const cached = localStorage.getItem(LOCALSTORAGE_KEY);
  if (cached) return cached;

  return '';
}

/**
 * Grava o conteúdo de Registros.csv no armazenamento do celular
 */
async function writeRawCsvToDevice(content: string): Promise<void> {
  // Salva no localStorage como garantia
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, content);
  } catch {}

  if (isNativeMobile()) {
    // 1. Tenta salvar na pasta Download do aparelho
    try {
      await Filesystem.writeFile({
        path: `Download/${CSV_FILENAME}`,
        data: content,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch (err) {
      console.warn('Falha ao escrever em Download/Registros.csv, usando Documents:', err);
    }

    // 2. Salva também em Documents para redundância no sandbox
    try {
      await Filesystem.writeFile({
        path: CSV_FILENAME,
        data: content,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {}
  }
}

/**
 * Inicializa a estrutura de pastas e arquivo CSV no celular se não existirem
 */
export async function initializeDeviceStorage(): Promise<void> {
  let content = await readRawCsvFromDevice();

  if (!content || !content.trim()) {
    content = `${CSV_HEADER}\n`;
    await writeRawCsvToDevice(content);
  }

  if (isNativeMobile()) {
    try {
      await Filesystem.mkdir({
        path: ROOT_PHOTOS_DIR,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch {}
  }
}

/**
 * Salva uma foto no diretório do celular: Download/RegistroFotos/(ID_PLACA)/(ID_PLACA)_fotoX.jpg
 */
export async function saveDevicePhoto(
  recordId: string,
  placa: string,
  photoIndex: 1 | 2,
  base64Data: string
): Promise<string> {
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanId = String(recordId).trim();
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const fileName = `${folderTag}_foto${photoIndex}.jpg`;
  const relativePath = `RegistroFotos/${folderTag}/${fileName}`;

  let rawBase64 = base64Data;
  if (base64Data.includes(',')) {
    rawBase64 = base64Data.split(',')[1];
  }

  // 1. Cache no IndexedDB para carregamento instantâneo offline
  await setCachedPhoto(relativePath, `data:image/jpeg;base64,${rawBase64}`);

  // 2. Gravação física no armazenamento do celular (Capacitor)
  if (isNativeMobile()) {
    const targetFolder = `${ROOT_PHOTOS_DIR}/${folderTag}`;

    try {
      await Filesystem.mkdir({
        path: targetFolder,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch {}

    try {
      await Filesystem.writeFile({
        path: `${targetFolder}/${fileName}`,
        data: rawBase64,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch (err) {
      console.warn('Erro ao gravar em ExternalStorage, tentando Documents:', err);
      try {
        await Filesystem.mkdir({
          path: `RegistroFotos/${folderTag}`,
          directory: Directory.Documents,
          recursive: true,
        });
        await Filesystem.writeFile({
          path: `RegistroFotos/${folderTag}/${fileName}`,
          data: rawBase64,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (errDoc) {
        console.error('Erro crítico ao gravar foto no celular:', errDoc);
      }
    }
  }

  return relativePath;
}

/**
 * Resolve a URL exibível de uma foto no celular (do IndexedDB ou do Filesystem)
 */
export async function resolvePhotoDisplayUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }

  // Verifica cache IndexedDB primeiro
  const cached = await getCachedPhoto(pathOrUrl);
  if (cached) return cached;

  // Se estiver no mobile nativo, lê do Filesystem nativo
  if (isNativeMobile()) {
    try {
      // Normaliza caminho para pasta Download
      const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
      const downloadPath = `Download/${cleanPath}`;

      const fileResult = await Filesystem.readFile({
        path: downloadPath,
        directory: Directory.ExternalStorage,
      });

      if (typeof fileResult.data === 'string') {
        const fullDataUrl = `data:image/jpeg;base64,${fileResult.data}`;
        await setCachedPhoto(pathOrUrl, fullDataUrl);
        return fullDataUrl;
      }
    } catch {
      // Tenta em Documents
      try {
        const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
        const fileResult = await Filesystem.readFile({
          path: cleanPath,
          directory: Directory.Documents,
        });
        if (typeof fileResult.data === 'string') {
          const fullDataUrl = `data:image/jpeg;base64,${fileResult.data}`;
          await setCachedPhoto(pathOrUrl, fullDataUrl);
          return fullDataUrl;
        }
      } catch {}
    }
  }

  // Se estiver rodando com servidor web
  return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
}

/**
 * Lê todos os registros do Registros.csv e LocalStorage no celular
 */
export async function getDeviceRegistros(): Promise<Registro[]> {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao ler do localStorage em getDeviceRegistros:', err);
  }

  await initializeDeviceStorage();
  const csvContent = await readRawCsvFromDevice();

  if (!csvContent || !csvContent.trim()) {
    return [];
  }

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const header = lines[0];
  const delimiter = header.includes(';') ? ';' : '|';
  const headerParts = header.split(delimiter).map(p => p.trim().toUpperCase());

  const blitzIndex = headerParts.findIndex(h => h.includes('BLITZ'));
  const diaIndex = headerParts.indexOf('DIA');
  const horaIndex = headerParts.indexOf('HORA');
  const placaIndex = headerParts.indexOf('PLACA');
  const foto1Index = headerParts.indexOf('FOTO1');
  const foto2Index = headerParts.indexOf('FOTO2');
  const statusIndex = headerParts.indexOf('STATUS');

  const records: Registro[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(delimiter).map(p => p.trim());
    if (parts.length >= 4) {
      let blitzVal = '';
      let diaVal = '';
      let horaVal = '';
      let placaVal = '';
      let foto1Val = '';
      let foto2Val = '';
      let statusVal: 'APROVADO' | 'REPROVADO' = 'APROVADO';

      if (blitzIndex !== -1) {
        blitzVal = parts[blitzIndex] || '';
        diaVal = diaIndex !== -1 ? parts[diaIndex] || '' : '';
        horaVal = horaIndex !== -1 ? parts[horaIndex] || '' : '';
        placaVal = placaIndex !== -1 ? parts[placaIndex] || '' : '';
        foto1Val = foto1Index !== -1 ? parts[foto1Index] || '' : '';
        foto2Val = foto2Index !== -1 ? parts[foto2Index] || '' : '';
        statusVal = (statusIndex !== -1 ? parts[statusIndex] : 'APROVADO') === 'REPROVADO' ? 'REPROVADO' : 'APROVADO';
      } else {
        diaVal = parts[1] || '';
        horaVal = parts[2] || '';
        placaVal = parts[3] || '';
        foto1Val = parts[4] || '';
        foto2Val = parts[5] || '';
        statusVal = parts[6] === 'REPROVADO' ? 'REPROVADO' : 'APROVADO';
      }

      records.push({
        id: parts[0] || String(i),
        nomeBlitz: blitzVal,
        dia: diaVal,
        hora: horaVal,
        placa: placaVal,
        foto1: foto1Val,
        foto2: foto2Val,
        status: statusVal,
      });
    }
  }

  // Resolve as fotos para que possam ser renderizadas offline sem falhas
  for (const rec of records) {
    rec.foto1 = await resolvePhotoDisplayUrl(rec.foto1);
    rec.foto2 = await resolvePhotoDisplayUrl(rec.foto2);
  }

  return records;
}

/**
 * Cria um novo registro e salva no Registros.csv e na pasta Download do celular
 */
export async function createDeviceRegistro(formData: RegistroFormData): Promise<Registro> {
  const currentRecords = await getDeviceRegistros();

  // Determina o próximo ID sequencial
  let maxId = 0;
  for (const r of currentRecords) {
    const numericId = parseInt(r.id, 10);
    if (!isNaN(numericId) && numericId > maxId) {
      maxId = numericId;
    }
  }
  const nextId = String(maxId + 1);

  // Salva as duas fotos no celular
  const foto1Path = await saveDevicePhoto(nextId, formData.placa, 1, formData.foto1Base64);
  const foto2Path = await saveDevicePhoto(nextId, formData.placa, 2, formData.foto2Base64);

  const cleanPlaca = formData.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanBlitz = (formData.nomeBlitz || '').replace(/;/g, ' ').trim();

  // Atualiza arquivo Registros.csv
  const newRow = `${nextId};${cleanBlitz};${formData.dia};${formData.hora};${cleanPlaca};${foto1Path};${foto2Path};${formData.status}`;
  
  const rawCsv = await readRawCsvFromDevice();
  const updatedCsv = (rawCsv ? rawCsv.trim() : CSV_HEADER) + '\n' + newRow + '\n';
  await writeRawCsvToDevice(updatedCsv);

  return {
    id: nextId,
    nomeBlitz: cleanBlitz,
    dia: formData.dia,
    hora: formData.hora,
    placa: cleanPlaca,
    foto1: formData.foto1Base64.startsWith('data:') ? formData.foto1Base64 : `data:image/jpeg;base64,${formData.foto1Base64}`,
    foto2: formData.foto2Base64.startsWith('data:') ? formData.foto2Base64 : `data:image/jpeg;base64,${formData.foto2Base64}`,
    status: formData.status,
  };
}

/**
 * Atualiza um registro existente
 */
export async function updateDeviceRegistro(id: string, payload: Partial<RegistroFormData>): Promise<Registro> {
  const records = await getDeviceRegistros();
  const existing = records.find(r => r.id === id);
  if (!existing) {
    throw new Error(`Registro com ID ${id} não encontrado`);
  }

  let newFoto1Path = existing.foto1;
  let newFoto2Path = existing.foto2;

  const targetPlaca = payload.placa || existing.placa;

  if (payload.foto1Base64) {
    newFoto1Path = await saveDevicePhoto(id, targetPlaca, 1, payload.foto1Base64);
  }
  if (payload.foto2Base64) {
    newFoto2Path = await saveDevicePhoto(id, targetPlaca, 2, payload.foto2Base64);
  }

  const updated: Registro = {
    id,
    nomeBlitz: payload.nomeBlitz !== undefined ? payload.nomeBlitz : existing.nomeBlitz,
    dia: payload.dia || existing.dia,
    hora: payload.hora || existing.hora,
    placa: targetPlaca,
    foto1: payload.foto1Base64 ? (payload.foto1Base64.startsWith('data:') ? payload.foto1Base64 : `data:image/jpeg;base64,${payload.foto1Base64}`) : existing.foto1,
    foto2: payload.foto2Base64 ? (payload.foto2Base64.startsWith('data:') ? payload.foto2Base64 : `data:image/jpeg;base64,${payload.foto2Base64}`) : existing.foto2,
    status: payload.status || existing.status,
  };

  // Reescreve Registros.csv
  const newLines = [CSV_HEADER];
  for (const r of records) {
    if (r.id === id) {
      newLines.push(`${id};${updated.nomeBlitz || ''};${updated.dia};${updated.hora};${updated.placa};${newFoto1Path};${newFoto2Path};${updated.status}`);
    } else {
      newLines.push(`${r.id};${r.nomeBlitz || ''};${r.dia};${r.hora};${r.placa};${r.foto1};${r.foto2};${r.status}`);
    }
  }

  await writeRawCsvToDevice(newLines.join('\n') + '\n');
  return updated;
}

/**
 * Remove um registro e suas fotos
 */
export async function deleteDeviceRegistro(id: string): Promise<void> {
  const records = await getDeviceRegistros();
  const existing = records.find(r => r.id === id);
  if (!existing) return;

  // Remove fotos do IndexedDB
  await deleteCachedPhoto(existing.foto1);
  await deleteCachedPhoto(existing.foto2);

  // Remove pasta do Filesystem nativo se possível
  if (isNativeMobile()) {
    try {
      const cleanPlaca = existing.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const folderTag = `(${id}_${cleanPlaca})`;
      await Filesystem.rmdir({
        path: `${ROOT_PHOTOS_DIR}/${folderTag}`,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch {}
  }

  // Reescreve CSV
  const filtered = records.filter(r => r.id !== id);
  const newLines = [CSV_HEADER];
  for (const r of filtered) {
    newLines.push(`${r.id};${r.nomeBlitz || ''};${r.dia};${r.hora};${r.placa};${r.foto1};${r.foto2};${r.status}`);
  }

  await writeRawCsvToDevice(newLines.join('\n') + '\n');
}

/**
 * Lista as pastas e fotos salvas localmente no celular para o Explorador
 */
export async function listLocalFoldersAndFiles(): Promise<{
  folderName: string;
  folderPath: string;
  files: {
    fileName: string;
    filePath: string;
    url: string;
    size: number;
    modifiedAt: string;
  }[];
}[]> {
  const records = await getDeviceRegistros();
  const folderList: {
    folderName: string;
    folderPath: string;
    files: {
      fileName: string;
      filePath: string;
      url: string;
      size: number;
      modifiedAt: string;
    }[];
  }[] = [];

  for (const r of records) {
    const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const folderName = `(${r.id}_${cleanPlaca})`;
    const folderPath = `Download/RegistroFotos/${folderName}`;

    folderList.push({
      folderName,
      folderPath,
      files: [
        {
          fileName: `${folderName}_foto1.jpg`,
          filePath: `${folderPath}/${folderName}_foto1.jpg`,
          url: r.foto1,
          size: 1024 * 150,
          modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
        },
        {
          fileName: `${folderName}_foto2.jpg`,
          filePath: `${folderPath}/${folderName}_foto2.jpg`,
          url: r.foto2,
          size: 1024 * 150,
          modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
        },
      ],
    });
  }

  return folderList;
}

/**
 * Exporta o arquivo Registros.csv gravado no celular no formato ID,Placa,Status,Data,Fotos
 */
export async function getExportCsvContent(): Promise<string> {
  const records = await getDeviceRegistros();
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
