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
    const cleanDice = dice.trim().replace(/\s+/g, '');
    const cleanType = fuzzyMatchDamageType(type);
    // Determine display string, usually we want to preserve spacing like (1d10 + 4) but clean string is safer
    const displayDice = dice.trim();
    return `[rollable](${displayDice});{"diceNotation":"${cleanDice}", "rollType":"damage", "rollDamageType":"${cleanType}"}[/rollable]`;
  });

  // 3. [[roll: XdY+Z]] -> [rollable](XdY+Z);{"diceNotation":"XdY+Z", "rollType":"roll"}[/rollable]
  output = output.replace(/\[\[roll:\s*([^\]]+)\]\]/gi, (_match, dice) => {
    const cleanDice = dice.trim().replace(/\s+/g, '');
    const displayDice = dice.trim();
    return `[rollable](${displayDice});{"diceNotation":"${cleanDice}", "rollType":"roll"}[/rollable]`;
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
  const rollableRegex = /\[rollable\](.*?);(.*?)\[\/rollable\]/gi;
  
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
  const spellRegex = /\[spell\](.*?)\[\/spell\]/gi;
  output = output.replace(spellRegex, (_match, spellName) => {
    return `[[spell: ${spellName}]]`;
  });

  return output;
}
