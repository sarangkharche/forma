import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const allowed = /^(https?:\/\/|codex:\/\/threads\/)/i.test(link[2]);
      return allowed ? <a key={index} href={link[2]} target={link[2].startsWith('codex:') ? undefined : '_blank'} rel="noreferrer">{link[1]}</a> : link[1];
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function Markdown({ text }: { text: string }) {
  const lines = text.trim().split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const heading = lines[i].match(/^#{1,6}\s+(.+)/);
    if (heading) { blocks.push(<h4 key={i}>{inline(heading[1])}</h4>); i++; continue; }
    const list = lines[i].match(/^\s*(\d+[.)]|[-*])\s+(.+)/);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const items: ReactNode[] = []; const start = i;
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(\d+[.)]|[-*])\s+(.+)/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        let body = item[2]; const key = i++;
        while (i < lines.length && lines[i].trim() && !/^\s*(?:\d+[.)]|[-*]|#{1,6})\s/.test(lines[i])) body += ' ' + lines[i++].trim();
        items.push(<li key={key}>{inline(body)}</li>);
        while (i < lines.length && !lines[i].trim()) i++;
      }
      blocks.push(ordered ? <ol key={start} start={Number.parseInt(list[1])}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    const start = i; let paragraph = lines[i++];
    while (i < lines.length && lines[i].trim() && !/^\s*(?:#{1,6}|\d+[.)]|[-*])\s/.test(lines[i])) paragraph += ' ' + lines[i++].trim();
    blocks.push(<p key={start}>{inline(paragraph)}</p>);
  }
  return <div className="result-markdown">{blocks}</div>;
}

const sectionLabels: Record<string, string> = {
  'summary': 'At a glance', 'findings': 'What happened', 'what happened': 'What happened',
  'recommended next step': 'What to do next', 'actions': 'What to do next', 'what to do next': 'What to do next',
  'missing information': 'Still unknown', 'still unknown': 'Still unknown',
  'suggested task changes': 'Suggested task updates', 'sources': 'Sources',
};

export function TriageResult({ text }: { text: string }) {
  const sections: Array<{ title: string; body: string }> = [];
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+)\s*$/);
    if (heading) sections.push({ title: heading[1], body: '' });
    else { if (!sections.length) sections.push({ title: '', body: '' }); sections[sections.length - 1].body += line + '\n'; }
  }
  // Keep all evidence, while putting the actionable next step first in older results.
  const rank = (title: string) => ({'At a glance': 0, 'What to do next': 1, 'What happened': 2, 'Still unknown': 3, 'Suggested task updates': 4, 'Sources': 5}[sectionLabels[title.toLowerCase()]] ?? 6);
  return <div className="triage-result-content">{sections.filter(s => s.body.trim()).sort((a, b) => rank(a.title) - rank(b.title)).map((section, index) => {
    const label = sectionLabels[section.title.toLowerCase()] || section.title;
    const content = <Markdown text={section.body}/>;
    return label === 'Sources' || label === 'Suggested task updates'
      ? <details key={index}><summary>{label}</summary>{content}</details>
      : <section key={index}>{label && <h4>{label}</h4>}{content}</section>;
  })}</div>;
}
