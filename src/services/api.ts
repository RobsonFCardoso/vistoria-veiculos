import { Registro, RegistroFormData } from '../types';

export async function fetchRegistros(): Promise<Registro[]> {
  const res = await fetch('/api/registros');
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao carregar registros');
  }
  return data.data;
}

export async function fetchRegistroById(id: string): Promise<Registro> {
  const res = await fetch(`/api/registros/${id}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Registro não encontrado');
  }
  return data.data;
}

export async function createRegistro(payload: RegistroFormData): Promise<Registro> {
  const res = await fetch('/api/registros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao criar registro');
  }
  return data.data;
}

export async function updateRegistro(id: string, payload: Partial<RegistroFormData>): Promise<Registro> {
  const res = await fetch(`/api/registros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao atualizar registro');
  }
  return data.data;
}

export async function deleteRegistro(id: string): Promise<void> {
  const res = await fetch(`/api/registros/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao excluir registro');
  }
}
