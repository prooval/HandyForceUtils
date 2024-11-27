import { DBSQLClient, Connection } from '@databricks/sql';
import { AuthorizerInterface } from '@databricks/sql/dist/connection';

interface DatabricksConfig {
  host: string;
  path: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  // Optional parameters
  catalog?: string;
  schema?: string;
}

class DatabricksOAuthAuthorizer implements AuthorizerInterface {
  private clientId: string;
  private clientSecret: string;
  private tokenEndpoint: string;
  private accessToken: string | null = null;
  private expiresAt: number = 0;

  constructor(clientId: string, clientSecret: string, tokenEndpoint: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenEndpoint = tokenEndpoint;
  }

  async getAuthHeader(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      await this.refreshToken();
    }
    return `Bearer ${this.accessToken}`;
  }

  private async refreshToken(): Promise<void> {
    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry 5 minutes before actual expiry to ensure token validity
      this.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    } catch (error) {
      throw new Error(`OAuth token refresh failed: ${error.message}`);
    }
  }
}

export class DatabricksService {
  private config: DatabricksConfig;
  private client: DBSQLClient;
  private connection: Connection | null = null;

  constructor(config: DatabricksConfig) {
    this.config = config;
    this.client = new DBSQLClient();
  }

  async connect(): Promise<Connection> {
    if (this.connection?.isOpen()) {
      return this.connection;
    }

    const authorizer = new DatabricksOAuthAuthorizer(
      this.config.clientId,
      this.config.clientSecret,
      this.config.tokenEndpoint
    );

    try {
      this.connection = await this.client.connect({
        host: this.config.host,
        path: this.config.path,
        token: await authorizer.getAuthHeader(),
        catalog: this.config.catalog,
        schema: this.config.schema
      });

      return this.connection;
    } catch (error) {
      throw new Error(`Failed to connect to Databricks: ${error.message}`);
    }
  }

  async query<T = any>(sql: string): Promise<T[]> {
    const connection = await this.connect();
    try {
      const session = await connection.openSession();
      const operation = await session.executeStatement(sql);
      const result = await operation.fetchAll();
      await operation.close();
      await session.close();
      return result as T[];
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  async streamQuery<T = any>(sql: string) {
    const connection = await this.connect();
    const session = await connection.openSession();
    const operation = await session.executeStatement(sql);
    
    return {
      operation,
      session,
      async *[Symbol.asyncIterator]() {
        try {
          let hasMore = true;
          while (hasMore) {
            const results = await operation.fetchChunk();
            if (results.length === 0) {
              hasMore = false;
            } else {
              for (const row of results) {
                yield row as T;
              }
            }
          }
        } finally {
          await operation.close();
          await session.close();
        }
      }
    };
  }

  async close(): Promise<void> {
    if (this.connection?.isOpen()) {
      await this.connection.close();
    }
  }
}

// Example usage:
const config: DatabricksConfig = {
  host: 'your-workspace.cloud.databricks.com',
  path: '/sql/1.0/endpoints/1234567890abcdef',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenEndpoint: 'https://your-tenant.cloud.databricks.com/oidc/token',
  catalog: 'my_catalog',  // optional
  schema: 'my_schema'     // optional
};

// Example of how to use it with your migration service:
async function migrateData() {
  const databricks = new DatabricksService(config);
  
  try {
    // For batch processing with streams
    const queryStream = await databricks.streamQuery(
      'SELECT * FROM opportunities WHERE created_date > :lastSync'
    );

    // Use it with your existing migration service
    const migrationService = new DataMigrationService(sfConnection, queryStream);
    await migrationService.migrateData(/* ... */);
  } finally {
    await databricks.close();
  }
}