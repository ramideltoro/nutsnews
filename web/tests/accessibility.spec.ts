import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type AxeNode = {
  target: string[];
  failureSummary?: string | null;
};

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
};

type AuditedPage = {
  name: string;
  path: string;
};

const auditedPages: AuditedPage[] = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Privacy', path: '/privacy' },
  { name: 'Contact', path: '/contact' },
  { name: 'Admin access denied', path: '/admin/access-denied?error=Configuration' },
];

const blockingImpacts = new Set(['critical', 'serious']);

function formatViolations(violations: AxeViolation[]) {
  if (violations.length === 0) {
    return 'No serious or critical accessibility violations were found.';
  }

  return violations
    .map((violation) => {
      const affectedNodes = violation.nodes
        .slice(0, 5)
        .map((node) => {
          const target = node.target.join(' ');
          const summary = node.failureSummary ? `\n      ${node.failureSummary}` : '';
          return `    - ${target}${summary}`;
        })
        .join('\n');

      const hiddenCount = Math.max(violation.nodes.length - 5, 0);
      const hiddenNote = hiddenCount > 0 ? `\n    - ...and ${hiddenCount} more node(s)` : '';

      return [
        `${violation.id} [${violation.impact ?? 'unknown impact'}]`,
        `  ${violation.help}`,
        `  ${violation.helpUrl}`,
        affectedNodes,
        hiddenNote,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

test.describe('NutsNews axe accessibility checks', () => {
  for (const auditedPage of auditedPages) {
    test(`${auditedPage.name} page has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(auditedPage.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blockingViolations = results.violations.filter((violation) =>
        blockingImpacts.has(violation.impact ?? ''),
      ) as AxeViolation[];

      expect(blockingViolations, formatViolations(blockingViolations)).toEqual([]);
    });
  }
});
