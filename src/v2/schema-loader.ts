import { ModelSchema } from './types';

/**
 * Converts backend JSON schema to TypeScript-compatible type map
 * This converts the JSON Schema format to a structure that can be used
 * for runtime type validation and TypeScript type inference
 */
export function createTypeMapFromSchemas(schemas: ModelSchema[]): Record<string, any> {
  const typeMap: Record<string, any> = {};
  
  for (const schema of schemas) {
    // Convert JSON schema properties to a flat structure
    // This creates a type-safe structure based on the schema
    const inputType: Record<string, any> = {};
    
    if (schema.inputSchema && schema.inputSchema.properties) {
      for (const [key, prop] of Object.entries(schema.inputSchema.properties)) {
        // Map JSON Schema types to TypeScript-compatible types
        if (prop.type === 'string') {
          inputType[key] = String;
        } else if (prop.type === 'number' || prop.type === 'integer') {
          inputType[key] = Number;
        } else if (prop.type === 'boolean') {
          inputType[key] = Boolean;
        } else if (prop.type === 'array') {
          inputType[key] = Array;
        } else if (prop.type === 'object') {
          inputType[key] = Object;
        } else {
          inputType[key] = prop;
        }
        
        // Handle enums
        if (prop.enum) {
          inputType[key] = prop.enum;
        }
      }
    }
    
    typeMap[schema.endpoint] = inputType;
  }
  
  return typeMap;
}

/**
 * Validates input against a schema
 */
export function validateInputAgainstSchema(
  input: any,
  schema: ModelSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!schema.inputSchema || !schema.inputSchema.properties) {
    return { valid: true, errors: [] };
  }
  
  // Check required fields
  if (schema.inputSchema.required) {
    for (const requiredField of schema.inputSchema.required) {
      if (!(requiredField in input)) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }
  }
  
  // Validate field types
  for (const [key, value] of Object.entries(input)) {
    const prop = schema.inputSchema.properties[key];
    if (!prop) {
      // Unknown field - could be a warning instead of error
      continue;
    }
    
    if (prop.type === 'string' && typeof value !== 'string') {
      errors.push(`Field ${key} must be a string`);
    } else if (prop.type === 'number' && typeof value !== 'number') {
      errors.push(`Field ${key} must be a number`);
    } else if (prop.type === 'integer' && (!Number.isInteger(value) || typeof value !== 'number')) {
      errors.push(`Field ${key} must be an integer`);
    } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${key} must be a boolean`);
    } else if (prop.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field ${key} must be an array`);
    } else if (prop.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push(`Field ${key} must be an object`);
    }
    
    // Validate enum values
    if (prop.enum && !prop.enum.includes(value)) {
      errors.push(`Field ${key} must be one of: ${prop.enum.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

