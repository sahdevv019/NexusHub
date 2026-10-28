const http = require('http');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function createToken(payload) {
  if (!payload) return null;
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    aud: 'nexushub-955d4',
    iss: 'https://securetoken.google.com/nexushub-955d4',
    ...payload
  })).toString('base64url');
  return `${header}.${claims}.`;
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// Convert plain JS object to Firestore REST API document format
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return { integerValue: String(item) };
            if (typeof item === 'boolean') return { booleanValue: item };
            return { stringValue: String(item) };
          })
        }
      };
    }
  }
  return fields;
}

// Helper methods for Firestore REST API
const PROJECT_ID = 'nexushub-955d4';
const BASE_PATH = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getDoc(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return await request({
    hostname: '127.0.0.1',
    port: 8080,
    path: `${BASE_PATH}/${path}`,
    method: 'GET',
    headers
  });
}

async function setDoc(path, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return await request({
    hostname: '127.0.0.1',
    port: 8080,
    path: `${BASE_PATH}/${path}`,
    method: 'PATCH',
    headers
  }, { fields: toFirestoreFields(data) });
}

async function deleteDoc(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return await request({
    hostname: '127.0.0.1',
    port: 8080,
    path: `${BASE_PATH}/${path}`,
    method: 'DELETE',
    headers
  });
}

