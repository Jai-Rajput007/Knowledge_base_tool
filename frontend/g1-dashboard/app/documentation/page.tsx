import React from 'react';
import { DocSidebar } from './components/doc-sidebar';
import { DocSearch } from './components/doc-search';
import { DocSection } from './components/doc-section';
import { Callout } from './components/callout';

export const metadata = {
  title: 'Documentation - VEDA',
  description: 'Complete documentation for the VEDA platform',
};

export default function DocumentationPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-4 pb-12">
      
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Documentation</h1>
          <p className="text-muted-foreground mt-2">Complete guide to the VEDA platform</p>
        </div>
        
        {/* Search Bar at Top Right */}
        <div className="w-full md:w-auto relative z-50">
          <DocSearch />
        </div>
      </div>
      
      <div className="flex gap-12 items-start relative">
        
        {/* Fixed Left Sidebar */}
        <DocSidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pb-32">
          
          {/* CATEGORY: CORE PLATFORM */}
          
          <DocSection id="getting-started" categoryName="Core Platform" title="Getting Started">
            <p className="text-lg">
              Welcome to <strong>VEDA</strong>. The VEDA Control Center is the central hub for managing your robotic fleet's AI personas, knowledge base, facial recognition systems, and hardware telemetry.
            </p>
            
            <h3 className="text-xl font-semibold mt-8 mb-4">Quick Start</h3>
            <div className="overflow-x-auto my-6 rounded-xl border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Step</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Where</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">1</td>
                    <td className="px-4 py-3">Upload business documents</td>
                    <td className="px-4 py-3 text-primary">Knowledge Base</td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">2</td>
                    <td className="px-4 py-3">Configure the robot's personality</td>
                    <td className="px-4 py-3 text-primary">Persona Engine</td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">3</td>
                    <td className="px-4 py-3">Train a custom wakeword</td>
                    <td className="px-4 py-3 text-primary">Wake Words</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DocSection>


          <DocSection id="dashboard" categoryName="Core Platform" title="Dashboard">
            <p>
              The Dashboard serves as the command center for your entire VEDA ecosystem. It provides real-time telemetry and a high-level overview of all active modules.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">Preview Panel</h3>
            <p>
              The preview panel consists of dynamic cards for every major feature. Each card displays actual real-time data from the backend APIs. For example, the <strong>Knowledge Hub</strong> card shows exactly how many documents are indexed, and the <strong>Persona Engine</strong> card displays the currently active persona deployed to the robot.
            </p>
            <Callout type="note" title="Health Status">
              The <strong>AGX Health Status</strong> and <strong>Robot Health Status</strong> badges at the top of the dashboard ping the physical hardware directly. If the AGX is turned off or disconnected from the network, these will show as offline.
            </Callout>
          </DocSection>

          {/* CATEGORY: AI & PERSONA */}
          
          <DocSection id="persona-engine" categoryName="AI & Persona" title="Persona Engine">
            <p>
              The Persona Engine allows you to define exactly how the robot thinks, speaks, and behaves. It acts as the core "brain" configuration.
            </p>
            
            <h3 className="text-xl font-semibold mt-8 mb-4">Key Concepts</h3>
            <ul className="space-y-4">
              <li><strong>Identity:</strong> The robot's Name, Company, Role, and physical Location.</li>
              <li><strong>System Prompt:</strong> The core directive fed to the LLM. This dictates the ultimate rules of engagement.</li>
              <li><strong>Conversation Rules:</strong> Specific constraints (e.g., "Never discuss pricing", "Always be polite").</li>
            </ul>

            <h3 className="text-xl font-semibold mt-8 mb-4">Deploying a Persona</h3>
            <ol className="list-decimal list-inside space-y-2 my-4">
              <li>Go to the Persona Engine page.</li>
              <li>Fill out the Identity and System Prompt fields.</li>
              <li>Click <strong>Deploy to Robot</strong>.</li>
            </ol>
            
            <Callout type="warning" title="Exclusive Activation">
              Only <strong>one persona</strong> can be active at a time. When you deploy a new persona, the previously active one is automatically deactivated and saved to the library.
            </Callout>
          </DocSection>

          <DocSection id="generative-persona" categoryName="AI & Persona" title="Generative Persona">
            <p>
              If you don't want to write a complex system prompt from scratch, you can use the Generative Persona tool. By providing a short description of what you want, the system uses a local LLM to generate a highly detailed, professional configuration for you.
            </p>
            <Callout type="info" title="Requirements">
              This feature requires Ollama to be running locally on the server to process the generation request.
            </Callout>
          </DocSection>

          <DocSection id="persona-library" categoryName="AI & Persona" title="Persona Library">
            <p>
              The Persona Library stores all previously created and generated personas. You can view it as a version history of the robot's brain. From here, you can seamlessly switch the robot's personality by selecting a saved profile and clicking "Set Active".
            </p>
          </DocSection>

          <DocSection id="knowledge-base" categoryName="AI & Persona" title="Knowledge Base (RAG)">
            <p>
              The Knowledge Base uses Retrieval-Augmented Generation (RAG) to give the robot access to your proprietary business documents. Instead of hallucinating, the robot will search these documents to answer user questions.
            </p>
            
            <h3 className="text-xl font-semibold mt-8 mb-4">Supported Formats</h3>
            <div className="flex gap-4 my-4">
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">.PDF</span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">.DOCX</span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">.TXT</span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">.CSV</span>
            </div>

            <p className="mt-6">
              When a document is uploaded, it is broken down into smaller <strong>Chunks</strong>, converted into mathematical vectors (Embeddings), and stored in a Vector Database (pgvector).
            </p>
            <Callout type="warning" title="Indexing Time">
              Large documents (over 50 pages) may take several minutes to completely index. Do not close the upload modal until the progress bar completes.
            </Callout>
          </DocSection>

          {/* CATEGORY: ROBOT CONTROL */}

          <DocSection id="facial-recognition" categoryName="Robot Control" title="Facial Recognition (FRS)">
            <p>
              The Facial Recognition System (FRS) manages employee profiles. When the robot's cameras detect a face, it checks this database to identify the person and inject context into the conversation.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">Profile Setup</h3>
            <p>Each profile requires:</p>
            <ul className="list-disc list-inside space-y-1 mb-6">
              <li>Full Name & Employee ID</li>
              <li>Department</li>
              <li>At least 3 clear reference photos</li>
            </ul>
            <p>
              For large organizations, you can use the <strong>Bulk Enrollment</strong> feature to import a CSV of employee data and match it to a folder of images.
            </p>
            <Callout type="danger" title="Privacy Notice">
              Ensure you have explicit consent from employees before storing biometric facial data. Follow all local privacy regulations (e.g., GDPR, CCPA).
            </Callout>
          </DocSection>

          <DocSection id="navigation-mapping" categoryName="Robot Control" title="Navigation & Mapping">
            <p>
              This module interfaces with the robot's SLAM (Simultaneous Localization and Mapping) capabilities.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">Commands</h3>
            <ul className="space-y-4">
              <li><code>slam/start</code> - Begins building a new map of the current environment.</li>
              <li><code>slam/save</code> - Saves the current map to the AGX.</li>
              <li><code>go</code> - Sends coordinates to the robot to autonomously navigate to a saved location.</li>
            </ul>
            <Callout type="note" title="Network Requirement">
              The dashboard must be able to reach the AGX on port 9000 to send navigation commands.
            </Callout>
          </DocSection>

          <DocSection id="gesture-library" categoryName="Robot Control" title="Gesture Library">
            <p>
              Custom gestures allow you to record physical arm movements and save them as reusable actions.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">Recording a Gesture</h3>
            <ol className="list-decimal list-inside space-y-2 my-4">
              <li>Click <strong>Start Recording</strong>. The robot's motors will enter compliant (zero-torque) mode.</li>
              <li>Physically move the robot's arms into the desired sequence.</li>
              <li>Click <strong>Stop Recording</strong>. The trajectory is saved as a <code>.npy</code> file on the AGX.</li>
            </ol>
          </DocSection>

          <DocSection id="custom-wakewords" categoryName="Robot Control" title="Custom Wakewords">
            <p>
              A wakeword is the phrase used to trigger the robot's listening mode (similar to "Hey Siri"). By default, <code>hey_jarvis</code> and <code>hey_g1</code> are available.
            </p>
            <p className="mt-4">
              To train a new wakeword, you must upload audio samples. The system will dispatch a training job to a Kaggle GPU instance.
            </p>
            <Callout type="info" title="Training Time">
              Model training via Kaggle typically takes between 5 to 15 minutes depending on queue times and the number of audio samples.
            </Callout>
          </DocSection>

          {/* CATEGORY: INTEGRATIONS */}

          <DocSection id="mcp-integrations" categoryName="Integrations" title="Integrations (MCP)">
            <p>
              The Model Context Protocol (MCP) allows the robot to interact with external tools and APIs. This gives the AI the ability to actually <em>do</em> things rather than just talk.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">Available Tools</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Google Workspace:</strong> Calendar, Docs, Drive, Gmail, Slides</li>
              <li><strong>Jira:</strong> Ticket management</li>
              <li><strong>Composio:</strong> Advanced 3rd party routing</li>
            </ul>
            <Callout type="note" title="OAuth Authorization">
              Most Google tools require you to complete an OAuth login flow. Click "Connect", sign in with your Google account, and grant the required permissions.
            </Callout>
          </DocSection>

          {/* CATEGORY: MONITORING */}

          <DocSection id="chat-simulator" categoryName="Monitoring" title="Chat Simulator">
            <p>
              The Chat Simulator allows you to test the active persona and knowledge base directly from the dashboard, without needing to speak to the physical robot. It uses the exact same backend LLM pipeline.
            </p>
            <p className="mt-4">
              Old chat sessions are automatically cleaned up after 7 days unless you explicitly <strong>Pin</strong> them.
            </p>
          </DocSection>

          <DocSection id="audit-log" categoryName="Monitoring" title="Audit Log">
            <p>
              For compliance and security, every critical action taken in the VEDA Control Center is recorded in the Audit Log.
            </p>
            <p className="mt-4">
              This includes persona deployments, document uploads, and configuration changes. The log captures the timestamp, the user who performed the action, and the specific API endpoint hit.
            </p>
          </DocSection>

          {/* CATEGORY: SETTINGS */}

          <DocSection id="general-settings" categoryName="Settings" title="General Settings">
            <ul className="space-y-4">
              <li><strong>Auto-Save:</strong> Automatically saves forms as you type.</li>
              <li><strong>Show Sources:</strong> Appends the source document name to the end of the robot's answers when using RAG.</li>
              <li><strong>Streaming:</strong> Enables token-by-token streaming for faster perceived response times.</li>
            </ul>
          </DocSection>

          <DocSection id="security-settings" categoryName="Settings" title="Security Settings">
            <p>
              Manage administrator access and API keys here.
            </p>
            <h3 className="text-xl font-semibold mt-8 mb-4">RBAC (Role-Based Access Control)</h3>
            <p>
              Users can be either <code>admin</code> or <code>user</code>. Admins have access to all system settings, while users can only interact with the chat simulator and view the dashboard.
            </p>
          </DocSection>

          <DocSection id="voice-settings" categoryName="Settings" title="Voice Settings">
            <p>
              Configure the Text-to-Speech (TTS) engine used by the robot. You can select between various male and female voice models. Changes are synced to the AGX immediately.
            </p>
          </DocSection>

          <DocSection id="advanced-settings" categoryName="Settings" title="Advanced Settings">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-foreground">Vector Database</h4>
                <p>VEDA uses PostgreSQL with the <code>pgvector</code> extension to store and query document embeddings efficiently.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Embedding & Chunking</h4>
                <p>The default embedding model is <code>nomic-embed-text:latest</code>. Documents are chunked before embedding to ensure the LLM doesn't exceed its context window during retrieval.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">OTA Updates</h4>
                <p>Over-The-Air (OTA) updates push new firmware from the cloud to the AGX and robotic hardware automatically.</p>
              </div>
            </div>
          </DocSection>

        </main>
      </div>
    </div>
  );
}
