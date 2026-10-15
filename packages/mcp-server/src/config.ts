export interface McpServerConfig {
  apiUrl: string;
  apiToken?: string;
  defaultWorkspaceId?: string;
  requestTimeoutMs: number;
}

export function loadConfig(overrides?: Partial<McpServerConfig>): McpServerConfig {
  const envApiUrl = process.env.TRACEBACK_API_URL?.trim();
  const envApiToken = process.env.TRACEBACK_API_TOKEN?.trim();
  const envWorkspaceId = process.env.TRACEBACK_WORKSPACE_ID?.trim();
  const envTimeout = process.env.TRACEBACK_REQUEST_TIMEOUT_MS
    ? parseInt(process.env.TRACEBACK_REQUEST_TIMEOUT_MS, 10)
    : 15000;

  return {
    apiUrl: overrides?.apiUrl || envApiUrl || "http://localhost:3001/api",
    apiToken: overrides?.apiToken || envApiToken || undefined,
    defaultWorkspaceId: overrides?.defaultWorkspaceId || envWorkspaceId || undefined,
    requestTimeoutMs: overrides?.requestTimeoutMs || (Number.isFinite(envTimeout) ? envTimeout : 15000),
  };
}
