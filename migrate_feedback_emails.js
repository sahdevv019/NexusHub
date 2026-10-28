/**
 * NexusHub — Safe, Backup-First Migration Utility for Legacy Feedback Documents
 * 
 * Purpose:
 * Audits public feedback documents in Cloud Firestore for exposed 'userEmail' fields,
 * creates a verified pre-migration local backup preserving Timestamps and all field types,
 * and removes only 'userEmail' using FieldValue.delete() without rewriting whole reviews.
 * 
 * Authentication:
 * Uses the official Firebase Admin SDK with Google Application Default Credentials (ADC).
 * Never hardcodes or logs private credentials, tokens, or reviewer emails.
 * 
 * Usage:
 *   node migrate_feedback_emails.js --dry-run                 # Read-only audit (default)
 *   node migrate_feedback_emails.js --execute                 # Backup-first batch execution
 *   node migrate_feedback_emails.js --emulator                # Run against local emulator (127.0.0.1:8080)
 *   node migrate_feedback_emails.js --execute --confirm-project nexushub-955d4  # Non-interactive confirmation
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = 'nexushub-955d4';
const BACKUP_DIR = path.join(__dirname, 'backups');
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

/**
 * Initialize Firebase Admin Firestore safely
 */
function getDb(useEmulator = false) {
  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
  }
  
  const apps = getApps();
  let app;
  if (apps.length > 0) {
    app = apps[0];
  } else {
    app = initializeApp({
      projectId: PROJECT_ID,
      ...(useEmulator ? {} : { credential: applicationDefault() })
    });
  }
  return getFirestore(app);
}

/**
 * Serialize Firestore data preserving Timestamps, Dates, GeoPoints, and all types
 */
function serializeFirestoreValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'function') return undefined;

  // Preserve Firestore Timestamp with nanosecond precision
  if (val instanceof Timestamp || (val && typeof val.toDate === 'function' && '_seconds' in val)) {
    return {
      _type: 'Timestamp',
      seconds: val._seconds !== undefined ? val._seconds : val.seconds,
      nanoseconds: val._nanoseconds !== undefined ? val._nanoseconds : val.nanoseconds,
      iso: val.toDate().toISOString()
    };
  }

  // Preserve standard Date
  if (val instanceof Date) {
    return {
      _type: 'Date',
      iso: val.toISOString()
    };
  }

  // Preserve GeoPoint
  if (val && typeof val.latitude === 'number' && typeof val.longitude === 'number') {
    return {
      _type: 'GeoPoint',
      latitude: val.latitude,
      longitude: val.longitude
    };
  }

  // Preserve DocumentReference
  if (val && typeof val.path === 'string' && val.firestore) {
    return {
      _type: 'DocumentReference',
      path: val.path
    };
  }

  // Preserve Arrays
  if (Array.isArray(val)) {
    return val.map(item => serializeFirestoreValue(item));
  }

  // Preserve Nested Maps / Objects
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = serializeFirestoreValue(v);
    }
    return res;
  }

  return val;
}

/**
 * Verify backup file integrity
 */
function assertBackupValid(filePath, expectedCount) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file was not created at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content || content.length < 20) {
    throw new Error('Backup file is empty or corrupted!');
  }
  const parsed = JSON.parse(content);
  if (!parsed.documents || parsed.documents.length !== expectedCount) {
    throw new Error(`Backup verification failed: expected ${expectedCount} documents, found ${parsed.documents ? parsed.documents.length : 0}`);
  }
}

/**
 * Require explicit project confirmation before production writes
 */
