# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global.setup.ts >> authenticate
- Location: tests/global.setup.ts:6:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#email')

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - navigation [ref=e6]:
            - button "previous" [disabled] [ref=e7]:
              - img "previous" [ref=e8]
            - generic [ref=e10]:
              - generic [ref=e11]: 1/
              - text: "1"
            - button "next" [disabled] [ref=e12]:
              - img "next" [ref=e13]
          - img
        - generic [ref=e15]:
          - link "Next.js 16.2.4 (stale) Turbopack" [ref=e16] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e17]
            - generic "There is a newer version (16.2.10) available, upgrade recommended!" [ref=e19]: Next.js 16.2.4 (stale)
            - generic [ref=e20]: Turbopack
          - img
      - dialog "Build Error" [ref=e22]:
        - generic [ref=e25]:
          - generic [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e29]: Build Error
              - generic [ref=e30]:
                - button "Copy Error Info" [ref=e31] [cursor=pointer]:
                  - img [ref=e32]
                - link "Go to related documentation" [ref=e34] [cursor=pointer]:
                  - /url: https://nextjs.org/docs/messages/module-not-found
                  - img [ref=e35]
                - button "Attach Node.js inspector" [ref=e37] [cursor=pointer]:
                  - img [ref=e38]
            - generic [ref=e47]: "Module not found: Can't resolve '../persona/context'"
          - generic [ref=e49]:
            - generic [ref=e51]:
              - img [ref=e53]
              - generic [ref=e57]: ./app/features/persona-change/hooks/usePersonaChange.ts (2:1)
              - button "Open in editor" [ref=e58] [cursor=pointer]:
                - img [ref=e60]
            - generic [ref=e63]:
              - generic [ref=e64]: Module not found
              - generic [ref=e65]: ": Can't resolve"
              - text: "'../persona/context'"
              - generic [ref=e66]: 1 |
              - text: import
              - generic [ref=e67]: "{ useState, useEffect }"
              - text: from "react"
              - generic [ref=e68]: ;
              - text: ">"
              - generic [ref=e69]: 2 |
              - text: import
              - generic [ref=e70]: "{ usePersonaContext }"
              - text: from "../persona/context"
              - generic [ref=e71]: ;
              - generic [ref=e72]: "|"
              - text: ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              - generic [ref=e73]: 3 |
              - text: import
              - generic [ref=e74]: "{"
              - text: SaveResult
              - generic [ref=e75]: "}"
              - text: from "./types"
              - generic [ref=e76]: ;
              - generic [ref=e77]: 4 |
              - generic [ref=e78]: 5 |
              - text: export function
              - generic [ref=e79]:
                - text: "usePersonaChange() { Import traces: Client Component Browser: ./app/features/persona-change/hooks/usePersonaChange.ts [Client Component Browser] ./app/features/persona-change/index.tsx [Client Component Browser] ./app/persona/page.tsx [Client Component Browser] ./app/persona/page.tsx [Server Component] Client Component SSR: ./app/features/persona-change/hooks/usePersonaChange.ts [Client Component SSR] ./app/features/persona-change/index.tsx [Client Component SSR] ./app/persona/page.tsx [Client Component SSR] ./app/persona/page.tsx [Server Component]"
                - link "https://nextjs.org/docs/messages/module-not-found" [ref=e80] [cursor=pointer]:
                  - /url: https://nextjs.org/docs/messages/module-not-found
        - generic [ref=e81]: "1"
        - generic [ref=e82]: "2"
    - generic [ref=e87] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e88]:
        - img [ref=e89]
      - button "Open issues overlay" [ref=e93]:
        - generic [ref=e94]:
          - generic [ref=e95]: "0"
          - generic [ref=e96]: "1"
        - generic [ref=e97]: Issue
  - alert [ref=e98]
```

# Test source

```ts
  1  | import { test as setup, expect } from '@playwright/test';
  2  | import * as fs from 'fs';
  3  | 
  4  | const authFile = 'playwright/.auth/user.json';
  5  | 
  6  | setup('authenticate', async ({ page }) => {
  7  |   // Navigate to login page
  8  |   await page.goto('/sign-in');
  9  |   
  10 |   // Fill credentials
> 11 |   await page.locator('#email').fill('jai.s.rajput.dev@gmail.com');
     |                                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  12 |   await page.locator('#password').fill('Jai@#123');
  13 |   
  14 |   // Click login
  15 |   await page.locator('button[type="submit"]').click();
  16 |   
  17 |   // Wait until the page receives the cookies/token and redirects to dashboard
  18 |   await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {
  19 |     console.log("URL didn't change to /dashboard, continuing to save state...");
  20 |   });
  21 |   
  22 |   // Save storage state to a file
  23 |   await page.context().storageState({ path: authFile });
  24 | });
  25 | 
```