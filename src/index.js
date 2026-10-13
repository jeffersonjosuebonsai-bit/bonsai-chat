import { connectWhatsApp, getActiveSocket } from './whatsapp/client.js';
import { startServer } from './server.js';
import { getBusinessConfig } from './config.js';
import { startRemarketingJob } from './remarketing/remarketingJob.js';

// Protección global de proceso contra fallos inesperados de Puppeteer / red
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Proceso Protegido] Promesa no capturada:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Proceso Protegido] Excepción no capturada:', err?.message || err);
});

const config = getBusinessConfig();

console.log(`
======================================================
         🌱 BONSAI CHAT - EMPLEADO DIGITAL 🌱
======================================================
  Empleado Digital : ${config.empleado_digital.nombre}
  Cargo            : ${config.empleado_digital.cargo}
  Empresa          : ${config.negocio.nombre}
======================================================
`);

// Iniciar servidor API / Webhook
startServer();

// Iniciar cliente de WhatsApp
connectWhatsApp().catch(err => {
  console.error('❌ Error al iniciar conexión de WhatsApp:', err);
});

// Iniciar motor de remarketing (recuperación de leads)
// Pasa getActiveSocket como getter para que siempre use el socket más reciente
startRemarketingJob(getActiveSocket);
