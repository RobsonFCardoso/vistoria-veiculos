export type RegistroStatus = 'APROVADO' | 'REPROVADO';

export interface Registro {
  id: string;
  nomeBlitz?: string;
  dia: string;
  hora: string;
  placa: string;
  foto1: string;
  foto2: string;
  status: RegistroStatus;
}

export interface RegistroFormData {
  nomeBlitz?: string;
  dia: string;
  hora: string;
  placa: string;
  status: RegistroStatus;
  foto1Base64?: string;
  foto2Base64?: string;
  foto1Existing?: string;
  foto2Existing?: string;
}

export type ActiveView = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'edit'; id: string }
  | { type: 'view'; id: string };

export interface StorageFile {
  fileName: string;
  filePath: string;
  url: string;
  size: number;
  modifiedAt: string;
}

export interface StorageFolder {
  folderName: string;
  folderPath: string;
  files: StorageFile[];
}
