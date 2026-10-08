import readline from 'readline';
import dotenv from 'dotenv';
import { SalesAgent } from './ai/salesAgent.js';
import { getBusinessConfig } from './config.js';

dotenv.config();

const config = getBusinessConfig();
const salesAgent = new SalesAgent();
const testJid = 'cliente_prueba_01';

console.log(`
======================================================
     🧪 SIMULADOR DE PRUEBAS - BONSAI CHAT 🧪
======================================================
  Empleado  : ${config.empleado_digital.nombre}
  Cargo     : ${config.empleado_digital.cargo}
  Negocio   : ${config.negocio.nombre}
======================================================
Simula una conversación como si fueras un cliente en WhatsApp.
Escribe 'salir' para cerrar el simulador.
------------------------------------------------------
`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function promptUser() {
  rl.question('👤 Cliente: ', async (userInput) => {
    if (userInput.toLowerCase().trim() === 'salir') {
      rl.close();
      return;
    }

    if (!userInput.trim()) {
      promptUser();
      return;
    }

    console.log('🤖 Generando respuesta de Juan Camilo...');
    const reply = await salesAgent.generateResponse(testJid, userInput);
    console.log(`\n🤖 ${config.empleado_digital.nombre}: ${reply}\n`);
    promptUser();
  });
}

promptUser();
