import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import tokens from '../tokens.json';
import { chapters } from '../chapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const root = process.cwd();
  const [guide, motion, libraries] = await Promise.all([
    readFile(join(root, 'docs/design-system.md'), 'utf8'),
    readFile(join(root, 'components/arc/motion-tokens.ts'), 'utf8'),
    readFile(join(root, 'package.json'), 'utf8'),
  ]);
  const pageRules = chapters.map(chapter => `## ${chapter.title}\n\n${chapter.intro}\n\n${chapter.rules.map(([title, body]) => `### ${title}\n\n${body}`).join("\n\n")}`).join("\n\n");
  const markdown = `${guide}\n\n# Current page rules\n\n${pageRules}\n\n## Current complete token inventory\n\n| Token | Light | Dark |\n| --- | --- | --- |\n${tokens.map(token => `| ${token.name} | ${token.light.replaceAll('|', '\\|')} | ${token.dark.replaceAll('|', '\\|')} |`).join('\n')}\n\n## Current motion implementation\n\n\`\`\`typescript\n${motion}\n\`\`\`\n\n## Current libraries and scripts\n\n\`\`\`json\n${libraries}\n\`\`\`\n`;
  return new Response(markdown, { headers: {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': 'attachment; filename="forma-design-system.md"',
    'Cache-Control': 'no-store',
  } });
}
