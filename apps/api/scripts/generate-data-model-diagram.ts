import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generates the full data-model ER diagram (`docs/architecture/data-model.md`'s
 * `_generated-erd.md` include) directly from `prisma/schema.prisma`'s own text,
 * rather than a third-party ERD generator or a headless browser: no ERD
 * generator package in the ecosystem yet targets Prisma 7's new
 * `prisma-client` generator, and this keeps the diagram in lock-step with the
 * schema with a plain, dependency-free parser. Run as part of
 * `openapi:generate`'s sibling script, and checked for staleness in CI the
 * same way.
 */

interface ParsedField {
  name: string;
  columnName: string;
  type: string;
  isArray: boolean;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  relation?: { fields: string[]; references: string[] };
}

interface ParsedModel {
  name: string;
  tableName: string;
  fields: ParsedField[];
  compositeId?: string[];
}

const SCALAR_TYPE_MAP: Record<string, string> = {
  String: 'string',
  Int: 'int',
  Decimal: 'decimal',
  DateTime: 'datetime',
  Boolean: 'boolean',
};

function parseSchema(schemaText: string): { models: ParsedModel[]; enums: Map<string, string> } {
  const models: ParsedModel[] = [];
  // Prisma type name -> its `@@map`'d SQL name (falls back to the Prisma name).
  const enums = new Map<string, string>();

  for (const match of schemaText.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
    const enumName = match[1] as string;
    const body = match[2] as string;
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    enums.set(enumName, mapMatch?.[1] ?? enumName);
  }

  for (const match of schemaText.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
    const name = match[1] as string;
    const body = match[2] as string;
    const tableNameMatch = body.match(/@@map\("([^"]+)"\)/);
    const compositeIdMatch = body.match(/@@id\(\[([^\]]+)\]\)/);

    const fields: ParsedField[] = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('@@') || line.startsWith('//')) continue;

      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;
      const [, fieldName, type, arraySuffix, optionalSuffix, attrs] = fieldMatch as unknown as [
        string,
        string,
        string,
        string | undefined,
        string | undefined,
        string,
      ];

      const columnMapMatch = attrs.match(/@map\("([^"]+)"\)/);
      const relationMatch = attrs.match(
        /@relation\(fields:\s*\[([^\]]+)\],\s*references:\s*\[([^\]]+)\]/,
      );

      fields.push({
        name: fieldName,
        columnName: columnMapMatch?.[1] ?? fieldName,
        type,
        isArray: Boolean(arraySuffix),
        isOptional: Boolean(optionalSuffix),
        isId: attrs.includes('@id'),
        isUnique: attrs.includes('@unique'),
        relation: relationMatch
          ? {
              fields: (relationMatch[1] as string).split(',').map((s) => s.trim()),
              references: (relationMatch[2] as string).split(',').map((s) => s.trim()),
            }
          : undefined,
      });
    }

    models.push({
      name,
      tableName: tableNameMatch?.[1] ?? name,
      fields,
      compositeId: compositeIdMatch
        ? (compositeIdMatch[1] as string).split(',').map((s) => s.trim())
        : undefined,
    });
  }

  return { models, enums };
}

function mermaidType(field: ParsedField, enums: Map<string, string>): string {
  const mappedEnum = enums.get(field.type);
  if (mappedEnum) return mappedEnum;
  return SCALAR_TYPE_MAP[field.type] ?? field.type.toLowerCase();
}

function renderTable(model: ParsedModel, enums: Map<string, string>, modelNames: Set<string>): string {
  const fkFieldNames = new Set(model.fields.flatMap((f) => f.relation?.fields ?? []));
  const lines: string[] = [`  ${model.tableName} {`];

  for (const field of model.fields) {
    // Skip relation fields entirely (both the FK-owning side, e.g.
    // `user User @relation(...)`, and the inverse side, e.g.
    // `sessions Session[]` or `patientProfile PatientProfile?`, which carries
    // no `@relation` of its own) — they become relationship lines below, not
    // attribute rows.
    if (field.relation || field.isArray || modelNames.has(field.type)) continue;

    const keys: string[] = [];
    if (field.isId || model.compositeId?.includes(field.name)) keys.push('PK');
    if (fkFieldNames.has(field.name)) keys.push('FK');
    if (field.isUnique) keys.push('UK');

    const parts = [mermaidType(field, enums), field.columnName];
    if (keys.length > 0) parts.push(keys.join(','));
    lines.push(`    ${parts.join(' ')}`);
  }

  lines.push('  }');
  return lines.join('\n');
}

function renderRelationships(models: ParsedModel[]): string[] {
  const byName = new Map(models.map((m) => [m.name, m]));
  const lines: string[] = [];

  for (const model of models) {
    for (const field of model.fields) {
      if (!field.relation) continue;
      const target = byName.get(field.type);
      if (!target) continue;

      // One-to-one only when the relation is a single FK column that is
      // itself this model's whole (non-composite) primary key — e.g.
      // `PatientProfile.userId` is both `@id` and the FK to `User`. A
      // composite `@@id` (e.g. `DoctorSpecialization`'s `[doctorId,
      // specializationId]`) means each individual FK column repeats, so
      // that's a one-to-many, same as any other FK.
      const isOneToOne =
        field.relation.fields.length === 1 &&
        model.fields.find((f) => f.name === field.relation?.fields[0])?.isId === true &&
        !model.compositeId;
      const cardinality = isOneToOne ? '||--o|' : '||--o{';
      lines.push(`  ${target.tableName} ${cardinality} ${model.tableName} : "${field.name}"`);
    }
  }

  return lines;
}

function render(models: ParsedModel[], enums: Map<string, string>): string {
  const modelNames = new Set(models.map((m) => m.name));
  const tables = models.map((m) => renderTable(m, enums, modelNames)).join('\n');
  const relationships = renderRelationships(models).join('\n');
  return [
    '<!-- Generated by `pnpm --filter api run generate:data-model-diagram`. Do not edit by hand. -->',
    '',
    '```mermaid',
    'erDiagram',
    tables,
    relationships,
    '```',
    '',
  ].join('\n');
}

function main(): void {
  const schemaPath = resolve(__dirname, '../../prisma/schema.prisma');
  const schemaText = readFileSync(schemaPath, 'utf8');
  const { models, enums } = parseSchema(schemaText);

  const output = render(models, enums);
  const outPath = resolve(__dirname, '../../../../docs/architecture/_generated-erd.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`Data model ER diagram written to ${outPath}`);
}

main();
