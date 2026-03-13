// Database service using sql.js (pure-JS SQLite)
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'nurzeka.db');
console.log('📦 Database path resolved to:', path.resolve(DB_PATH));

let db = null;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();

  // Ensure directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Başlıksız Not',
      content TEXT NOT NULL,
      source_text TEXT,
      source_book TEXT,
      source_section TEXT,
      ai_response TEXT,
      tags TEXT,
      color TEXT DEFAULT 'yellow',
      is_public INTEGER DEFAULT 0,
      share_link TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migration: Add color column if not exists
  try {
    const tableInfo = db.exec("PRAGMA table_info(notes)");
    const columns = tableInfo[0].values.map(col => col[1]);
    if (!columns.includes('color')) {
      db.run("ALTER TABLE notes ADD COLUMN color TEXT DEFAULT 'yellow'");
      console.log('  ✨ Migration: Added color column to notes');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources TEXT,
      ai_model TEXT DEFAULT 'deepseek',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_interpretations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_text TEXT NOT NULL,
      interpretation TEXT NOT NULL,
      source_book TEXT,
      source_section TEXT,
      status TEXT DEFAULT 'pending',
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_slug TEXT NOT NULL,
      percentage REAL DEFAULT 0,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, book_slug, chapter_slug),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      book_slug TEXT,
      chapter_slug TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migration: Add google_id and picture to users if not exists
  try {
    const tableInfo = db.exec("PRAGMA table_info(users)");
    const columns = tableInfo[0].values.map(col => col[1]);
    if (!columns.includes('google_id')) {
      db.run("ALTER TABLE users ADD COLUMN google_id TEXT"); // SQLite ALTER TABLE ADD COLUMN cannot be UNIQUE directly
      console.log('  ✨ Migration: Added google_id to users');
    }
    if (!columns.includes('picture')) {
      db.run("ALTER TABLE users ADD COLUMN picture TEXT");
      console.log('  ✨ Migration: Added picture to users');
    }
  } catch (e) {
    console.error('Migration error (users):', e);
  }

  // Create Bookmarks Table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_slug TEXT NOT NULL,
      selector TEXT,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create Highlights Table
  db.run(`
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_slug TEXT NOT NULL,
      chapter_slug TEXT NOT NULL,
      text TEXT,
      range_start TEXT,
      range_end TEXT,
      color TEXT DEFAULT 'yellow',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        user_id TEXT,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add message_count to conversations if not exists
  try {
    const convInfo = db.exec("PRAGMA table_info(conversations)");
    if (convInfo.length > 0) {
      const convCols = convInfo[0].values.map(col => col[1]);
      if (!convCols.includes('message_count')) {
        db.run("ALTER TABLE conversations ADD COLUMN message_count INTEGER DEFAULT 0");
        console.log('  ✨ Migration: Added message_count to conversations');
      }
    }
  } catch (e) {
    console.error('Migration error (conversations):', e);
  }

  // Migration: Add user_id to messages if not exists
  try {
    const msgInfo = db.exec("PRAGMA table_info(messages)");
    if (msgInfo.length > 0) {
      const msgCols = msgInfo[0].values.map(col => col[1]);
      if (!msgCols.includes('user_id')) {
        db.run("ALTER TABLE messages ADD COLUMN user_id TEXT");
        console.log('  ✨ Migration: Added user_id to messages');
      }
    }
  } catch (e) {
    console.error('Migration error (messages):', e);
  }

  // Create indexes for conversations system
  try {
    db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC)");
    db.run("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC)");
  } catch (e) { /* indexes may already exist */ }

  saveDB(); // Ensure schema changes are saved immediately
  console.log('  ✅ Database initialized and migrated');
  return db;
}

// Save database to file
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run query and save
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDB();
}

// Helper: get single row
function get(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);

  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    return row;
  }
  stmt.free();
  return null;
}

// Helper: get all rows
function all(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];
  const cols = stmt.getColumnNames();

  while (stmt.step()) {
    const vals = stmt.get();
    const row = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// Helper: get changes count from last run
function changes() {
  if (!db) return 0;
  const result = db.exec('SELECT changes()');
  return result[0]?.values[0]?.[0] || 0;
}

export { initDB, run, get, all, changes, saveDB };
export default { initDB, run, get, all, changes, saveDB };
