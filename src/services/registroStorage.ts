import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Registro, RegistroFormData, StorageFolder } from '../types';

export const STORAGE_KEY = 'registros_vistorias';
export const CSV_FILENAME = 'Registros.csv';
export const CSV_HEADER = 'ID;NOME_BLITZ;DIA;HORA;PLACA;FOTO1;FOTO2;STATUS';
export const ROOT_PHOTOS_DIR = 'Download/RegistroFoto';

const WEB_PHOTO_PREFIX = 'data:image/jpeg;base64,';

export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function requestAndroidPermissions() {
  if (!isNativeMobile()) return { camera: true, storage: true };

  let camera = true;
  let storage = true;
  try {
    const result = await Camera.requestPermissions();
    camera = result.camera === 'granted';
  } catch (error) {
    console.warn('Permissão de câmera:', error);
  }

  try {
    const result = await Filesystem.requestPermissions();
    storage = result.publicStorage === 'granted';
  } catch (error) {
    console.warn('Permissão de armazenamento:', error);
  }

  return { camera, storage };
}

export function sanitizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function csvEscape(value: string): string {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function getPhotoFolder(plate: string): string {
  return sanitizePlate(plate);
}

export function getPhotoFileName(recordId: string, photoIndex: 1 | 2): string {
  return `ID${String(recordId).trim()}_foto${photoIndex}.jpg`;
}

export function getPhotoPath(recordId: string, plate: string, photoIndex: 1 | 2): string {
  return `${ROOT_PHOTOS_DIR}/${getPhotoFolder(plate)}/${getPhotoFileName(recordId, photoIndex)}`;
}

export function formatRegistrosToCsv(records: Registro[]): string {
  const rows = records.map(record => [
    record.id,
    record.nomeBlitz || '',
    record.dia,
    record.hora,
    sanitizePlate(record.placa),
    record.foto1,
    record.foto2,
    record.status,
  ].map(csvEscape).join(';'));

  return [CSV_HEADER, ...rows].join('\n') + '\n';
}

function normalizePhotoValue(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  return value;
}

function readStoredRecords(): Registro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: Registro) => ({
      ...r,
      nomeBlitz: r.nomeBlitz || '',
      dia: r.dia || '',
      hora: r.hora || '',
      placa: sanitizePlate(r.placa || ''),
      foto1: normalizePhotoValue(r.foto1),
      foto2: normalizePhotoValue(r.foto2),
      status: r.status === 'REPROVADO' ? 'REPROVADO' : 'APROVADO',
    }));
  } catch (error) {
    console.warn('Não foi possível ler os registros locais:', error);
    return [];
  }
}

function writeStoredRecords(records: Registro[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getLocalRegistros(): Registro[] {
  return readStoredRecords();
}

async function writeExternalFile(path: string, data: string) {
  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.ExternalStorage,
    recursive: true,
  });
}

export async function writeRegistrosCsvToDevice(records: Registro[]): Promise<string> {
  const csv = formatRegistrosToCsv(records);
  if (isNativeMobile()) {
    await writeExternalFile(`Download/${CSV_FILENAME}`, csv);
  }
  return csv;
}

async function ensurePhotoFolder(plate: string) {
  if (!isNativeMobile()) return;
  await Filesystem.mkdir({
    path: `${ROOT_PHOTOS_DIR}/${getPhotoFolder(plate)}`,
    directory: Directory.ExternalStorage,
    recursive: true,
  });
}