async function confirmProductionProject(targetProjectId) {
  const confirmArg = process.argv.find(a => a.startsWith('--confirm-project='));
  if (confirmArg && confirmArg.split('=')[1] === targetProjectId) {
    return true;
  }
  const confirmIdx = process.argv.indexOf('--confirm-project');
  if (confirmIdx !== -1 && process.argv[confirmIdx + 1] === targetProjectId) {
    return true;
  }

  if (!process.stdin.isTTY) {
    throw new Error(`Production execution requires explicit confirmation. Run with: --confirm-project ${targetProjectId}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    rl.question(`\n[CONFIRMATION REQUIRED] Target project: "${targetProjectId}".\nType "${targetProjectId}" to proceed with migration execution: `, answer => {
      rl.close();
      if (answer.trim() === targetProjectId) {
        resolve(true);
      } else {
        reject(new Error(`Project confirmation mismatch ("${answer.trim()}" !== "${targetProjectId}"). Aborting execution.`));
      }
    });
  });
}

/**
 * Main migration logic
 */
async function runMigration(options = {}) {
  const isDryRun = options.isDryRun !== undefined
    ? options.isDryRun
    : (process.argv.includes('--dry-run') || !process.argv.includes('--execute'));

  const useEmulator = options.useEmulator !== undefined
    ? options.useEmulator
    : (process.argv.includes('--emulator') || !!process.env.FIRESTORE_EMULATOR_HOST);

  console.log('========================================================');
  console.log('--- NEXUSHUB FEEDBACK USEREMAIL AUDIT & MIGRATION ---');
  console.log('========================================================');
  console.log(`Target:  ${useEmulator ? `Local Emulator (${EMULATOR_HOST})` : `Cloud Firestore (${PROJECT_ID})`}`);
  console.log(`Mode:    ${isDryRun ? 'DRY-RUN (Read-only audit, no writes)' : 'EXECUTE (Backup first, then FieldValue.delete())'}\n`);

  const db = getDb(useEmulator);

  // 1. Audit Phase (Read all documents)
  console.log('▶ Step 1: Scanning feedback collection...');
  const snapshot = await db.collection('feedback').get();
  const docs = snapshot.docs;
  console.log(`  Scanned total reviews: ${docs.length}`);

  const withEmailDocs = docs.filter(doc => {
    const data = doc.data();
    return 'userEmail' in data && data.userEmail !== undefined && data.userEmail !== null && data.userEmail !== '';
  });
  const cleanCount = docs.length - withEmailDocs.length;

  console.log(`  Reviews containing "userEmail": ${withEmailDocs.length}`);
  console.log(`  Reviews already clean:          ${cleanCount}\n`);

  // Dry-run mode: Read-only report, do not write files or touch documents
  if (isDryRun) {
    console.log('▶ Step 2: [DRY-RUN] Audit Summary (Read-Only Mode):');
    console.log(`  Total reviews in collection:      ${docs.length}`);
    console.log(`  Reviews containing "userEmail":   ${withEmailDocs.length}`);
    console.log(`  Reviews already clean:            ${cleanCount}`);
    console.log('  No documents were modified, and no backups were created (dry-run).');

    if (withEmailDocs.length > 0) {
      console.log('\n  Affected reviews summary (reviewer emails are never printed for privacy):');
      withEmailDocs.slice(0, 5).forEach(d => {
        const data = d.data();
        console.log(`  - [Document ID: ${d.id}] Project: "${data.projectId || 'N/A'}", Author: "${data.userName || 'Anonymous'}"`);
      });
      if (withEmailDocs.length > 5) {
        console.log(`  ... and ${withEmailDocs.length - 5} more reviews.`);
      }
      console.log('\nTo safely execute this migration (backup first, then FieldValue.delete()), run:');
      console.log(`  node migrate_feedback_emails.js --execute --confirm-project ${PROJECT_ID}\n`);
    } else {
      console.log('\n✓ All feedback documents are already clean. No migration needed.\n');
    }

    return { total: docs.length, affected: withEmailDocs.length, clean: cleanCount, backupFile: null };
  }

  // Execution mode: Require explicit confirmation for production
  if (!useEmulator) {
    await confirmProductionProject(PROJECT_ID);
  }

  if (withEmailDocs.length === 0) {
    console.log('✓ All feedback documents are already clean. No updates required.\n');
    return { total: docs.length, affected: 0, clean: docs.length, backupFile: null };
  }

  // 2. Backup Phase (Mandatory before any writes)
  console.log('▶ Step 2: Creating complete pre-migration backup...');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `feedback_backup_${timestamp}.json`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  const backupData = {
    metadata: {
      projectId: PROJECT_ID,
      createdAt: new Date().toISOString(),
      totalDocuments: docs.length,
      affectedDocuments: withEmailDocs.length,
      isEmulator: useEmulator
    },
    documents: docs.map(d => ({
      id: d.id,
      data: serializeFirestoreValue(d.data())
    }))
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

  // Verify backup before proceeding
  assertBackupValid(backupFilePath, docs.length);
  console.log('  ✓ Backup created and verified successfully!');
  console.log(`  Backup location: ${backupFilePath}\n`);

  // 3. Execution Phase (FieldValue.delete() on affected documents)
  console.log('▶ Step 3: Executing FieldValue.delete() in batches...');
  const BATCH_SIZE = 400;
  let updatedCount = 0;

  for (let i = 0; i < withEmailDocs.length; i += BATCH_SIZE) {
    const chunk = withEmailDocs.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} reviews)...`);

    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, {
        userEmail: FieldValue.delete()
      });
      updatedCount++;
    }
    await batch.commit();
  }

  console.log(`  ✓ Successfully updated ${updatedCount} documents.\n`);

  // 4. Post-Migration Verification Phase
  console.log('▶ Step 4: Verifying migration integrity...');
  const postSnapshot = await db.collection('feedback').get();
  const postDocs = postSnapshot.docs;

  const remainingWithEmail = postDocs.filter(doc => {
    const data = doc.data();
    return 'userEmail' in data && data.userEmail !== undefined && data.userEmail !== null && data.userEmail !== '';
  });

  console.log(`  Post-migration total reviews:    ${postDocs.length} (Original: ${docs.length})`);
  console.log(`  Reviews still with userEmail:    ${remainingWithEmail.length}`);

  if (postDocs.length !== docs.length) {
    throw new Error(`Data loss detected! Expected ${docs.length} documents, found ${postDocs.length}`);
  }

  if (remainingWithEmail.length > 0) {
    throw new Error(`Verification failed! ${remainingWithEmail.length} documents still contain userEmail.`);
  }

  console.log('  ✓ Zero reviews lost. Zero userEmail fields remaining.');
  console.log('\n========================================================');
  console.log('✓ FEEDBACK MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('========================================================\n');

  return {
    total: postDocs.length,
    affected: withEmailDocs.length,
    clean: postDocs.length,
    backupFile: backupFilePath
  };
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error('\n✗ Migration error:', err.message);
    process.exit(1);
  });
}

module.exports = { runMigration, assertBackupValid, serializeFirestoreValue };
