export function detectPackFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Detectar paquetes específicos en etiquetas como: [Packs: pack-xxx,pack-yyy]
  let detectedSubPacks = [];
  const tagMatch = text.match(/\[Packs:\s*([^\]]+)\]/i);
  if (tagMatch) {
    detectedSubPacks = tagMatch[1].split(',').map(s => s.trim());
  } else {
    if (t.includes('sample') || t.includes('efecto')) detectedSubPacks.push('pack-samples-efectos-dj');
    if (t.includes('decembrin') || t.includes('navidad') || t.includes('diciembre') || t.includes('parranda')) detectedSubPacks.push('pack-decembrino-2026');
    if (t.includes('video') || t.includes('1000')) detectedSubPacks.push('pack-1000-videos-remix');
    if (t.includes('crossover') || t.includes('extended')) detectedSubPacks.push('pack-crossover-originales-extended');
    if (t.includes('halloween') || t.includes('hallowen')) detectedSubPacks.push('pack-halloween-2026');
  }

  // Opciones numéricas simples según la enumeración oficial (1 a 8)
  const trimmed = t.trim().replace('.', '');
  if (trimmed === '1') return { key: 'SMP', name: 'Pack Samples & Efectos DJ', packId: 'pack-samples-efectos-dj' };
  if (trimmed === '2') return { key: 'DEC', name: 'Pack Decembrino 2026', packId: 'pack-decembrino-2026' };
  if (trimmed === '3') return { key: 'VID', name: 'Pack 1000 Videos Remix', packId: 'pack-1000-videos-remix' };
  if (trimmed === '4') return { key: 'CRO', name: 'Pack Crossover Originales & Remix', packId: 'pack-crossover-originales-extended' };
  if (trimmed === '5') return { key: 'HAL', name: 'Pack Halloween 2026', packId: 'pack-halloween-2026' };
  if (trimmed === '6') return { key: 'DUO', name: 'Combo Dúo (2 Packs a elección)', subPacks: detectedSubPacks };
  if (trimmed === '7') return { key: 'TRIO', name: 'Combo Trío (3 Packs a elección)', subPacks: detectedSubPacks };
  if (trimmed === '8') return { key: 'VIP', name: 'Mega Combo VIP (Todos los Packs)' };

  // Mega Combo VIP
  if (t.includes('mega combo vip') || t.includes('combo vip') || (t.includes('vip') && (t.includes('35') || t.includes('todos')))) {
    return { key: 'VIP', name: 'Mega Combo VIP (Todos los Packs)' };
  }

  // Combo Trío
  if (t.includes('combo trio') || (t.includes('trio') && (t.includes('20') || t.includes('tres')))) {
    return { key: 'TRIO', name: 'Combo Trío (3 Packs a elección)', subPacks: detectedSubPacks };
  }

  // Combo Dúo
  if (t.includes('combo duo') || (t.includes('duo') && (t.includes('15') || t.includes('dos')))) {
    return { key: 'DUO', name: 'Combo Dúo (2 Packs a elección)', subPacks: detectedSubPacks };
  }

  // Packs individuales
  if (t.includes('sample') || t.includes('efecto') || t.includes('5000') || t.includes('5.000')) {
    return { key: 'SMP', name: 'Pack Samples & Efectos DJ', packId: 'pack-samples-efectos-dj' };
  }

  if (t.includes('decembrin') || t.includes('navidad') || t.includes('naviden') || t.includes('diciembre') || t.includes('parranda')) {
    return { key: 'DEC', name: 'Pack Decembrino 2026', packId: 'pack-decembrino-2026' };
  }

  if (t.includes('video') || t.includes('1000 video')) {
    return { key: 'VID', name: 'Pack 1000 Videos Remix', packId: 'pack-1000-videos-remix' };
  }

  if (t.includes('crossover') || t.includes('extended')) {
    return { key: 'CRO', name: 'Pack Crossover Originales & Remix', packId: 'pack-crossover-originales-extended' };
  }

  if (t.includes('halloween') || t.includes('hallowen')) {
    return { key: 'HAL', name: 'Pack Halloween 2026', packId: 'pack-halloween-2026' };
  }

  return null;
}