function base64Only(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export async function savePhotoToMobileDownload(
  recordId: string,
  plate: string,
  photoIndex: 1 | 2,
  base64Data: string,
): Promise<{ success: boolean; path: string }> {
  const cleanPlate = sanitizePlate(plate);
  const path = getPhotoPath(recordId, cleanPlate, photoIndex);

  if (!isNativeMobile()) {
    return { success: true, path };
  }

  await ensurePhotoFolder(cleanPlate);
  await writeExternalFile(path, base64Only(base64Data));
  return { success: true, path };
}

async function deleteFile(path: string) {
  if (!isNativeMobile()) return;
  try {
    await Filesystem.deleteFile({ path, directory: Directory.ExternalStorage });
  } catch {
    // O arquivo pode não existir.
  }
}

async function removePhotoFiles(record: Registro, plate = record.placa) {
  await Promise.all([
    deleteFile(getPhotoPath(record.id, plate, 1)),
    deleteFile(getPhotoPath(record.id, plate, 2)),
  ]);
}

async function removeEmptyPlateFolder(plate: string) {
  if (!isNativeMobile()) return;
  try {
    await Filesystem.rmdir({
      path: `${ROOT_PHOTOS_DIR}/${getPhotoFolder(plate)}`,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
  } catch {
    // Mantém a pasta se houver outros arquivos/registros.
  }
}

async function migrateLegacyRecordPhotos(records: Registro[]): Promise<Registro[]> {
  if (!isNativeMobile()) return records;

  let changed = false;
  const migrated = [] as Registro[];

  for (const record of records) {
    const next = { ...record };
    for (const index of [1, 2] as const) {
      const current = index === 1 ? record.foto1 : record.foto2;
      if (!current || current.startsWith(ROOT_PHOTOS_DIR + '/')) continue;
      if (!current.startsWith('data:')) continue;

      try {
        const saved = await savePhotoToMobileDownload(record.id, record.placa, index, current);
        if (index === 1) next.foto1 = saved.path;
        else next.foto2 = saved.path;
        changed = true;
      } catch (error) {
        console.warn(`Falha ao migrar foto ${index} do registro #${record.id}:`, error);
      }
    }
    migrated.push(next);
  }

  if (changed) writeStoredRecords(migrated);
  return migrated;
}

export async function fetchRegistros(): Promise<Registro[]> {
  let records = getLocalRegistros();
  records = await migrateLegacyRecordPhotos(records);
  await writeRegistrosCsvToDevice(records);
  return records;
}

export async function fetchRegistroById(id: string): Promise<Registro> {
  const record = getLocalRegistros().find(r => r.id === id);
  if (!record) throw new Error(`Registro com ID #${id} não encontrado.`);
  return record;
}

function nextRecordId(records: Registro[]): string {
  let max = 0;
  for (const record of records) {
    const number = Number.parseInt(record.id, 10);
    if (Number.isFinite(number)) max = Math.max(max, number);
  }
  return String(max + 1);
}

function photoValueForRecord(path: string, fallbackBase64?: string): string {
  if (fallbackBase64) return isNativeMobile() ? path : fallbackBase64;
  return path;
}

export async function createRegistro(payload: RegistroFormData): Promise<Registro> {
  const records = getLocalRegistros();
  const id = nextRecordId(records);
  const plate = sanitizePlate(payload.placa);

  if (!payload.foto1Base64 || !payload.foto2Base64) {
    throw new Error('As duas fotos são obrigatórias para concluir a vistoria.');
  }

  const saved1 = await savePhotoToMobileDownload(id, plate, 1, payload.foto1Base64);
  const saved2 = await savePhotoToMobileDownload(id, plate, 2, payload.foto2Base64);

  const record: Registro = {
    id,
    nomeBlitz: payload.nomeBlitz?.trim() || '',
    dia: payload.dia,
    hora: payload.hora,
    placa: plate,
    foto1: photoValueForRecord(saved1.path, payload.foto1Base64),
    foto2: photoValueForRecord(saved2.path, payload.foto2Base64),
    status: payload.status,
  };

  const updated = [record, ...records];
  writeStoredRecords(updated);
  await writeRegistrosCsvToDevice(updated);
  return record;
}

export async function updateRegistro(id: string, payload: Partial<RegistroFormData>): Promise<Registro> {
  const records = getLocalRegistros();
  const existing = records.find(r => r.id === id);
  if (!existing) throw new Error(`Registro com ID #${id} não encontrado.`);

  const oldPlate = existing.placa;
  const newPlate = sanitizePlate(payload.placa || existing.placa);
  let foto1 = existing.foto1;
  let foto2 = existing.foto2;

  if (payload.foto1Base64) {
    const saved = await savePhotoToMobileDownload(id, newPlate, 1, payload.foto1Base64);
    foto1 = photoValueForRecord(saved.path, payload.foto1Base64);
  }
  if (payload.foto2Base64) {
    const saved = await savePhotoToMobileDownload(id, newPlate, 2, payload.foto2Base64);
    foto2 = photoValueForRecord(saved.path, payload.foto2Base64);
  }

  const updatedRecord: Registro = {
    ...existing,
    nomeBlitz: payload.nomeBlitz !== undefined ? payload.nomeBlitz.trim() : existing.nomeBlitz,
    dia: payload.dia || existing.dia,
    hora: payload.hora || existing.hora,
    placa: newPlate,
    foto1,
    foto2,
    status: payload.status || existing.status,
  };

  if (isNativeMobile() && oldPlate !== newPlate) {
    await removePhotoFiles(existing, oldPlate);
  }

  const updated = records.map(r => r.id === id ? updatedRecord : r);
  writeStoredRecords(updated);
  await writeRegistrosCsvToDevice(updated);
  return updatedRecord;
}

export async function deleteRegistro(id: string): Promise<void> {
  const records = getLocalRegistros();
  const existing = records.find(r => r.id === id);
  if (!existing) return;

  await removePhotoFiles(existing);
  const remaining = records.filter(r => r.id !== id);
  writeStoredRecords(remaining);
  await writeRegistrosCsvToDevice(remaining);

  if (!remaining.some(r => sanitizePlate(r.placa) === sanitizePlate(existing.placa))) {
    await removeEmptyPlateFolder(existing.placa);
  }
}

export async function getPhotoDataUrl(photoPath: string): Promise<string> {
  if (!photoPath) return '';
  if (photoPath.startsWith('data:')) return photoPath;
  if (photoPath.startsWith('blob:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    const response = await fetch(photoPath);
    if (!response.ok) throw new Error('Não foi possível ler a foto.');
    const blob = await response.blob();
    return blobToDataUrl(blob);
  }

  if (!isNativeMobile()) return '';

  const normalized = photoPath.startsWith('/') ? photoPath.slice(1) : photoPath;
  const path = normalized.startsWith('Download/') ? normalized : `Download/${normalized}`;
  const result = await Filesystem.readFile({ path, directory: Directory.ExternalStorage });
  const data = typeof result.data === 'string' ? result.data : '';
  return data ? `${WEB_PHOTO_PREFIX}${data}` : '';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(blob);
  });
}

export async function getNativePhotoUri(record: Registro, photoIndex: 1 | 2): Promise<string> {
  const path = getPhotoPath(record.id, record.placa, photoIndex);

  if (isNativeMobile()) {
    try {
      await Filesystem.stat({ path, directory: Directory.ExternalStorage });
      const result = await Filesystem.getUri({ path, directory: Directory.ExternalStorage });
      return result.uri;
    } catch {
      const data = await getPhotoDataUrl(photoIndex === 1 ? record.foto1 : record.foto2);
      if (!data) throw new Error(`Foto ${photoIndex} não encontrada.`);
      const saved = await savePhotoToMobileDownload(record.id, record.placa, photoIndex, data);
      const result = await Filesystem.getUri({ path: saved.path, directory: Directory.ExternalStorage });
      return result.uri;
    }
  }

  return photoIndex === 1 ? record.foto1 : record.foto2;
}

export async function listLocalFoldersAndFiles(): Promise<StorageFolder[]> {
  const records = getLocalRegistros();
  const byPlate = new Map<string, Registro[]>();
  for (const record of records) {
    const plate = sanitizePlate(record.placa);
    const list = byPlate.get(plate) || [];
    list.push(record);
    byPlate.set(plate, list);
  }

  const folders: StorageFolder[] = [];
  for (const [plate, plateRecords] of byPlate) {
    const files: StorageFolder['files'] = [];
    for (const record of plateRecords) {
      for (const index of [1, 2] as const) {
        const fileName = getPhotoFileName(record.id, index);
        const filePath = getPhotoPath(record.id, plate, index);
        let url = index === 1 ? record.foto1 : record.foto2;
        try {
          const dataUrl = await getPhotoDataUrl(url);
          if (dataUrl) url = dataUrl;
        } catch {
          // Mantém a referência para o explorador.
        }
        files.push({
          fileName,
          filePath,
          url,
          size: 0,
          modifiedAt: `${record.dia}T${record.hora || '00:00'}:00`,
        });
      }
    }

    folders.push({
      folderName: plate,
      folderPath: `${ROOT_PHOTOS_DIR}/${plate}`,
      files,
    });
  }

  return folders;
}

export async function syncAllFoldersToMobileDownload(
  registros: Registro[],
  onProgress?: (current: number, total: number, message: string) => void,
) {
  const total = registros.length * 2;
  let savedCount = 0;

  if (isNativeMobile()) {
    for (const record of registros) {
      for (const index of [1, 2] as const) {
        onProgress?.(savedCount + 1, total, `Salvando foto ${index} de ${record.placa}...`);
        const value = index === 1 ? record.foto1 : record.foto2;
        const data = await getPhotoDataUrl(value);
        if (data) {
          await savePhotoToMobileDownload(record.id, record.placa, index, data);
          savedCount++;
        }
      }
    }
    return {
      success: true,
      message: `${savedCount} fotos organizadas em Download/RegistroFoto/.`,
      savedCount,
    };
  }

  return {
    success: true,
    message: 'No navegador, as fotos já estão associadas aos registros locais.',
    savedCount: total,
  };
}

export async function getExportCsvContent(): Promise<string> {
  return formatRegistrosToCsv(getLocalRegistros());
}
