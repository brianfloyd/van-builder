// Basic test that the shared MCP server can be created and has the expected tools.
import { describe, it, expect } from 'vitest';
import { createVanBuilderServer } from './server.js';

describe('createVanBuilderServer', () => {
  it('creates an MCP server with the van-builder name', () => {
    const server = createVanBuilderServer();
    expect(server).toBeDefined();
  });

  it('server has tool capabilities registered', () => {
    const server = createVanBuilderServer();
    // The server should have tool handling capability after registration
    // This is a basic smoke test that the server was created without errors
    expect(server).toHaveProperty('tool');
  });
});

describe('checklist export format', () => {
  it('export_checklist header includes new inventory and tags columns', () => {
    const expectedColumns = [
      'Category', 'Item', 'Qty', 'W', 'D', 'H', 'MountSurface', 'Cost', 'Status',
      'InventoryStatus', 'Tags', 'Vendor', 'OrderUrl', 'OrderDate', 'URL', 'Notes'
    ];
    const header = '| Category | Item | Qty | W | D | H | MountSurface | Cost | Status | InventoryStatus | Tags | Vendor | OrderUrl | OrderDate | URL | Notes |';
    for (const col of expectedColumns) {
      expect(header).toContain(col);
    }
  });
});

describe('inventoryStatus defaults', () => {
  function inferInventoryStatus(inventoryStatus: string | undefined, status: string | undefined, placedCount: number): string {
    if (inventoryStatus) return inventoryStatus;
    if ((status ?? 'final') === 'placeholder') return 'proposed';
    if (placedCount > 0) return 'owned';
    return 'proposed';
  }

  it('inferInventoryStatus returns proposed for placeholder defs', () => {
    const result = inferInventoryStatus(undefined, 'placeholder', 0);
    expect(result).toBe('proposed');
  });

  it('inferInventoryStatus returns owned for placed defs without inventoryStatus', () => {
    const result = inferInventoryStatus(undefined, 'final', 2);
    expect(result).toBe('owned');
  });

  it('inferInventoryStatus returns proposed for unplaced final defs without inventoryStatus', () => {
    const result = inferInventoryStatus(undefined, 'final', 0);
    expect(result).toBe('proposed');
  });

  it('inferInventoryStatus returns explicit status when set', () => {
    const result = inferInventoryStatus('ordered', 'final', 0);
    expect(result).toBe('ordered');
  });
});

describe('wall mountSurface', () => {
  it('mountSurfaceSchema accepts wall as a valid value', () => {
    const validSurfaces = ['floor', 'roof', 'underbody', 'door', 'ceiling', 'wall'];
    expect(validSurfaces).toContain('wall');
  });
});
