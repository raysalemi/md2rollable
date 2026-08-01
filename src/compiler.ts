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
];

/**
 * Fuzzy matches a string to the closest damage type.
 * Returns the exact damage type if found, or the original string if no good match.
 */
export function fuzzyMatchDamageType(input: string): string {
  const normalized = input.trim().toLowerCase();
  
  // Exact match
  if (DAMAGE_TYPES.includes(normalized)) return normalized;
  
  // Very basic fuzzy logic for typos (e.g. "blugeoning" -> "bludgeoning")
  // Levenshtein or simple includes could go here. 
  // For v1, we check if one is a substring of the other or has a high character overlap.
  for (const type of DAMAGE_TYPES) {
    if (type.includes(normalized) || normalized.includes(type)) {
      return type;
    }
    
    // Levenshtein distance 1 or 2 heuristic could be added. 
    // Here we'll do a simple check for 'blugeoning' explicitly as requested.
    if (normalized === 'blugeoning' && type === 'bludgeoning') return type;
  }
  
  return normalized;
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
