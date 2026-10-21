export function detectPackFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Mega Combo VIP
  if (t.includes('mega combo vip') || t.includes('combo vip') || (t.includes('vip') && (t.includes('35') || t.includes('todos')))) {
    return { key: 'VIP', name: 'Mega Combo VIP (Todos los Packs)' };
  }

  // Combo Trío
  if (t.includes('combo trio') || (t.includes('trio') && t.includes('20'))) {
    return { key: 'TRIO', name: 'Combo Trío (3 Packs)' };
  }

  // Combo Dúo
  if (t.includes('combo duo') || (t.includes('duo') && t.includes('15'))) {
    return { key: 'DUO', name: 'Combo Dúo (2 Packs)' };
  }

  // Packs individuales
  if (t.includes('decembrin') || t.includes('navidad') || t.includes('naviden') || t.includes('diciembre') || t.includes('parranda')) {
    return { key: 'DEC', name: 'Pack Decembrino 2026' };
  }

  if (t.includes('video') || t.includes('1000 video')) {
    return { key: 'VID', name: 'Pack 1000 Videos Remix' };
  }

  if (t.includes('halloween') || t.includes('hallowen')) {
    return { key: 'HAL', name: 'Pack Halloween 2026' };
  }

  if (t.includes('crossover') || t.includes('extended')) {
    return { key: 'CRO', name: 'Pack Crossover Originales & Remix' };
  }

  if (t.includes('sample') || t.includes('efecto') || t.includes('5000') || t.includes('5.000')) {
    return { key: 'SMP', name: 'Pack Samples & Efectos DJ' };
  }

  // Opciones numéricas simples si el cliente responde "1", "2", "3", etc.
  const trimmed = t.trim();
  if (trimmed === '1' || trimmed === '1.') return { key: 'DEC', name: 'Pack Decembrino 2026' };
  if (trimmed === '2' || trimmed === '2.') return { key: 'VID', name: 'Pack 1000 Videos Remix' };
  if (trimmed === '3' || trimmed === '3.') return { key: 'HAL', name: 'Pack Halloween 2026' };
  if (trimmed === '4' || trimmed === '4.') return { key: 'CRO', name: 'Pack Crossover Originales & Remix' };
  if (trimmed === '5' || trimmed === '5.') return { key: 'SMP', name: 'Pack Samples & Efectos DJ' };

  return null;
}
