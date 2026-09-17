import { jsPDF } from 'jspdf';
import { Registro } from '../types';

// Helper to convert an image URL or relative path into a Base64 data string for jsPDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // If it's already a base64 data URL
    if (url.startsWith('data:image')) {
      return url;
    }

    // Ensure proper URL path
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await fetch(cleanUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Não foi possível carregar a imagem para o PDF:', err);
    return null;
  }
}

export async function generateVehicleReportPDF(registro: Registro): Promise<{ doc: jsPDF; blob: Blob; fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const isAprovado = registro.status === 'APROVADO';
  const primaryColor = isAprovado ? [22, 101, 52] : [153, 27, 27]; // Emerald 800 or Red 800
  const fileName = `Vistoria_${registro.placa}_ID${registro.id}.pdf`;

  // Top Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE VISTORIA VEICULAR', 105, 12, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('SISTEMA INTEGRADO DE REGISTRO E INSPEÇÃO', 105, 19, { align: 'center' });

  // Status Stamp Box
  const statusBoxY = 36;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.8);
  doc.setFillColor(isAprovado ? 240 : 254, isAprovado ? 253 : 242, isAprovado ? 244 : 242);
  doc.roundedRect(14, statusBoxY, 182, 22, 3, 3, 'FD');

  doc.setFontSize(11);
  doc.setTextColor(70, 70, 70);
  doc.text('RESULTADO DA AVALIAÇÃO TÉCNICA:', 20, statusBoxY + 14);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(registro.status, 190, statusBoxY + 15, { align: 'right' });

  // Vehicle Information Grid
  const gridY = 66;
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, gridY, 182, 40, 2, 2, 'FD');

  // Field: ID
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ID REGISTRO', 22, gridY + 10);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`#${registro.id}`, 22, gridY + 18);

  // Field: Placa
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PLACA DO VEÍCULO', 70, gridY + 10);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(registro.placa.toUpperCase(), 70, gridY + 18);

  // Field: Data
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA DA VISTORIA', 130, gridY + 10);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(registro.dia, 130, gridY + 18);

  // Field: Hora
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('HORA DO REGISTRO', 22, gridY + 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(registro.hora, 22, gridY + 35);

  // Field: Arquivo Fonte / Blitz
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('NOME BLITZ', 70, gridY + 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(registro.nomeBlitz || '—', 70, gridY + 35);

  // Field: Emissão
  const now = new Date();
  const emitidoEm = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('EMISSÃO DO LAUDO', 130, gridY + 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(emitidoEm, 130, gridY + 35);

  // Section: Photos Title
  const photoSectionY = 114;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('REGISTRO FOTOGRÁFICO OBRIGATÓRIO (FOTO 1 E FOTO 2)', 14, photoSectionY);

  // Load photos
  const foto1Base64 = await loadImageAsBase64(registro.foto1);
  const foto2Base64 = await loadImageAsBase64(registro.foto2);

  const imgWidth = 86;
  const imgHeight = 62;
  const imgY = photoSectionY + 6;

  // Photo 1 Slot
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, imgY, imgWidth, imgHeight, 2, 2, 'FD');

  if (foto1Base64) {
    try {
      doc.addImage(foto1Base64, 'JPEG', 15, imgY + 1, imgWidth - 2, imgHeight - 2);
    } catch {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Foto 1 (Armazenada no servidor)', 14 + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Foto 1 não anexada', 14 + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' });
  }

  // Label 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`FOTO 1: (${registro.id}_${registro.placa})_foto1.jpg`, 14, imgY + imgHeight + 6);

  // Photo 2 Slot
  const img2X = 110;
  doc.roundedRect(img2X, imgY, imgWidth, imgHeight, 2, 2, 'FD');

  if (foto2Base64) {
    try {
      doc.addImage(foto2Base64, 'JPEG', img2X + 1, imgY + 1, imgWidth - 2, imgHeight - 2);
    } catch {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Foto 2 (Armazenada no servidor)', img2X + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Foto 2 não anexada', img2X + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' });
  }

  // Label 2
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`FOTO 2: (${registro.id}_${registro.placa})_foto2.jpg`, img2X, imgY + imgHeight + 6);

  // Storage confirmation notes
  const footerNoteY = imgY + imgHeight + 16;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerNoteY, 196, footerNoteY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`Diretório das fotos: RegistroFotos/(${registro.id}_${registro.placa})/`, 14, footerNoteY + 7);
  doc.text('Documento gerado eletronicamente com validação de conformidade técnica.', 14, footerNoteY + 12);

  // Signatures
  const sigY = 240;
  doc.setDrawColor(148, 163, 184);
  doc.line(20, sigY, 90, sigY);
  doc.line(120, sigY, 190, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Assinatura do Vistoriador Responsável', 55, sigY + 5, { align: 'center' });
  doc.text('Responsável pelo Recebimento / Cliente', 155, sigY + 5, { align: 'center' });

  // Footer
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 282, 210, 15, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Página 1 de 1 • Registro #${registro.id} • Placa ${registro.placa}`, 105, 290, { align: 'center' });

  const blob = doc.output('blob');
  return { doc, blob, fileName };
}

export async function shareViaWhatsApp(registro: Registro): Promise<{
  success: boolean;
  method: 'native' | 'whatsapp-web' | 'cancelled';
  message?: string;
}> {
  const icon = registro.status === 'APROVADO' ? '✅' : '❌';
  const blitzText = registro.nomeBlitz ? `🛡️ *Nome Blitz:* ${registro.nomeBlitz}\n` : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const foto1Url = registro.foto1.startsWith('/') ? registro.foto1 : `/${registro.foto1}`;
  const foto2Url = registro.foto2.startsWith('/') ? registro.foto2 : `/${registro.foto2}`;
  
  const fullFoto1Url = `${origin}${foto1Url}`;
  const fullFoto2Url = `${origin}${foto2Url}`;

  const text = 
`🚗 *RELATÓRIO DE VISTORIA VEICULAR*
━━━━━━━━━━━━━━━━━━━━
📋 *ID do Registro:* #${registro.id}
${blitzText}🚙 *Placa:* ${registro.placa}
📅 *Data:* ${registro.dia}
⏰ *Hora:* ${registro.hora}
${icon} *Status:* *${registro.status}*
━━━━━━━━━━━━━━━━━━━━
📸 *FOTOS DO REGISTRO:*
• *Foto 1:* ${fullFoto1Url}
• *Foto 2:* ${fullFoto2Url}
━━━━━━━━━━━━━━━━━━━━
_Emitido via Sistema de Vistorias e Registros._`;

  // Fetch photos as File objects for Web Share API
  const files: File[] = [];
  try {
    const fetchPhotoAsFile = async (url: string, name: string) => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || 'image/jpeg' });
    };

    const [f1, f2] = await Promise.all([
      fetchPhotoAsFile(foto1Url, `(${registro.id}_${registro.placa})_foto1.jpg`),
      fetchPhotoAsFile(foto2Url, `(${registro.id}_${registro.placa})_foto2.jpg`)
    ]);

    if (f1) files.push(f1);
    if (f2) files.push(f2);
  } catch (err) {
    console.warn('Erro ao carregar arquivos de fotos para compartilhamento:', err);
  }

  // 1. Attempt Native Web Share API with attached photo files (standard on mobile / modern browsers)
  if (navigator.canShare && files.length > 0) {
    try {
      if (navigator.canShare({ files })) {
        await navigator.share({
          title: `Vistoria Veicular - Placa ${registro.placa}`,
          text,
          files,
        });
        return {
          success: true,
          method: 'native',
          message: 'Vistoria e fotos compartilhadas com sucesso!'
        };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return {
          success: false,
          method: 'cancelled',
          message: 'Compartilhamento cancelado.'
        };
      }
      console.warn('Web Share API não completou, usando envio web alternativo:', shareErr);
    }
  }

  // 2. Fallback for environments without file share support (desktop browsers, WhatsApp Web):
  // Automatically trigger photo downloads so the user has the image files immediately ready to attach
  try {
    const downloadPhoto = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    downloadPhoto(foto1Url, `(${registro.id}_${registro.placa})_foto1.jpg`);
    setTimeout(() => {
      downloadPhoto(foto2Url, `(${registro.id}_${registro.placa})_foto2.jpg`);
    }, 400);
  } catch (downloadErr) {
    console.warn('Erro ao disparar download das fotos:', downloadErr);
  }

  // Open WhatsApp with complete formatted text and direct links to the photos
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');

  return {
    success: true,
    method: 'whatsapp-web',
    message: 'WhatsApp aberto com dados e fotos preparadas!'
  };
}
