import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface PrismaModel {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    isRequired: boolean;
    isUnique: boolean;
    relation?: string;
  }>;
  relations: string[];
}

function parseSchema(schemaPath: string): PrismaModel[] {
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const models: PrismaModel[] = [];

  // Simple regex-based parser
  const modelRegex = /model\s+(\w+)\s*{([^}]*)}/g;
  let modelMatch;

  while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
    const [, modelName, fieldsBlock] = modelMatch;
    const fields: PrismaModel['fields'] = [];
    const relations: string[] = [];

    const lines = fieldsBlock.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*(.*)/);
      if (fieldMatch) {
        const [, fieldName, fieldType, isArray, rest] = fieldMatch;
        
        // Detect relations
        if (rest.includes('@relation')) {
          relations.push(fieldType + (isArray || ''));
        }

        fields.push({
          name: fieldName,
          type: fieldType + (isArray || ''),
          isRequired: !rest.includes('?'),
          isUnique: rest.includes('@unique'),
          relation: rest.includes('@relation') ? fieldType : undefined,
        });
      }
    }

    models.push({ name: modelName, fields, relations });
  }

  return models;
}

function generateSchemaReport(models: PrismaModel[]) {
  const report = {
    totalModels: models.length,
    totalRelations: models.reduce((sum, m) => sum + m.relations.length, 0),
    models: models.map(m => ({
      name: m.name,
      fieldCount: m.fields.length,
      relationCount: m.relations.length,
      relations: m.relations,
    })),
  };

  // Ensure output directory exists
  try {
    mkdirSync(resolve(__dirname, '../../audit-output'), { recursive: true });
  } catch (e) {
    // Directory already exists
  }

  writeFileSync(
    resolve(__dirname, '../../audit-output/schema-analysis.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`✅ Analyzed ${models.length} models with ${report.totalRelations} relations`);
  console.log(`📄 Report saved to audit-output/schema-analysis.json`);
}

// Execute
const schemaPath = resolve(__dirname, '../../prisma/schema.prisma');
const models = parseSchema(schemaPath);
generateSchemaReport(models);

