-- Migration: 001-chatbot-system
-- Sistema de Chatbot WhatsApp (Regras + IA)
-- Date: 2025-12-03

-- Bots
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  flow_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  welcome_message TEXT,
  fallback_message TEXT,
  session_timeout_minutes INTEGER DEFAULT 30,
  trigger_keywords TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bots_phone ON bots(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);

-- Flows
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  is_main_flow INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flows_bot ON flows(bot_id);
CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status);

-- Bot Conversations
CREATE TABLE IF NOT EXISTS bot_conversations (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  current_node_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_operator_id TEXT,
  csw_started_at TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_botconv_bot ON bot_conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_botconv_phone ON bot_conversations(contact_phone);
CREATE INDEX IF NOT EXISTS idx_botconv_status ON bot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_botconv_operator ON bot_conversations(assigned_operator_id);

-- Conversation Variables
CREATE TABLE IF NOT EXISTS conversation_variables (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES bot_conversations(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, key)
);

CREATE INDEX IF NOT EXISTS idx_convvar_conv ON conversation_variables(conversation_id);

-- Bot Messages
CREATE TABLE IF NOT EXISTS bot_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  wa_message_id TEXT,
  direction TEXT NOT NULL,
  origin TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  read_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES bot_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_botmsg_conv ON bot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_botmsg_wa ON bot_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_botmsg_created ON bot_messages(created_at);

-- AI Agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  max_tokens INTEGER DEFAULT 500,
  temperature REAL DEFAULT 0.7,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- AI Tools
CREATE TABLE IF NOT EXISTS ai_tools (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters_schema TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  timeout_ms INTEGER DEFAULT 10000,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tools_agent ON ai_tools(agent_id);

-- Tool Executions
CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES bot_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exec_tool ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_exec_conv ON tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_exec_created ON tool_executions(created_at);
