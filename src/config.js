import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'config', 'default_business.json');

export function getBusinessConfig() {
  try {
    const rawData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('⚠️ Error al leer default_business.json:', error.message);
    throw error;
  }
}

export function updateBusinessConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    console.log('✅ Configuración del negocio actualizada correctamente.');
  } catch (error) {
    console.error('⚠️ Error al guardar configuración:', error.message);
  }
}
