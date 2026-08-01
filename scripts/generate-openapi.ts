import { writeFileSync, mkdirSync } from 'node:fs';
import {
  createDocument,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathsObject
} from 'zod-openapi';
import { operations, openApiInfo } from '../src/lib/api/openapi';
import { z } from 'zod';

function buildOperation(op: (typeof operations)[number]): ZodOpenApiOperationObject {
  const opObject: ZodOpenApiOperationObject = {
    operationId: op.operationId,
    summary: op.summary,
    security: [{ sessionCookie: [] }],
    requestParams: op.pathParams
      ? { path: z.object(op.pathParams) }
      : op.queryParams
        ? { query: z.object(op.queryParams) }
        : undefined,
    responses: {
      '200': {
        description: op.responseDescription,
        content: {
          'application/json': {
            schema: z
              .object({})
              .passthrough()
              .meta({ id: `${op.operationId}Response`, description: op.responseDescription })
          }
        }
      },
      '403': {
        description: `Forbidden: \`${op.permission}\` required`
      },
      '429': {
        description: 'Too Many Requests'
      }
    },
    tags: [op.path.split('/')[1] ?? 'other'],
    'x-permission': op.permission
  };

  if (op.body) {
    opObject.requestBody = {
      content: {
        'application/json': { schema: op.body }
      }
    };
  }

  return opObject;
}

function buildPaths(): ZodOpenApiPathsObject {
  const paths: ZodOpenApiPathsObject = {};
  for (const op of operations) {
    if (!paths[op.path]) paths[op.path] = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (paths[op.path] as any)[op.method] = buildOperation(op);
  }
  return paths;
}

const document = createDocument({
  openapi: '3.1.0',
  info: openApiInfo,
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session'
      }
    }
  },
  paths: buildPaths()
});

const outDir = './public';
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/openapi.json`, JSON.stringify(document, null, 2));
const pathCount = document.paths ? Object.keys(document.paths).length : 0;
console.log(`openapi.json written (${pathCount} paths)`);