async function runRealAuthorizationTestSuite() {
  console.log('========================================================');
  console.log('--- NEXUSHUB FIREBASE EMULATOR SECURITY RULES SUITE ---');
  console.log('========================================================\n');

  // Test identities
  const ownerToken = createToken({
    sub: 'owner_uid',
    uid: 'owner_uid',
    email: 'ayushpathak200718@gmail.com',
    email_verified: true
  });

  const unverifiedOwnerToken = createToken({
    sub: 'unverified_uid',
    uid: 'unverified_uid',
    email: 'ayushpathak200718@gmail.com',
    email_verified: false
  });

  const wrongOwnerToken = createToken({
    sub: 'wrong_owner_uid',
    uid: 'wrong_owner_uid',
    email: 'ayushk10831@gmail.com',
    email_verified: true
  });

  const userAliceToken = createToken({
    sub: 'alice_uid',
    uid: 'alice_uid',
    email: 'alice@example.com',
    email_verified: true
  });

  const userBobToken = createToken({
    sub: 'bob_uid',
    uid: 'bob_uid',
    email: 'bob@example.com',
    email_verified: true
  });

  // 1. Project Creation & Authorization Tests
  console.log('▶ [PRIORITY 6] Project Authorization (Owner vs Non-Owner vs Unauth):');
  
  const samplePublishedProject = {
    name: 'Production Project',
    slug: 'production-project',
    category: 'Web Apps',
    description: 'A production grade showcase app with secure architecture.',
    visibility: 'published',
    tags: ['React', 'Firebase'],
    createdAt: '2026-10-28T12:00:00.000Z'
  };

  const sampleDraftProject = {
    name: 'Draft Project',
    slug: 'draft-project',
    category: 'Internal Tooling',
    description: 'An internal draft project not yet ready for public release.',
    visibility: 'draft',
    tags: ['Node.js'],
    createdAt: '2026-10-28T12:00:00.000Z'
  };

  // Unauthenticated project create -> 403
  let res = await setDoc('projects/test_proj_unauth', samplePublishedProject, null);
  assert(res.status === 403, 'Unauthenticated user CANNOT create a project (403 PERMISSION_DENIED)');

  // Regular user project create -> 403
  res = await setDoc('projects/test_proj_alice', samplePublishedProject, userAliceToken);
  assert(res.status === 403, 'Regular authenticated user CANNOT create a project (403 PERMISSION_DENIED)');

  // Wrong owner email (ayushk10831@gmail.com) -> 403
  res = await setDoc('projects/test_proj_wrong', samplePublishedProject, wrongOwnerToken);
  assert(res.status === 403, 'Incorrect owner email (ayushk10831@gmail.com) CANNOT create a project (403 PERMISSION_DENIED)');

  // Unverified owner email -> 403
  res = await setDoc('projects/test_proj_unverified', samplePublishedProject, unverifiedOwnerToken);
  assert(res.status === 403, 'Unverified owner email (email_verified: false) CANNOT create a project (403 PERMISSION_DENIED)');

  // Verified owner (ayushpathak200718@gmail.com) creates published project -> 200
  res = await setDoc('projects/pub_project_1', samplePublishedProject, ownerToken);
  assert(res.status === 200, 'Verified owner ayushpathak200718@gmail.com CAN create a published project (200 OK)');

  // Verified owner creates draft project -> 200
  res = await setDoc('projects/draft_project_1', sampleDraftProject, ownerToken);
  assert(res.status === 200, 'Verified owner ayushpathak200718@gmail.com CAN create a draft project (200 OK)');

  // 2. Project Read & Visibility Rules
  console.log('\n▶ [PRIORITY 6] Project Read & Draft Visibility Protection:');
  
  // Public reads published project -> 200
  res = await getDoc('projects/pub_project_1', null);
  assert(res.status === 200, 'Public visitors CAN read published projects (200 OK)');

  // Public reads draft project -> 403
  res = await getDoc('projects/draft_project_1', null);
  assert(res.status === 403, 'Public visitors CANNOT read draft projects (403 PERMISSION_DENIED)');

  // Regular user reads draft project -> 403
  res = await getDoc('projects/draft_project_1', userAliceToken);
  assert(res.status === 403, 'Regular authenticated users CANNOT read draft projects (403 PERMISSION_DENIED)');

  // Owner reads draft project -> 200
  res = await getDoc('projects/draft_project_1', ownerToken);
  assert(res.status === 200, 'Verified owner CAN read draft projects (200 OK)');

  // 3. User Privacy & Profile Data Protection (Priority 1)
  console.log('\n▶ [PRIORITY 1] User Privacy & Email Protection (/users collection):');
  
  const aliceProfile = {
    username: 'AliceDeveloper',
    username_lower: 'alicedeveloper',
    emoji: '🚀',
    email: 'alice@example.com',
    createdAt: '2026-10-28T12:00:00.000Z'
  };

  // Alice creates her own profile -> 200
  res = await setDoc('users/alice_uid', aliceProfile, userAliceToken);
  assert(res.status === 200, 'User Alice CAN create her own profile document (200 OK)');

  // Alice reads her own profile -> 200
  res = await getDoc('users/alice_uid', userAliceToken);
  assert(res.status === 200, 'User Alice CAN read her own profile (200 OK)');

  // Unauthenticated read of Alice profile (with private email) -> 403
  res = await getDoc('users/alice_uid', null);
  assert(res.status === 403, 'Unauthenticated visitor CANNOT read Alice profile / email (403 PERMISSION_DENIED)');

  // Bob reads Alice profile -> 403
  res = await getDoc('users/alice_uid', userBobToken);
  assert(res.status === 403, 'User Bob CANNOT read Alice profile / email (403 PERMISSION_DENIED)');

  // Bob updates Alice profile -> 403
  res = await setDoc('users/alice_uid', { ...aliceProfile, username: 'HackedName' }, userBobToken);
  assert(res.status === 403, 'User Bob CANNOT update Alice profile (403 PERMISSION_DENIED)');

  // Owner reads Alice profile -> 200
  res = await getDoc('users/alice_uid', ownerToken);
  assert(res.status === 200, 'Verified owner CAN read user profile for administrative purposes (200 OK)');

  // 4. Public Username Availability Directory (/usernames collection)
  console.log('\n▶ [PRIORITY 1 & 2] Username Directory & Reserved Name Enforcement:');
  
  // Public can read username directory
  res = await getDoc('usernames/alicedeveloper', null);
  assert(res.status === 200 || res.status === 404, 'Public CAN check username availability (no email leakage)');

  // Username document ID validation tests
  res = await setDoc('usernames/ALICE', { uid: 'alice_uid', createdAt: '2026-10-28T12:00:00.000Z' }, userAliceToken);
  assert(res.status === 403, 'Uppercase username document ID (ALICE) is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/alice!@#', { uid: 'alice_uid', createdAt: '2026-10-28T12:00:00.000Z' }, userAliceToken);
  assert(res.status === 403, 'Username with invalid characters (alice!@#) is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/al', { uid: 'alice_uid', createdAt: '2026-10-28T12:00:00.000Z' }, userAliceToken);
  assert(res.status === 403, 'Username shorter than 3 characters (al) is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/this_username_is_way_too_long_for_system', { uid: 'alice_uid', createdAt: '2026-10-28T12:00:00.000Z' }, userAliceToken);
  assert(res.status === 403, 'Username longer than 25 characters is REJECTED (403 PERMISSION_DENIED)');

  // Username schema enforcement on create
  res = await setDoc('usernames/alice_extra', { uid: 'alice_uid', createdAt: '2026-10-28T12:00:00.000Z', role: 'admin' }, userAliceToken);
  assert(res.status === 403, 'Username claim with unauthorized extra fields (role) is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/alice_missing', { uid: 'alice_uid' }, userAliceToken);
  assert(res.status === 403, 'Username claim missing required createdAt is REJECTED (403 PERMISSION_DENIED)');

  // Alice claims her valid username
  res = await setDoc('usernames/alicedeveloper', {
    uid: 'alice_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userAliceToken);
  assert(res.status === 200, 'Alice CAN claim available lowercase username with exact allowed fields (200 OK)');

  // Username update rules: immutability & exact schema checks
  res = await setDoc('usernames/alicedeveloper', {
    uid: 'alice_uid',
    createdAt: '2026-10-28T12:00:00.000Z',
    bio: 'Software engineer'
  }, userAliceToken);
  assert(res.status === 403, 'Updating username with unauthorized extra fields (bio) is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/alicedeveloper', {
    uid: 'bob_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userAliceToken);
  assert(res.status === 403, 'Altering immutable UID in username document is REJECTED (403 PERMISSION_DENIED)');

  res = await setDoc('usernames/alicedeveloper', {
    uid: 'alice_uid',
    createdAt: '2026-10-28T16:00:00.000Z'
  }, userAliceToken);
  assert(res.status === 403, 'Altering immutable createdAt in username document is REJECTED (403 PERMISSION_DENIED)');

  // Bob attempts to update Alice claimed username -> 403
  res = await setDoc('usernames/alicedeveloper', {
    uid: 'alice_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userBobToken);
  assert(res.status === 403, 'Bob CANNOT update Alice claimed username (403 PERMISSION_DENIED)');

  // Alice valid update preserving exact fields, uid, and createdAt -> 200
  res = await setDoc('usernames/alicedeveloper', {
    uid: 'alice_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userAliceToken);
  assert(res.status === 200, 'Alice CAN update her claimed username preserving exact allowed fields and immutability (200 OK)');

  // Bob attempts to claim reserved username 'ayush' -> 403
  res = await setDoc('usernames/ayush', {
    uid: 'bob_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userBobToken);
  assert(res.status === 403, 'Non-owner CANNOT claim reserved username "ayush" (403 PERMISSION_DENIED)');

  // Bob attempts to claim reserved username 'admin' -> 403
  res = await setDoc('usernames/admin', {
    uid: 'bob_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, userBobToken);
  assert(res.status === 403, 'Non-owner CANNOT claim reserved username "admin" (403 PERMISSION_DENIED)');

  // Verified owner claims reserved username 'ayush' -> 200
  res = await setDoc('usernames/ayush', {
    uid: 'owner_uid',
    createdAt: '2026-10-28T12:00:00.000Z'
  }, ownerToken);
  assert(res.status === 200, 'Verified owner CAN claim reserved username "ayush" (200 OK)');

  // 5. Review Integrity & Deterministic Document IDs (Priority 2)
  console.log('\n▶ [PRIORITY 2] Review Integrity & Deterministic IDs (/feedback collection):');

  const validReview = {
    projectId: 'pub_project_1',
    userId: 'alice_uid',
    rating: 5,
    message: 'Outstanding developer portfolio and engineering showcase!',
    userName: 'AliceDeveloper',
    userPhoto: '🚀',
    createdAt: '2026-10-28T12:00:00.000Z'
  };

  // Review containing userEmail -> 403 (Privacy Priority 1)
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    userEmail: 'alice@example.com'
  }, userAliceToken);
  assert(res.status === 403, 'Review containing userEmail is REJECTED by rules to prevent email leakage (403 PERMISSION_DENIED)');

  // Review with non-deterministic document ID -> 403
  res = await setDoc('feedback/random_review_id_123', validReview, userAliceToken);
  assert(res.status === 403, 'Review with non-deterministic document ID is REJECTED (403 PERMISSION_DENIED)');

  // Review on a non-existent project -> 403
  res = await setDoc('feedback/nonexistent_alice_uid', {
    ...validReview,
    projectId: 'nonexistent'
  }, userAliceToken);
  assert(res.status === 403, 'Review referencing a NON-EXISTENT project is REJECTED (403 PERMISSION_DENIED)');

  // Review on a draft project -> 403
  res = await setDoc('feedback/draft_project_1_alice_uid', {
    ...validReview,
    projectId: 'draft_project_1'
  }, userAliceToken);
  assert(res.status === 403, 'Review on an UNPUBLISHED draft project is REJECTED (403 PERMISSION_DENIED)');

  // Review with impersonated userId (Bob submitting as Alice) -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', validReview, userBobToken);
  assert(res.status === 403, 'User Bob CANNOT impersonate Alice in review userId (403 PERMISSION_DENIED)');

  // Review with reserved username spoofing (e.g. userName: 'Ayush') by Alice -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    userName: 'Ayush'
  }, userAliceToken);
  assert(res.status === 403, 'Non-owner CANNOT spoof reserved username "Ayush" in review (403 PERMISSION_DENIED)');

  // Valid review with deterministic ID on published project -> 200
  res = await setDoc('feedback/pub_project_1_alice_uid', validReview, userAliceToken);
  assert(res.status === 200, 'Valid review with deterministic ID on published project is ACCEPTED (200 OK)');

  // Public can read reviews
  res = await getDoc('feedback/pub_project_1_alice_uid', null);
  assert(res.status === 200, 'Public visitors CAN read project reviews (200 OK)');

  // 6. Review Tampering & Immutability Tests (Priority 2)
  console.log('\n▶ [PRIORITY 2] Review Tampering & Immutability Protection:');

  // Bob attempts to modify Alice review -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    message: 'Tampered review by Bob!'
  }, userBobToken);
  assert(res.status === 403, 'User Bob CANNOT modify Alice review (403 PERMISSION_DENIED)');

  // Alice updates her review with new rating and message -> 200
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    rating: 4,
    message: 'Updated review message by Alice.'
  }, userAliceToken);
  assert(res.status === 200, 'Alice CAN update her own review rating & message (200 OK)');

  // Alice attempts to tamper with immutable projectId -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    projectId: 'other_project'
  }, userAliceToken);
  assert(res.status === 403, 'Alice CANNOT tamper with immutable projectId in review (403 PERMISSION_DENIED)');

  // Alice attempts to tamper with immutable userId -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    userId: 'other_uid'
  }, userAliceToken);
  assert(res.status === 403, 'Alice CANNOT tamper with immutable userId in review (403 PERMISSION_DENIED)');

  // Alice attempts to tamper with immutable createdAt -> 403
  res = await setDoc('feedback/pub_project_1_alice_uid', {
    ...validReview,
    createdAt: '2026-10-28T15:00:00.000Z'
  }, userAliceToken);
  assert(res.status === 403, 'Alice CANNOT tamper with immutable createdAt timestamp in review (403 PERMISSION_DENIED)');

  // 7. Review & Project Deletion Authorization
  console.log('\n▶ [PRIORITY 2 & 6] Deletion Authorization & Owner Moderation:');

  // Bob attempts to delete Alice review -> 403
  res = await deleteDoc('feedback/pub_project_1_alice_uid', userBobToken);
  assert(res.status === 403, 'Bob CANNOT delete Alice review (403 PERMISSION_DENIED)');

  // Wrong owner attempts to delete Alice review -> 403
  res = await deleteDoc('feedback/pub_project_1_alice_uid', wrongOwnerToken);
  assert(res.status === 403, 'Incorrect owner email CANNOT delete reviews (403 PERMISSION_DENIED)');

  // Verified owner deletes Alice review (moderation) -> 200
  res = await deleteDoc('feedback/pub_project_1_alice_uid', ownerToken);
  assert(res.status === 200, 'Verified owner CAN delete reviews for moderation (200 OK)');

  // Alice deletes her own profile -> 200
  res = await deleteDoc('users/alice_uid', userAliceToken);
  assert(res.status === 200, 'User Alice CAN delete her own profile document (200 OK)');

  // Verified owner deletes project -> 200
  res = await deleteDoc('projects/draft_project_1', ownerToken);
  assert(res.status === 200, 'Verified owner CAN delete project (200 OK)');

  // 8. Legacy Feedback Audit & Backup-First Migration (Final Pre-Launch Patch)
  console.log('\n▶ [FINAL PATCH] Legacy Feedback userEmail Audit & Safe Migration:');
  
  const legacyDoc1 = {
    projectId: 'pub_project_1',
    userId: 'legacy_user_1',
    rating: 5,
    message: 'Legacy review with exposed email field.',
    userName: 'LegacyUser1',
    userEmail: 'exposed_alice@example.com',
    userPhoto: '👾',
    createdAt: '2026-10-25T10:00:00.000Z'
  };
  const legacyDoc2 = {
    projectId: 'pub_project_1',
    userId: 'legacy_user_2',
    rating: 4,
    message: 'Another legacy review with userEmail.',
    userName: 'LegacyUser2',
    userEmail: 'exposed_bob@example.com',
    userPhoto: '👾',
    createdAt: '2026-10-26T14:30:00.000Z'
  };

  res = await setDoc('feedback/pub_project_1_legacy_user_1', legacyDoc1, 'owner');
  assert(res.status === 200, 'Admin CAN seed legacy feedback doc 1 with userEmail in emulator (200 OK)');

  res = await setDoc('feedback/pub_project_1_legacy_user_2', legacyDoc2, 'owner');
  assert(res.status === 200, 'Admin CAN seed legacy feedback doc 2 with userEmail in emulator (200 OK)');

  // Untrusted user attempting to create review with userEmail -> 403
  const untrustedReview = {
    projectId: 'pub_project_1',
    userId: 'bob_uid',
    rating: 5,
    message: 'Untrusted user trying to inject userEmail.',
    userName: 'BobTester',
    userEmail: 'bob@example.com',
    userPhoto: '👾',
    createdAt: '2026-10-28T12:00:00.000Z'
  };
  res = await setDoc('feedback/pub_project_1_bob_uid', untrustedReview, userBobToken);
  assert(res.status === 403, 'Regular authenticated user CANNOT submit review with userEmail (403 PERMISSION_DENIED)');

  // Run migration in dry-run mode
  const { runMigration } = require('./migrate_feedback_emails.js');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  
  const dryRunResult = await runMigration({ isDryRun: true, useEmulator: true });
  assert(dryRunResult.affected >= 2, 'Migration dry-run accurately audits legacy documents with userEmail');
  assert(dryRunResult.backupFile === null, 'Migration dry-run is strictly read-only and creates no backup file');

  // Verify document still has userEmail before execution
  let auditCheck = await getDoc('feedback/pub_project_1_legacy_user_1', null);
  assert(!!auditCheck.body?.fields?.userEmail, 'Dry-run does NOT modify or delete userEmail fields before execution');

  // Execute migration
  const executeResult = await runMigration({ isDryRun: false, useEmulator: true });
  assert(executeResult.affected >= 2, 'Migration execute scrubs all legacy userEmail fields');
  assert(fs.existsSync(executeResult.backupFile), 'Migration execute creates verified pre-migration backup file before writes');
  assert(executeResult.clean === executeResult.total, 'All feedback documents are verified clean post-migration');

  // Verify in Firestore that userEmail is gone while rating, message, and author are preserved
  let migratedDoc = await getDoc('feedback/pub_project_1_legacy_user_1', null);
  assert(!migratedDoc.body?.fields?.userEmail, 'Post-migration document in Firestore NO LONGER contains userEmail');
  assert(migratedDoc.body?.fields?.rating?.integerValue === '5', 'Post-migration document PRESERVES original rating (5 stars)');
  assert(migratedDoc.body?.fields?.message?.stringValue === legacyDoc1.message, 'Post-migration document PRESERVES original review message text');
  assert(migratedDoc.body?.fields?.userName?.stringValue === 'LegacyUser1', 'Post-migration document PRESERVES author userName');
  assert(migratedDoc.body?.fields?.createdAt?.stringValue === legacyDoc1.createdAt, 'Post-migration document PRESERVES original createdAt timestamp');

  console.log('\n========================================================');
  console.log(`REAL EMULATOR TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✓ ALL FIREBASE EMULATOR SECURITY RULES TESTS PASSED!\n');
    process.exit(0);
  }
}

runRealAuthorizationTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
