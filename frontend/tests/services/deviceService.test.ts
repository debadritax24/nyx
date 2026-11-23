import { DeviceService } from '../../src/services/deviceService';

describe('Device Registration & Metadata Service', () => {
  it('generates a stable persistent device ID', async () => {
    const id1 = await DeviceService.getDeviceId();
    const id2 = await DeviceService.getDeviceId();

    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(10);
    expect(id1).toBe(id2);
  });

  it('manages device labels correctly', async () => {
    await DeviceService.setDeviceLabel('Pixel 8 Pro (Primary)');
    const label = await DeviceService.getDeviceLabel();
    expect(label).toBe('Pixel 8 Pro (Primary)');
  });
});
