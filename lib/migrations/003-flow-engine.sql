-- ============================================================================
-- Flow Engine Migration (003)
-- 
-- Adds tables for flow execution tracking:
-- - flow_executions: Track each flow run (campaign or chatbot session)
-- - node_executions: Track individual node executions within a flow
-- ============================================================================

-- Flow Executions: Track each run of a flow
CREATE TABLE IF NOT EXISTS flow_executions (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('campaign', 'chatbot')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  trigger_source TEXT,  -- campaign_id or webhook_message_id
  
  -- Metrics (for campaigns)
  contact_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TEXT,
  completed_at TEXT,
  paused_at TEXT,
  
  -- Error info
  error_code INTEGER,
  error_message TEXT,
  
  -- Metadata (JSON: global variables, config)
  metadata TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- Indexes for flow_executions
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_status 
  ON flow_executions(flow_id, status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status 
  ON flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_created 
  ON flow_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_executions_trigger 
  ON flow_executions(trigger_source);

-- Node Executions: Track each node execution within a flow run
CREATE TABLE IF NOT EXISTS node_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  node_id TEXT NOT NULL,  -- Reference to node in flow JSON
  node_type TEXT NOT NULL,
  
  -- Contact info (for campaigns with multiple contacts)
  contact_phone TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  
  -- Input/Output (JSON)
  input TEXT,
  output TEXT,
  
  -- WhatsApp message tracking
  whatsapp_message_id TEXT,
  
  -- Error info
  error_code INTEGER,
  error_message TEXT,
  
  -- Performance
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (execution_id) REFERENCES flow_executions(id) ON DELETE CASCADE
);

-- Indexes for node_executions
CREATE INDEX IF NOT EXISTS idx_node_executions_execution 
  ON node_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_message 
  ON node_executions(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_status 
  ON node_executions(status);
CREATE INDEX IF NOT EXISTS idx_node_executions_node 
  ON node_executions(execution_id, node_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_contact 
  ON node_executions(execution_id, contact_phone);
