import { Registro, RegistroFormData } from '../types';
import { 
  isNativeMobile, 
  getDeviceRegistros, 
  createDeviceRegistro, 
  updateDeviceRegistro, 
  deleteDeviceRegistro 
} from './androidStorage';

export async function fetchRegistros(): Promise<Registro[]> {
  if (isNativeMobile()) {
    return await getDeviceRegistros();
  }

  try {
    const res = await fetch('/api/registros');
    const data = await res.json();
    if (res.ok && data.success) {
      return data.data;
    }
  } catch {
    // Modo offline ou sem servidor
  }

  return await getDeviceRegistros();
}

export async function fetchRegistroById(id: string): Promise<Registro> {
  const records = await fetchRegistros();
  const found = records.find(r => r.id === id);
  if (!found) {
    throw new Error('Registro não encontrado');
  }
  return found;
}

export async function createRegistro(payload: RegistroFormData): Promise<Registro> {
  if (isNativeMobile()) {
    return await createDeviceRegistro(payload);
  }

  try {
    const res = await fetch('/api/registros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Salva também localmente para consistência
      try {
        await createDeviceRegistro(payload);
      } catch {}
      return data.data;
    }
  } catch {
    // Servidor inacessível
  }

  return await createDeviceRegistro(payload);
}

export async function updateRegistro(id: string, payload: Partial<RegistroFormData>): Promise<Registro> {
  if (isNativeMobile()) {
    return await updateDeviceRegistro(id, payload);
  }

  try {
    const res = await fetch(`/api/registros/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      try {
        await updateDeviceRegistro(id, payload);
      } catch {}
      return data.data;
    }
  } catch {
    // Servidor inacessível
  }

  return await updateDeviceRegistro(id, payload);
}

export async function deleteRegistro(id: string): Promise<void> {
  if (isNativeMobile()) {
    return await deleteDeviceRegistro(id);
  }

  try {
    const res = await fetch(`/api/registros/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      try {
        await deleteDeviceRegistro(id);
      } catch {}
      return;
    }
  } catch {
    // Servidor inacessível
  }

  return await deleteDeviceRegistro(id);
}
