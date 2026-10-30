import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Buscar la carpeta de códigos prioritariamente en la raíz del proyecto
const PROJECT_CODES_DIR = path.join(ROOT_DIR, 'codigos_bonsai_bot');
const CWD_CODES_DIR = path.join(process.cwd(), 'codigos_bonsai_bot');
const FALLBACK_CODES_DIR = path.resolve('..', 'bonsai-music-pool', 'codigos_bonsai_bot');

let CODES_DIR = PROJECT_CODES_DIR;
if (!fs.existsSync(CODES_DIR) && fs.existsSync(CWD_CODES_DIR)) {
  CODES_DIR = CWD_CODES_DIR;
} else if (!fs.existsSync(CODES_DIR) && fs.existsSync(FALLBACK_CODES_DIR)) {
  CODES_DIR = FALLBACK_CODES_DIR;
}

const USED_CODES_FILE = path.join(ROOT_DIR, 'config', 'used_codes.json');

const PACK_FILES = {
  'DEC': 'codigos_pack_decembrino.txt',
  'HAL': 'codigos_pack_halloween.txt',
  'VID': 'codigos_pack_videos.txt',
  'CRO': 'codigos_pack_crossover.txt',
  'SMP': 'codigos_pack_samples.txt',
  'DUO': 'codigos_combo_duo.txt',
  'TRIO': 'codigos_combo_trio.txt',
  'VIP': 'codigos_combo_vip.txt'
};

class CodeDispenser {
  constructor() {
    this.usedCodes = this.loadUsedCodes();
  }

  loadUsedCodes() {
    try {
      if (fs.existsSync(USED_CODES_FILE)) {
        return JSON.parse(fs.readFileSync(USED_CODES_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Error cargando used_codes.json:', e.message);
    }
    return {};
  }

  saveUsedCodes() {
    try {
      fs.writeFileSync(USED_CODES_FILE, JSON.stringify(this.usedCodes, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error guardando used_codes.json:', e.message);
    }
  }

  getNextCode(packKey, jid = 'unknown') {
    const fileName = PACK_FILES[packKey];
    if (!fileName) {
      console.error(`Tipo de pack desconocido: ${packKey}`);
      return null;
    }

    const filePath = path.join(CODES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`Archivo de códigos no encontrado: ${filePath}`);
      return null;
    }

    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (!this.usedCodes[line]) {
        // Asignar código
        this.usedCodes[line] = {
          jid,
          packKey,
          assignedAt: new Date().toISOString()
        };
        this.saveUsedCodes();
        console.log(`🎟️ Código entregado a ${jid}: ${line} (Pack: ${packKey})`);
        return line;
      }
    }

    console.error(`⚠️ Se agotaron los códigos en: ${fileName}`);
    return null;
  }
}

export const codeDispenser = new CodeDispenser();
