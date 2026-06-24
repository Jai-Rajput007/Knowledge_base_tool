const fs = require('fs');
const path = require('path');

const pages = [
  { dir: 'persona', title: 'Persona Manager', sections: ['templates', 'generative', 'role-builder'] },
  { dir: 'rag', title: 'Robot RAG', sections: ['document', 'web'] },
  { dir: 'voice', title: 'Voice Settings', sections: ['cloning', 'tuning'] },
  { dir: 'gesture', title: 'Gesture Settings', sections: ['custom', 'add'] },
  { dir: 'inventory', title: 'Robot Inventory', sections: ['health'] },
  { dir: 'mcp', title: 'Model Context Protocol', sections: [] },
  { dir: 'wake-word', title: 'Wake Word', sections: [] },
  { dir: 'frs', title: 'Facial Recognition System', sections: [] },
  { dir: 'audit-logs', title: 'Audit Logs', sections: [] },
];

pages.forEach(p => {
  const dirPath = path.join('/home/jai/g1-universe/knowledge_base_tool/frontend/g1-dashboard/app', p.dir);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const content = `
export default function ${p.title.replace(/\s+/g, '')}Page() {
  return (
    <div className="max-w-5xl mx-auto space-y-24 pb-32 pt-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">${p.title}</h1>
        <p className="text-muted-foreground mt-2">Manage your ${p.title.toLowerCase()} settings here.</p>
      </div>

      ${p.sections.map(s => `
      <section id="${s}" className="min-h-[50vh] border border-border rounded-xl p-8 bg-card shadow-sm scroll-mt-28">
        <h2 className="text-2xl font-semibold mb-4 capitalize text-foreground">${s.replace('-', ' ')}</h2>
        <p className="text-muted-foreground">Configuration panel for ${s.replace('-', ' ')}.</p>
      </section>
      `).join('')}
    </div>
  );
}
  `;
  fs.writeFileSync(path.join(dirPath, 'page.tsx'), content.trim());
});
console.log("Pages scaffolded successfully!");
