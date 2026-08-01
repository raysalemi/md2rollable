// src/compiler.ts

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
  'healing'
];

function getEditDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy matches a string to the closest damage type.
 * Returns the exact damage type if found, or the original string if no good match.
 */
export function fuzzyMatchDamageType(input: string): string {
  const normalized = input.trim().toLowerCase();
  
  // Exact match
  if (DAMAGE_TYPES.includes(normalized)) return normalized;
  
  // Find the closest match using Levenshtein distance
  let closestType = normalized;
  let minDistance = Infinity;

  for (const type of DAMAGE_TYPES) {
    if (type.includes(normalized) || normalized.includes(type)) {
      return type; // High substring overlap takes precedence
    }

    const dist = getEditDistance(normalized, type);
    if (dist < minDistance) {
      minDistance = dist;
      closestType = type;
    }
  }
  
  // If it's a minor typo (distance 1 or 2), auto-correct it
  if (minDistance <= 2) {
    return closestType;
  }
  
  return `INVALID:${normalized}`;
}

/**
 * Compiles custom shorthand markdown into D&D Beyond JSON rollable tags.
 */
export function compileShorthand(input: string): string {
  let output = input;

  // 1. [[hit: +X]] -> [rollable]+X;{"diceNotation":"1d20+X", "rollType":"to hit"}[/rollable]
  output = output.replace(/\[\[hit:\s*([+-]?\d+)\]\]/gi, (_match, bonus) => {
    return `[rollable]${bonus};{"diceNotation":"1d20${bonus}", "rollType":"to hit"}[/rollable]`;
  });

  // 2. [[dmg: XdY+Z, type]] -> [rollable](XdY+Z);{"diceNotation":"XdY+Z", "rollType":"damage", "rollDamageType":"type"}[/rollable]
  output = output.replace(/\[\[dmg:\s*([^,]+),\s*([^\]]+)\]\]/gi, (_match, dice, type) => {
    let cleanDice = dice.trim().replace(/\s+/g, '');
    const displayDice = dice.trim();
    
    // If the user typed "13 (2d8 + 4)", extract just the "2d8+4" for the JSON logic
    const parenMatch = displayDice.match(/\(([^)]+)\)/);
    if (parenMatch) {
      cleanDice = parenMatch[1].replace(/\s+/g, '');
    }
    
    const cleanType = fuzzyMatchDamageType(type);
    
    if (cleanType.startsWith('INVALID:')) {
      const badType = cleanType.split(':')[1];
      return `⚠️ ERROR: "${badType}" is not a valid damage type.`;
    }
    
    // Add spaces around + or - for the display text if not already present, as D&D Beyond can be picky
    let spacedDisplay = displayDice;
    if (!spacedDisplay.includes(' + ') && !spacedDisplay.includes(' - ')) {
      spacedDisplay = spacedDisplay.replace(/\+/g, ' + ').replace(/-/g, ' - ');
    }
    
    const finalDisplay = displayDice.includes('(') ? displayDice : `(${spacedDisplay})`;
    return `[rollable]${finalDisplay};{"diceNotation":"${cleanDice}", "rollType":"damage", "rollDamageType":"${cleanType}"}[/rollable]`;
  });

  // 3. [[roll: XdY+Z]] -> [rollable](XdY+Z);{"diceNotation":"XdY+Z", "rollType":"roll"}[/rollable]
  output = output.replace(/\[\[roll:\s*([^\]]+)\]\]/gi, (_match, dice) => {
    let cleanDice = dice.trim().replace(/\s+/g, '');
    const displayDice = dice.trim();
    
    const parenMatch = displayDice.match(/\(([^)]+)\)/);
    if (parenMatch) {
      cleanDice = parenMatch[1].replace(/\s+/g, '');
    }
    
    // Add spaces around + or - for the display text
    let spacedDisplay = displayDice;
    if (!spacedDisplay.includes(' + ') && !spacedDisplay.includes(' - ')) {
      spacedDisplay = spacedDisplay.replace(/\+/g, ' + ').replace(/-/g, ' - ');
    }
    
    const finalDisplay = displayDice.includes('(') ? displayDice : `(${spacedDisplay})`;
    return `[rollable]${finalDisplay};{"diceNotation":"${cleanDice}", "rollType":"roll"}[/rollable]`;
  });

  // 4. [[spell: name]] -> [spell]name[/spell]
  output = output.replace(/\[\[spell:\s*([^\]]+)\]\]/gi, (_match, spellName) => {
    return `[spell]${spellName.trim().toLowerCase()}[/spell]`;
  });

  return output;
}

/**
 * Decompiles D&D Beyond JSON rollable tags back into custom shorthand markdown.
 */
export function decompileToShorthand(input: string): string {
  let output = input;

  // Pattern: [rollable]Display;JSON[/rollable]
  const rollableRegex = /\[rollable\](.*?);(.*?)\[\/rollable\]/gis;
  
  output = output.replace(rollableRegex, (match, display, jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.rollType === 'to hit') {
        return `[[hit: ${display}]]`;
      } 
      else if (data.rollType === 'damage') {
        const type = data.rollDamageType || 'unknown';
        // Remove parens from display if they exist
        const cleanDisplay = display.replace(/^\((.*)\)$/, '$1');
        return `[[dmg: ${cleanDisplay}, ${type}]]`;
      }
      else if (data.rollType === 'roll' || data.rollType === 'recharge' || data.rollType === 'save' || data.rollType === 'check') {
         const cleanDisplay = display.replace(/^\((.*)\)$/, '$1');
         return `[[roll: ${cleanDisplay}]]`;
      }
      
      // Fallback
      return match;
    } catch (e) {
      console.warn("Failed to parse JSON in decompiler:", jsonString);
      return match;
    }
  });

  // Pattern: [spell]name[/spell]
  const spellRegex = /\[spell\](.*?)\[\/spell\]/gis;
  output = output.replace(spellRegex, (_match, spellName) => {
    return `[[spell: ${spellName}]]`;
  });

  return output;
}
