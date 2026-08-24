// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayslipData, PayslipPdfLabels } from './payslip-template';
import { downloadPayslip } from './payslip-download';

vi.mock('./payslip-template', () => ({
  createPayslipPdf: vi.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70]),
    filename: 'payslip-EMP-0007-2026-07.pdf'
  }))
}));

const payslip = {} as PayslipData;
const labels = {} as PayslipPdfLabels;

describe('downloadPayslip', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.clearAllMocks();
  });

  it('saves the PDF under the generated filename', async () => {
    const anchors: HTMLAnchorElement[] = [];
    const createElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tag: string
    ) => {
      const element = createElement(tag);
      if (tag === 'a') anchors.push(element as HTMLAnchorElement);
      return element;
    }) as typeof document.createElement);

    try {
      const filename = await downloadPayslip(payslip, labels);

      expect(filename).toBe('payslip-EMP-0007-2026-07.pdf');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const anchor = anchors.at(-1);
      expect(anchor).toBeDefined();
      expect(anchor?.getAttribute('href')).toBe('blob:mock-url');
      expect(anchor?.getAttribute('download')).toBe('payslip-EMP-0007-2026-07.pdf');
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('revokes the object URL deterministically after click', async () => {
    await downloadPayslip(payslip, labels);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
