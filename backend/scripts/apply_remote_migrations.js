const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment from root .env
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env not found at', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF;

if (!token || !projectRef) {
  console.error('ERROR: Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env');
  process.exit(1);
}

const { execSync } = require('child_process');

function executeSql(sql) {
  const payload = JSON.stringify({ query: sql });
  const tmpFile = `/tmp/sql_query_${Date.now()}_${Math.random().toString(36).substring(2)}.json`;
  fs.writeFileSync(tmpFile, payload, 'utf8');

  try {
    const cmd = `curl -s -X POST \
      -H "Authorization: Bearer ${token}" \
      -H "Content-Type: application/json" \
      --data @${tmpFile} \
      "https://api.supabase.com/v1/projects/${projectRef}/database/query"`;

    const stdout = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    fs.unlinkSync(tmpFile);
    try {
      return JSON.parse(stdout);
    } catch {
      return stdout;
    }
  } catch (err) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    throw err;
  }
}

async function run() {
  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log(`Applying ${files.length} migrations to remote Supabase project: ${projectRef}...`);

  for (const file of files) {
    console.log(`\n--- Applying Migration: ${file} ---`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await executeSql(sql);
      console.log(`SUCCESS: ${file} applied successfully.`);
    } catch (err) {
      console.error(`ERROR applying ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n--- Reloading PostgREST Schema Cache ---');
  try {
    await executeSql("NOTIFY pgrst, 'reload schema';");
    console.log('SUCCESS: PostgREST schema reloaded.');
  } catch (err) {
    console.warn('Notice: Could not notify pgrst:', err.message);
  }

  console.log('\nAll remote migrations applied successfully!');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
