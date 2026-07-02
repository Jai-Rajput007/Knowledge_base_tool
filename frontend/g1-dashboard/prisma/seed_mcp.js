const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// A comprehensive catalog derived from the MCP Development Plan
const mcpTools = [
  // ==========================================
  // 1. ROBOT PHYSICAL LAYER (Basic/Included)
  // ==========================================
  { name: 'Face Recognition', category: 'Robot Physical', description: 'Real-time face detection & identification.', tier: 'BASIC', provider: 'opencv-mcp-server' },
  { name: 'Person Detection', category: 'Robot Physical', description: 'Human detection in camera feed.', tier: 'BASIC', provider: 'opencv-mcp-server' },
  { name: 'PPE Detection', category: 'Robot Physical', description: 'Safety helmet, vest, glove detection.', tier: 'BASIC', provider: 'opencv-mcp-server' },
  { name: 'Navigation (ROS2)', category: 'Robot Physical', description: 'Navigate to pose, waypoints, docking.', tier: 'BASIC', provider: 'nav2_mcp_server' },
  { name: 'Battery Status', category: 'Robot Physical', description: 'Real-time voltage, charge, health telemetry.', tier: 'BASIC', provider: 'Custom ROS2' },
  { name: 'Camera Control', category: 'Robot Physical', description: 'Pan/tilt/zoom, capture, stream settings.', tier: 'BASIC', provider: 'Custom ROS2' },
  { name: 'Diagnostics', category: 'Robot Physical', description: 'System health, error logs, sensor status.', tier: 'BASIC', provider: 'Custom ROS2' },

  // ==========================================
  // 2. COMMUNICATION & COLLABORATION
  // ==========================================
  { name: 'Google Workspace (Mail/Docs)', category: 'Communication', description: 'Read, send, search, label, thread analysis via GWS.', tier: 'BASIC', provider: 'taylorwilsdon/google_workspace_mcp', requiredFields: JSON.stringify([{ name: 'OAUTH_JSON', type: 'textarea', label: 'Google Workspace OAuth JSON' }]) },
  { name: 'Outlook / Microsoft 365', category: 'Communication', description: 'Email, Calendar, Tasks unified.', tier: 'PRO', provider: 'momer17/MailMCP' },
  { name: 'Slack', category: 'Communication', description: 'Channels, messages, notifications.', tier: 'PRO', provider: 'composio' },
  { name: 'Microsoft Teams', category: 'Communication', description: 'Chat, meetings, channels.', tier: 'PRO', provider: 'withone' },
  { name: 'Discord', category: 'Communication', description: 'Messages, channels, server management.', tier: 'PRO', provider: 'opentabs' },
  { name: 'Zoom', category: 'Communication', description: 'Meeting creation, scheduling.', tier: 'PRO', provider: 'composio' },
  { name: 'Telegram', category: 'Communication', description: 'Bot messaging.', tier: 'PRO', provider: 'composio' },

  // ==========================================
  // 3. CALENDAR & SCHEDULING
  // ==========================================
  { name: 'Google Calendar', category: 'Scheduling', description: 'CRUD events, availability, recurring.', tier: 'BASIC', provider: 'taylorwilsdon/google_workspace_mcp' },
  { name: 'Appointment System', category: 'Scheduling', description: 'Booking, rescheduling, notifications.', tier: 'PRO', provider: 'calendesk MCP' },
  { name: 'Tasks (Google/Outlook)', category: 'Scheduling', description: 'Create, complete, manage to-dos.', tier: 'BASIC', provider: 'taylorwilsdon/google_workspace_mcp' },

  // ==========================================
  // 4. PRODUCTIVITY & OFFICE
  // ==========================================
  { name: 'Google Drive', category: 'Productivity', description: 'Upload, download, search, organize.', tier: 'BASIC', provider: 'taylorwilsdon/google_workspace_mcp' },
  { name: 'OneDrive', category: 'Productivity', description: 'File storage, sync, sharing.', tier: 'PRO', provider: 'composio' },
  { name: 'Google Docs & Sheets', category: 'Productivity', description: 'Create, edit, format documents & spreadsheets.', tier: 'BASIC', provider: 'taylorwilsdon/google_workspace_mcp' },
  { name: 'Microsoft Word & Excel', category: 'Productivity', description: 'Document editing & spreadsheet operations.', tier: 'PRO', provider: 'withone' },
  { name: 'Notion', category: 'Productivity', description: 'Databases, wikis, project mgmt.', tier: 'PRO', provider: 'composio' },
  { name: 'Confluence', category: 'Productivity', description: 'Documentation, wikis.', tier: 'PRO', provider: 'athapong/aio-mcp' },
  { name: 'SharePoint', category: 'Productivity', description: 'Document management, intranet.', tier: 'PRO', provider: 'composio' },

  // ==========================================
  // 5. SEARCH & KNOWLEDGE
  // ==========================================
  { name: 'Wikipedia', category: 'Knowledge', description: 'Article search, summary, content.', tier: 'BASIC', provider: 'wikipedia MCP' },
  { name: 'Web Search (Brave)', category: 'Knowledge', description: 'Privacy-focused web search.', tier: 'BASIC', provider: 'brave-search', requiredFields: JSON.stringify([{ name: 'API_KEY', type: 'password', label: 'Brave API Key' }]) },
  { name: 'Web Search (DuckDuckGo)', category: 'Knowledge', description: 'Anonymous search.', tier: 'BASIC', provider: 'duckduckgo MCP' },
  { name: 'News Search', category: 'Knowledge', description: 'Current events, news aggregation.', tier: 'PRO', provider: 'withone' },

  // ==========================================
  // 6. LOCATION & LOCAL SERVICES
  // ==========================================
  { name: 'Maps & Traffic', category: 'Location', description: 'Places, directions, real-time traffic.', tier: 'BASIC', provider: 'cablate/mcp-google-map' },
  { name: 'Timezone', category: 'Location', description: 'All IANA timezones, conversion.', tier: 'BASIC', provider: 'mcp-server-time' },
  { name: 'Weather', category: 'Location', description: 'Global forecasts, no API key required.', tier: 'BASIC', provider: 'dangahagan/weather-mcp' },
  { name: 'Currency', category: 'Location', description: 'Live + historical exchange rates.', tier: 'BASIC', provider: 'currency-mcp' },

  // ==========================================
  // 7. BUSINESS & ENTERPRISE SYSTEMS
  // ==========================================
  { name: 'Jira', category: 'Business', description: 'Issues, sprints, project tracking.', tier: 'PRO', provider: 'athapong/aio-mcp' },
  { name: 'GitHub', category: 'Business', description: 'Repos, issues, PRs, code search.', tier: 'PRO', provider: 'composio' },
  { name: 'GitLab', category: 'Business', description: 'Repos, CI/CD, issues.', tier: 'PRO', provider: 'athapong/aio-mcp' },
  { name: 'Salesforce', category: 'Business', description: 'CRM, leads, opportunities.', tier: 'PRO', provider: 'composio' },
  { name: 'HubSpot', category: 'Business', description: 'Marketing, sales, CRM.', tier: 'PRO', provider: 'composio' },
  { name: 'SAP', category: 'Business', description: 'ERP, inventory, finance.', tier: 'PRO', provider: 'composio' },
  { name: 'Oracle ERP', category: 'Business', description: 'Enterprise resource planning.', tier: 'PRO', provider: 'composio' },
  { name: 'HRMS', category: 'Business', description: 'HR, payroll, attendance.', tier: 'PRO', provider: 'composio' },

  // ==========================================
  // 8. PROJECT MANAGEMENT
  // ==========================================
  { name: 'Asana', category: 'Project Mgmt', description: 'Task & project management.', tier: 'PRO', provider: 'withone' },
  { name: 'Monday.com', category: 'Project Mgmt', description: 'Work management.', tier: 'PRO', provider: 'composio' },
  { name: 'Trello', category: 'Project Mgmt', description: 'Kanban boards.', tier: 'PRO', provider: 'opentabs' },
  { name: 'Airtable', category: 'Project Mgmt', description: 'Database-spreadsheet hybrid.', tier: 'PRO', provider: 'composio' },

  // ==========================================
  // 9. CLOUD & DEVOPS
  // ==========================================
  { name: 'AWS', category: 'Cloud', description: 'Cloud resource management.', tier: 'PRO', provider: 'opentabs' },
  { name: 'Azure', category: 'Cloud', description: 'Cloud services management.', tier: 'PRO', provider: 'composio' },
  { name: 'Google Cloud', category: 'Cloud', description: 'Cloud resource ops.', tier: 'PRO', provider: 'composio' },

  // ==========================================
  // 10. E-COMMERCE & FINANCE
  // ==========================================
  { name: 'QuickBooks', category: 'Finance', description: 'Accounting, invoicing.', tier: 'PRO', provider: 'composio' },
  { name: 'Stripe', category: 'Finance', description: 'Payments, billing.', tier: 'PRO', provider: 'composio' },
  { name: 'Shopify', category: 'E-Commerce', description: 'Store management, orders, products.', tier: 'PRO', provider: 'withone' },
  { name: 'WooCommerce', category: 'E-Commerce', description: 'WordPress e-commerce.', tier: 'PRO', provider: 'composio' },
];

async function main() {
  console.log('Mass Seeding MCP Integrations from Dev Plan...');
  
  for (const tool of mcpTools) {
    const exists = await prisma.mcpIntegration.findFirst({
      where: { name: tool.name }
    });
    
    if (!exists) {
      await prisma.mcpIntegration.create({
        data: {
          name: tool.name,
          category: tool.category,
          description: tool.description,
          tier: tool.tier,
          provider: tool.provider,
          providerConfig: tool.providerConfig || '{}',
          requiredFields: tool.requiredFields || '[]'
        }
      });
      console.log(`+ Added ${tool.name} (${tool.tier})`);
    } else {
      console.log(`= Skipped ${tool.name} (already exists)`);
    }
  }
  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
