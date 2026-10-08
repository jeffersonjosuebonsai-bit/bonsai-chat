import express from 'express';
import path from 'path';
import { getBusinessConfig, updateBusinessConfig } from './config.js';
import { SalesAgent } from './ai/salesAgent.js';
import { chatState } from './state/chatState.js';
import { getWhatsAppStatus, connectWhatsApp, resetWhatsAppSession, requestWhatsAppPairingCode } from './whatsapp/client.js';

import fs from 'fs';
import multer from 'multer';

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

const mediaDir = path.join(process.cwd(), 'media');
const demosDir = path.join(mediaDir, 'demos');

if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(demosDir)) fs.mkdirSync(demosDir, { recursive: true });

app.use('/media', express.static(mediaDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', 'inline');
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.opus')) res.setHeader('Content-Type', 'audio/opus');
    if (lower.endsWith('.ogg')) res.setHeader('Content-Type', 'audio/ogg');
    if (lower.endsWith('.m4a')) res.setHeader('Content-Type', 'audio/mp4');
    if (lower.endsWith('.mp3') || lower.endsWith('.mpeg') || lower.endsWith('.mpg')) res.setHeader('Content-Type', 'audio/mpeg');
    if (lower.endsWith('.wav')) res.setHeader('Content-Type', 'audio/wav');
  }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaType = req.body.mediaType || 'general';
    if (mediaType === 'demo') {
      cb(null, demosDir);
    } else {
      cb(null, mediaDir);
    }
  },
  filename: (req, file, cb) => {
    const mediaType = req.body.mediaType || 'general';
    const ext = path.extname(file.originalname).toLowerCase();

    if (mediaType === 'agradecimiento') {
      cb(null, 'agradecimiento' + (ext || '.jpg'));
    } else if (mediaType === 'tutorial') {
      cb(null, 'tutorial' + (ext || '.mp4'));
    } else if (mediaType === 'video_demo') {
      cb(null, 'video_demo' + (ext || '.mp4'));
    } else if (mediaType === 'demo') {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, 'demo_' + Date.now() + '_' + safeName);
    } else {
      cb(null, Date.now() + '_' + file.originalname);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB max per video/audio
});

