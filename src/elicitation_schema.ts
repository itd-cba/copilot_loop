import type { ElicitRequestFormParams } from '@modelcontextprotocol/sdk/types.js';

export type RequestedSchema = ElicitRequestFormParams['requestedSchema'];

export type ValidationError = {
  code: 'INVALID_REQUESTED_SCHEMA';
  message: string;
};

type BaseSchema = {
  title?: string;
  description?: string;
};

export type StringSchema = BaseSchema & {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'uri' | 'date' | 'date-time';
  default?: string;
  enum?: string[];
  oneOf?: Array<{ const: string; title: string }>;
};

export type NumberSchema = BaseSchema & {
  type: 'number';
  minimum?: number;
  maximum?: number;
  default?: number;
};

export type IntegerSchema = BaseSchema & {
  type: 'integer';
  minimum?: number;
  maximum?: number;
  default?: number;
};

export type BooleanSchema = BaseSchema & {
  type: 'boolean';
  default?: boolean;
};

export type EnumMultiSchema =
  | (BaseSchema & {
      type: 'array';
      items: { type: 'string'; enum: string[] };
      minItems?: number;
      maxItems?: number;
      default?: string[];
    })
  | (BaseSchema & {
      type: 'array';
      items: { anyOf: Array<{ const: string; title: string }> };
      minItems?: number;
      maxItems?: number;
      default?: string[];
    });

export type PrimitiveSchema =
  | StringSchema
  | NumberSchema
  | IntegerSchema
  | BooleanSchema
  | EnumMultiSchema;

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: ValidationError };

const MAX_PROPERTIES = 50;
const MAX_ENUM_OPTIONS = 100;

