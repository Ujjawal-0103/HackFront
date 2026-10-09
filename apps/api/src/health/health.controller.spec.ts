import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/health', () => {
    it('should return health status ok with valid metadata', () => {
      const response = controller.getHealth();
      expect(response).toBeDefined();
      expect(response.status).toBe('ok');
      expect(response.service).toBe('@traceback/api');
      expect(response.version).toBe('0.1.0');
      expect(typeof response.uptimeSeconds).toBe('number');
      expect(Date.parse(response.timestamp)).not.toBeNaN();
    });
  });
});