app.get('/api/media/list', (req, res) => {
  try {
    const mainFiles = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
    const demoFiles = fs.existsSync(demosDir) ? fs.readdirSync(demosDir) : [];

    const mediaList = [];

    mainFiles.forEach(f => {
      const fullPath = path.join(mediaDir, f);
      if (fs.statSync(fullPath).isFile()) {
        const lower = f.toLowerCase();
        let cat = 'demo';
        if (f.startsWith('agradecimiento') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
          cat = 'agradecimiento';
        } else if (f.startsWith('tutorial')) {
          cat = 'tutorial';
        } else if (f.startsWith('video_demo')) {
          cat = 'video_demo';
        } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
          cat = 'tutorial';
        }

        mediaList.push({
          name: f,
          category: cat,
          url: `/media/${f}`,
          size: fs.statSync(fullPath).size
        });
      }
    });

    demoFiles.forEach(f => {
      const fullPath = path.join(demosDir, f);
      if (fs.statSync(fullPath).isFile()) {
        mediaList.push({
          name: f,
          category: 'demo',
          url: `/media/demos/${f}`,
          size: fs.statSync(fullPath).size
        });
      }
    });

    res.json({ success: true, media: mediaList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/media/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
    }
    res.json({
      success: true,
      message: 'Archivo subido exitosamente.',
      file: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/media/delete', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, error: 'Falta filename' });

    const fileInMedia = path.join(mediaDir, filename);
    const fileInDemos = path.join(demosDir, filename);

    let deleted = false;

    if (fs.existsSync(fileInMedia) && fs.statSync(fileInMedia).isFile()) {
      fs.unlinkSync(fileInMedia);
      deleted = true;
    }

    if (fs.existsSync(fileInDemos) && fs.statSync(fileInDemos).isFile()) {
      fs.unlinkSync(fileInDemos);
      deleted = true;
    }

    if (deleted) {
      res.json({ success: true, message: 'Archivo eliminado correctamente.' });
    } else {
      res.status(404).json({ success: false, error: 'El archivo no fue encontrado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const salesAgent = new SalesAgent();

app.get('/api/config', (req, res) => {
  try {
    const config = getBusinessConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    updateBusinessConfig(newConfig);
    res.json({ success: true, message: 'Configuración actualizada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/simulate-chat', async (req, res) => {
  const { jid, message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: 'Falta el campo message' });
  }
  const chatId = jid || 'simulated_user';
  const lower = message.toLowerCase();
  
  const lowerNorm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isVideoKeyword = lowerNorm.includes('video') || lowerNorm.includes('carpetas') || lowerNorm.includes('ver');
  const isDemoKeyword = lowerNorm.includes('demo') || lowerNorm.includes('muestra') || lowerNorm.includes('escuchar') || lowerNorm.includes('probador') || lowerNorm.includes('audio') || isVideoKeyword;
  const isPaymentKeyword = lowerNorm.includes('comprobante') || lowerNorm.includes('ya pague') || lowerNorm.includes('ya transferi') || lowerNorm.includes('pago listo') || lowerNorm.includes('captura');

  const attachedMedia = [];

  if (isDemoKeyword) {
    const mainFiles = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
    const demoFiles = fs.existsSync(demosDir) ? fs.readdirSync(demosDir) : [];
    
    demoFiles.forEach(f => {
      attachedMedia.push({ type: 'audio', name: f, url: `/media/demos/${f}` });
    });
    mainFiles.forEach(f => {
      const fullPath = path.join(mediaDir, f);
      if (fs.statSync(fullPath).isFile()) {
        const lowerF = f.toLowerCase();
        const isVid = lowerF.endsWith('.mp4') || lowerF.endsWith('.webm') || lowerF.endsWith('.mov');
        const isImg = lowerF.endsWith('.jpg') || lowerF.endsWith('.jpeg') || lowerF.endsWith('.png') || lowerF.endsWith('.webp');

        if (isVid && !f.startsWith('tutorial')) {
          attachedMedia.push({ 
            type: 'video', 
            name: f, 
            url: `/media/${f}`, 
            caption: '🎥 Vista Previa: Así vienen organizadas nuestras 60 carpetas' 
          });
        } else if (!isVid && !isImg && !f.startsWith('agradecimiento')) {
          attachedMedia.push({ type: 'audio', name: f, url: `/media/${f}` });
        }
      }
    });
  }

  if (isPaymentKeyword) {
    const mainFiles = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
    mainFiles.forEach(f => {
      if (f.startsWith('agradecimiento')) {
        attachedMedia.push({ type: 'image', name: f, url: `/media/${f}`, caption: '🖼️ Tarjeta de Agradecimiento' });
      }
      if (f.startsWith('tutorial')) {
        attachedMedia.push({ type: 'video', name: f, url: `/media/${f}`, caption: '🎥 Video Tutorial de Descarga' });
      }
    });
  }

  const reply = await salesAgent.generateResponse(chatId, message);
  res.json({
    success: true,
    jid: chatId,
    userMessage: message,
    botReply: reply,
    attachedMedia
  });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    connectWhatsApp().catch(err => console.error('Error iniciando WhatsApp:', err));
    res.json({ success: true, message: 'Iniciando conexión WhatsApp. Generando código QR...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/reset', async (req, res) => {
  try {
    resetWhatsAppSession().catch(err => console.error('Error reiniciando WhatsApp:', err));
    res.json({ success: true, message: 'Reiniciando sesión de WhatsApp. Generando nuevo código QR...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/pairing-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Por favor ingresa tu número de teléfono' });
    }
    const result = await requestWhatsAppPairingCode(phoneNumber);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error al solicitar código de emparejamiento' });
  }
});

app.get('/api/whatsapp-status', (req, res) => {
  try {
    const status = getWhatsAppStatus ? getWhatsAppStatus() : { isConnected: false, qrDataUrl: null };
    res.json({ success: true, ...status });
  } catch (err) {
    res.json({ success: true, isConnected: false, qrDataUrl: null });
  }
});

app.get('/api/status', (req, res) => {
  const config = getBusinessConfig();
  const status = getWhatsAppStatus ? getWhatsAppStatus() : { isConnected: false, qrDataUrl: null };
  res.json({
    success: true,
    linea_id: config.linea_id,
    empleado_digital: config.empleado_digital.nombre,
    cargo: config.empleado_digital.cargo,
    negocio: config.negocio.nombre,
    gemini_key_presente: salesAgent.isValidKey,
    whatsapp_conectado: status.isConnected,
    qrDataUrl: status.qrDataUrl
  });
});

export function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🌐 Panel de Bonsai Chat listo en http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`🌐 El puerto ${PORT} ya está en uso por el servidor de Bonsai Chat.`);
    } else {
      console.error('Error en servidor Express:', err);
    }
  });
  return server;
}