function err(message: string): Err {
  return { ok: false, error: { code: 'INVALID_REQUESTED_SCHEMA', message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function uniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function validateStringSchema(
  schema: Record<string, unknown>,
): Ok<StringSchema> | Err {
  const format = schema.format;
  if (
    format !== undefined &&
    format !== 'email' &&
    format !== 'uri' &&
    format !== 'date' &&
    format !== 'date-time'
  ) {
    return err(`string.format must be one of: email, uri, date, date-time`);
  }

  const minLength = schema.minLength;
  const maxLength = schema.maxLength;
  if (
    minLength !== undefined &&
    !(isNonNegativeInt(minLength) && minLength <= 10000)
  ) {
    return err(`string.minLength must be a non-negative integer (<= 10000)`);
  }
  if (
    maxLength !== undefined &&
    !(isNonNegativeInt(maxLength) && maxLength <= 10000)
  ) {
    return err(`string.maxLength must be a non-negative integer (<= 10000)`);
  }
  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    (minLength as number) > (maxLength as number)
  ) {
    return err(`string.minLength must be <= string.maxLength`);
  }

  const pattern = schema.pattern;
  if (pattern !== undefined && typeof pattern !== 'string') {
    return err(`string.pattern must be a string`);
  }

  const defaultValue = schema.default;
  if (defaultValue !== undefined && typeof defaultValue !== 'string') {
    return err(`string.default must be a string`);
  }

  const enumValues = schema.enum;
  const oneOfValues = schema.oneOf;
  if (enumValues !== undefined && oneOfValues !== undefined) {
    return err(`enum and oneOf are mutually exclusive`);
  }
  if (enumValues !== undefined) {
    if (
      !Array.isArray(enumValues) ||
      enumValues.some((v) => typeof v !== 'string')
    ) {
      return err(`string.enum must be an array of strings`);
    }
    if (enumValues.length === 0) return err(`string.enum must not be empty`);
    if (enumValues.length > MAX_ENUM_OPTIONS) {
      return err(`string.enum has too many options (max ${MAX_ENUM_OPTIONS})`);
    }
    if (!uniqueStrings(enumValues))
      return err(`string.enum must not contain duplicates`);
  }
  if (oneOfValues !== undefined) {
    if (!Array.isArray(oneOfValues) || oneOfValues.length === 0) {
      return err(`string.oneOf must be a non-empty array`);
    }
    if (oneOfValues.length > MAX_ENUM_OPTIONS) {
      return err(`string.oneOf has too many options (max ${MAX_ENUM_OPTIONS})`);
    }
    const seen = new Set<string>();
    for (const entry of oneOfValues) {
      if (!isPlainObject(entry))
        return err(`string.oneOf entries must be objects`);
      if (typeof entry.const !== 'string')
        return err(`string.oneOf[].const must be a string`);
      if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
        return err(`string.oneOf[].title must be a non-empty string`);
      }
      if (seen.has(entry.const))
        return err(`string.oneOf[].const must be unique`);
      seen.add(entry.const);
    }
  }

  const out: StringSchema = {
    type: 'string',
    title: typeof schema.title === 'string' ? schema.title : undefined,
    description:
      typeof schema.description === 'string' ? schema.description : undefined,
    minLength: minLength as number | undefined,
    maxLength: maxLength as number | undefined,
    pattern: pattern as string | undefined,
    format: format as StringSchema['format'] | undefined,
    default: defaultValue as string | undefined,
    enum: enumValues as string[] | undefined,
    oneOf: oneOfValues as Array<{ const: string; title: string }> | undefined,
  };
  return { ok: true, value: out };
}

function validateNumberRangeSchema(
  type: 'number' | 'integer',
  schema: Record<string, unknown>,
): Ok<NumberSchema | IntegerSchema> | Err {
  const minimum = schema.minimum;
  const maximum = schema.maximum;
  if (minimum !== undefined && !isFiniteNumber(minimum))
    return err(`${type}.minimum must be a number`);
  if (maximum !== undefined && !isFiniteNumber(maximum))
    return err(`${type}.maximum must be a number`);
  if (
    minimum !== undefined &&
    maximum !== undefined &&
    (minimum as number) > (maximum as number)
  ) {
    return err(`${type}.minimum must be <= ${type}.maximum`);
  }

  const defaultValue = schema.default;
  if (defaultValue !== undefined && !isFiniteNumber(defaultValue))
    return err(`${type}.default must be a number`);
  if (
    type === 'integer' &&
    defaultValue !== undefined &&
    !Number.isInteger(defaultValue)
  ) {
    return err(`integer.default must be an integer`);
  }

  const out =
    type === 'number'
      ? ({
          type: 'number',
          title: typeof schema.title === 'string' ? schema.title : undefined,
          description:
            typeof schema.description === 'string'
              ? schema.description
              : undefined,
          minimum: minimum as number | undefined,
          maximum: maximum as number | undefined,
          default: defaultValue as number | undefined,
        } satisfies NumberSchema)
      : ({
          type: 'integer',
          title: typeof schema.title === 'string' ? schema.title : undefined,
          description:
            typeof schema.description === 'string'
              ? schema.description
              : undefined,
          minimum: minimum as number | undefined,
          maximum: maximum as number | undefined,
          default: defaultValue as number | undefined,
        } satisfies IntegerSchema);

  return { ok: true, value: out };
}

function validateBooleanSchema(
  schema: Record<string, unknown>,
): Ok<BooleanSchema> | Err {
  const defaultValue = schema.default;
  if (defaultValue !== undefined && typeof defaultValue !== 'boolean') {
    return err(`boolean.default must be a boolean`);
  }

  const out: BooleanSchema = {
    type: 'boolean',
    title: typeof schema.title === 'string' ? schema.title : undefined,
    description:
      typeof schema.description === 'string' ? schema.description : undefined,
    default: defaultValue as boolean | undefined,
  };
  return { ok: true, value: out };
}

function validateEnumMultiSchema(
  schema: Record<string, unknown>,
): Ok<EnumMultiSchema> | Err {
  const items = schema.items;
  if (!isPlainObject(items)) return err(`array.items must be an object`);

  const itemsEnum = items.enum;
  const itemsAnyOf = items.anyOf;
  if (itemsEnum !== undefined && itemsAnyOf !== undefined) {
    return err(`array.items.enum and array.items.anyOf are mutually exclusive`);
  }
  if (itemsEnum === undefined && itemsAnyOf === undefined) {
    return err(`array.items must include enum or anyOf`);
  }

  let normalizedItems: EnumMultiSchema['items'];
  if (itemsEnum !== undefined) {
    if (
      !Array.isArray(itemsEnum) ||
      itemsEnum.some((v) => typeof v !== 'string')
    ) {
      return err(`array.items.enum must be an array of strings`);
    }
    if (itemsEnum.length === 0)
      return err(`array.items.enum must not be empty`);
    if (itemsEnum.length > MAX_ENUM_OPTIONS) {
      return err(
        `array.items.enum has too many options (max ${MAX_ENUM_OPTIONS})`,
      );
    }
    if (!uniqueStrings(itemsEnum))
      return err(`array.items.enum must not contain duplicates`);
    normalizedItems = { type: 'string', enum: itemsEnum };
  } else {
    if (!Array.isArray(itemsAnyOf) || itemsAnyOf.length === 0) {
      return err(`array.items.anyOf must be a non-empty array`);
    }
    if (itemsAnyOf.length > MAX_ENUM_OPTIONS) {
      return err(
        `array.items.anyOf has too many options (max ${MAX_ENUM_OPTIONS})`,
      );
    }
    const seen = new Set<string>();
    for (const entry of itemsAnyOf) {
      if (!isPlainObject(entry))
        return err(`array.items.anyOf entries must be objects`);
      if (typeof entry.const !== 'string')
        return err(`array.items.anyOf[].const must be a string`);
      if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
        return err(`array.items.anyOf[].title must be a non-empty string`);
      }
      if (seen.has(entry.const))
        return err(`array.items.anyOf[].const must be unique`);
      seen.add(entry.const);
    }
    normalizedItems = {
      anyOf: itemsAnyOf as Array<{ const: string; title: string }>,
    };
  }

  const minItems = schema.minItems;
  const maxItems = schema.maxItems;
  if (minItems !== undefined && !isNonNegativeInt(minItems))
    return err(`array.minItems must be an integer >= 0`);
  if (maxItems !== undefined && !isNonNegativeInt(maxItems))
    return err(`array.maxItems must be an integer >= 0`);
  if (
    minItems !== undefined &&
    maxItems !== undefined &&
    (minItems as number) > (maxItems as number)
  ) {
    return err(`array.minItems must be <= array.maxItems`);
  }

  const defaultValue = schema.default;
  if (defaultValue !== undefined) {
    if (
      !Array.isArray(defaultValue) ||
      defaultValue.some((v) => typeof v !== 'string')
    ) {
      return err(`array.default must be an array of strings`);
    }
    const allowed =
      'enum' in normalizedItems
        ? new Set(normalizedItems.enum)
        : new Set(normalizedItems.anyOf.map((x: { const: string }) => x.const));
    for (const value of defaultValue) {
      if (!allowed.has(value))
        return err(`array.default contains value not present in items`);
    }
    if (!uniqueStrings(defaultValue))
      return err(`array.default must not contain duplicates`);
  }

  const base = {
    type: 'array' as const,
    title: typeof schema.title === 'string' ? schema.title : undefined,
    description:
      typeof schema.description === 'string' ? schema.description : undefined,
    minItems: minItems as number | undefined,
    maxItems: maxItems as number | undefined,
    default: defaultValue as string[] | undefined,
  };

  if ('enum' in normalizedItems) {
    const out: EnumMultiSchema = {
      ...base,
      items: { type: 'string', enum: normalizedItems.enum },
    };
    return { ok: true, value: out };
  }
  const out: EnumMultiSchema = {
    ...base,
    items: { anyOf: normalizedItems.anyOf },
  };
  return { ok: true, value: out };
}

