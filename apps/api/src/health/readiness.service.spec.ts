import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { ReadinessService, DatabaseHealthIndicator } from './readiness.service';

describe('ReadinessService', () => {
  let service: ReadinessService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.port') return 3001;
              if (key === 'app.databaseUrl') return 'postgresql://localhost:5432/db';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkReadiness', () => {
    it('should return 503 SERVICE_UNAVAILABLE when database indicator is missing or unhealthy', async () => {
      const result = await service.checkReadiness();
      expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.response.status).toBe('not_ready');
      expect(result.response.checks.config.ready).toBe(true);
      expect(result.response.checks.database.ready).toBe(false);
    });

    it('should return 503 SERVICE_UNAVAILABLE when database reports unhealthy', async () => {
      const mockDb: DatabaseHealthIndicator = {
        isHealthy: jest.fn().mockResolvedValue({ healthy: false, message: 'Connection refused' }),
      };
      service.setDatabaseIndicator(mockDb);

      const result = await service.checkReadiness();
      expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.response.status).toBe('not_ready');
      expect(result.response.checks.database.ready).toBe(false);
      expect(result.response.checks.database.message).toBe('Connection refused');
    });

    it('should return 200 OK when both configuration and database are healthy', async () => {
      const mockDb: DatabaseHealthIndicator = {
        isHealthy: jest.fn().mockResolvedValue({ healthy: true }),
      };
      service.setDatabaseIndicator(mockDb);

      const result = await service.checkReadiness();
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.response.status).toBe('ready');
      expect(result.response.checks.config.ready).toBe(true);
      expect(result.response.checks.database.ready).toBe(true);
      expect(result.response.checks.database.message).toBe('Database responsive');
    });

    it('should return 503 when configuration is missing required environment values', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      const mockDb: DatabaseHealthIndicator = {
        isHealthy: jest.fn().mockResolvedValue({ healthy: true }),
      };
      service.setDatabaseIndicator(mockDb);

      const result = await service.checkReadiness();
      expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.response.status).toBe('not_ready');
      expect(result.response.checks.config.ready).toBe(false);
    });
  });
});
