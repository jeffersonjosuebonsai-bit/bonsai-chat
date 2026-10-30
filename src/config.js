import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const ROOT_CONFIG = path.join(ROOT_DIR, 'config', 'default_business.json');
const CWD_CONFIG = path.join(process.cwd(), 'config', 'default_business.json');
const CONFIG_PATH = fs.existsSync(ROOT_CONFIG) ? ROOT_CONFIG : CWD_CONFIG;

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