function validatePrimitiveSchema(schema: unknown): Ok<PrimitiveSchema> | Err {
  if (!isPlainObject(schema)) return err(`schema must be an object`);

  const type = schema.type;
  if (type === 'string') return validateStringSchema(schema);
  if (type === 'number')
    return validateNumberRangeSchema('number', schema) as
      | Ok<PrimitiveSchema>
      | Err;
  if (type === 'integer')
    return validateNumberRangeSchema('integer', schema) as
      | Ok<PrimitiveSchema>
      | Err;
  if (type === 'boolean') return validateBooleanSchema(schema);
  if (type === 'array') return validateEnumMultiSchema(schema);

  return err(`unsupported property type: ${String(type)}`);
}

export function validateRequestedSchema(
  schema: unknown,
): Ok<RequestedSchema> | Err {
  if (!isPlainObject(schema)) return err(`requestedSchema must be an object`);
  if (schema.type !== 'object')
    return err(`requestedSchema.type must be "object"`);
  if (!isPlainObject(schema.properties))
    return err(`requestedSchema.properties must be an object`);

  const propertyEntries = Object.entries(schema.properties);
  if (propertyEntries.length === 0)
    return err(`requestedSchema.properties must not be empty`);
  if (propertyEntries.length > MAX_PROPERTIES)
    return err(`too many properties (max ${MAX_PROPERTIES})`);

  const normalizedProperties: Record<string, PrimitiveSchema> = {};
  for (const [key, value] of propertyEntries) {
    if (!isNonEmptyString(key))
      return err(`property keys must be non-empty strings`);
    const validated = validatePrimitiveSchema(value);
    if (!validated.ok)
      return err(`properties.${key}: ${validated.error.message}`);
    normalizedProperties[key] = validated.value;
  }

  const required = schema.required;
  if (required !== undefined) {
    if (
      !Array.isArray(required) ||
      required.some((v) => typeof v !== 'string')
    ) {
      return err(`requestedSchema.required must be an array of strings`);
    }
    if (!uniqueStrings(required))
      return err(`requestedSchema.required must not contain duplicates`);
    for (const key of required) {
      if (!(key in normalizedProperties)) {
        return err(
          `requestedSchema.required includes unknown property: ${key}`,
        );
      }
    }
  }

  const out: RequestedSchema = {
    type: 'object',
    properties: normalizedProperties,
    required: required as string[] | undefined,
  };
  return { ok: true, value: out };
}
