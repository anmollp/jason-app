import type {
  DiffJsonResponse,
  FormatJsonResponse,
  PatchJsonResponse,
  PointerJsonResponse,
} from '../../json-tools.types';

export const AGENT_CONTRACT_VERSION = 'askjason.agent.v1' as const;
export const AGENT_PROMPT_VERSION = 'askjason.agent-prompt.v4' as const;
export const AGENT_TOOL_CONTRACT_VERSION = 'askjason.agent-tools.v1' as const;

export const AGENT_RUNTIME_LIMITS = {
  instructionCharacters: 500,
  untrustedContextBytes: 16_384,
  userTurnsPerSession: 3,
  modelRoundTripsPerTurn: 2,
  toolCallsPerTurn: 2,
  toolCallsPerSession: 4,
  concurrentRequestsPerSession: 1,
  requestTimeoutSeconds: 60,
  maxOutputTokens: 700,
} as const;

export const AGENT_TOOL_NAMES = [
  'format_json',
  'diff_json',
  'apply_json_patch',
  'resolve_json_pointer',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export type AgentToolInputMap = {
  format_json: { input: string };
  diff_json: { before: string; after: string };
  apply_json_patch: { document: string; patch: string };
  resolve_json_pointer: { document: string; path: string };
};

export type AgentToolResultMap = {
  format_json: FormatJsonResponse;
  diff_json: DiffJsonResponse;
  apply_json_patch: PatchJsonResponse;
  resolve_json_pointer: PointerJsonResponse;
};

export type JsonSchema = Readonly<Record<string, unknown>>;

export type ProviderNeutralToolDefinition = {
  name: AgentToolName;
  description: string;
  inputSchema: JsonSchema;
  resultSchema: JsonSchema;
};

const jsonDocumentProperty = {
  type: 'string',
  minLength: 1,
  maxLength: AGENT_RUNTIME_LIMITS.untrustedContextBytes,
  description: 'The complete untrusted JSON document as text.',
} as const;

const countProperties = {
  added: { type: 'integer', minimum: 0 },
  removed: { type: 'integer', minimum: 0 },
  replaced: { type: 'integer', minimum: 0 },
} as const;

const jsonPatchOperationSchema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        op: { enum: ['add', 'replace', 'test'] },
        path: { type: 'string' },
        value: {},
      },
      required: ['op', 'path', 'value'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { const: 'remove' },
        path: { type: 'string' },
      },
      required: ['op', 'path'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { enum: ['move', 'copy'] },
        from: { type: 'string' },
        path: { type: 'string' },
      },
      required: ['op', 'from', 'path'],
      additionalProperties: false,
    },
  ],
} as const;

export const AGENT_TOOL_DEFINITIONS: readonly ProviderNeutralToolDefinition[] =
  [
    {
      name: 'format_json',
      description:
        'Validate and format one JSON document using the deterministic Jason Rust engine. This does not write to the workspace.',
      inputSchema: {
        type: 'object',
        properties: { input: jsonDocumentProperty },
        required: ['input'],
        additionalProperties: false,
      },
      resultSchema: {
        type: 'object',
        properties: { output: { type: 'string' } },
        required: ['output'],
        additionalProperties: false,
      },
    },
    {
      name: 'diff_json',
      description:
        'Generate RFC 6902 JSON Patch operations between two JSON documents using the deterministic Jason Rust engine. This does not write to the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          before: jsonDocumentProperty,
          after: jsonDocumentProperty,
        },
        required: ['before', 'after'],
        additionalProperties: false,
      },
      resultSchema: {
        type: 'object',
        properties: {
          operations: { type: 'array', items: jsonPatchOperationSchema },
          summary: {
            type: 'object',
            properties: {
              changes: { type: 'integer', minimum: 0 },
              ...countProperties,
            },
            required: ['changes', 'added', 'removed', 'replaced'],
            additionalProperties: false,
          },
        },
        required: ['operations', 'summary'],
        additionalProperties: false,
      },
    },
    {
      name: 'apply_json_patch',
      description:
        'Validate and apply RFC 6902 operations to a JSON document in memory using the deterministic Jason Rust engine. This returns a preview only and never writes to the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          document: jsonDocumentProperty,
          patch: {
            ...jsonDocumentProperty,
            description:
              'The complete untrusted RFC 6902 patch array as JSON text.',
          },
        },
        required: ['document', 'patch'],
        additionalProperties: false,
      },
      resultSchema: {
        type: 'object',
        properties: {
          output: { type: 'string' },
          summary: {
            type: 'object',
            properties: {
              operations: { type: 'integer', minimum: 0 },
              ...countProperties,
            },
            required: ['operations', 'added', 'removed', 'replaced'],
            additionalProperties: false,
          },
        },
        required: ['output', 'summary'],
        additionalProperties: false,
      },
    },
    {
      name: 'resolve_json_pointer',
      description:
        'Resolve an RFC 6901 JSON Pointer against one JSON document using the deterministic Jason Rust engine. This does not write to the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          document: jsonDocumentProperty,
          path: {
            type: 'string',
            maxLength: AGENT_RUNTIME_LIMITS.untrustedContextBytes,
            description:
              'An RFC 6901 pointer. The empty string addresses the document root.',
          },
        },
        required: ['document', 'path'],
        additionalProperties: false,
      },
      resultSchema: {
        type: 'object',
        properties: {
          output: { type: 'string' },
          summary: {
            type: 'object',
            properties: {
              depth: { type: 'integer', minimum: 0 },
              found: { type: 'boolean' },
              issues: { type: 'integer', minimum: 0 },
              kind: { type: 'string' },
              path: { type: 'string' },
            },
            required: ['depth', 'found', 'issues', 'kind', 'path'],
            additionalProperties: false,
          },
        },
        required: ['output', 'summary'],
        additionalProperties: false,
      },
    },
  ];

export function isAgentToolName(value: string): value is AgentToolName {
  return AGENT_TOOL_NAMES.some((name) => name === value);
}
