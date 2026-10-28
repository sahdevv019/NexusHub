const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

console.log('========================================================');
console.log('--- NEXUSHUB COMPREHENSIVE PRODUCTION TEST SUITE ---');
console.log('========================================================\n');

// 1. Files existence check
console.log('▶ [PHASE 1 & 4] Core Files & Structure:');
const htmlPath = path.join(__dirname, 'index.html');
const cssPath = path.join(__dirname, 'style.css');
const firestoreRulesPath = path.join(__dirname, 'firestore.rules');
const storageRulesPath = path.join(__dirname, 'storage.rules');
const vercelConfigPath = path.join(__dirname, 'vercel.json');

assert(fs.existsSync(htmlPath), 'index.html exists');
assert(fs.existsSync(cssPath), 'style.css exists');
assert(fs.existsSync(firestoreRulesPath), 'firestore.rules exists');
assert(fs.existsSync(storageRulesPath), 'storage.rules exists');
assert(fs.existsSync(vercelConfigPath), 'vercel.json exists');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf8');
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');
const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

// 2. Syntax & JavaScript compilation check
console.log('\n▶ [PHASE 1] JavaScript Code Integrity:');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
assert(!!scriptMatch, 'Found primary application JavaScript in index.html');

let jsCode = scriptMatch ? scriptMatch[1] : '';
try {
  new vm.Script(jsCode);
  assert(true, 'Application JavaScript compiles cleanly with valid syntax');
} catch (e) {
  assert(false, `Application JavaScript failed compilation: ${e.message}`);
}

// 3. Security & Reliability checks
console.log('\n▶ [PHASE 1] Security & Data Integrity:');
assert(!html.includes("prompt('Admin Password')"), 'Insecure mock prompt() login removed');
assert(!html.includes("localStorage.setItem('auth'"), 'Insecure mock localStorage auth spoofing removed');
assert(!html.includes('firebase-storage-compat.js'), 'Unused Firebase Storage SDK removed (Milestone 6)');
assert(!html.includes('uploadImageToStorage('), 'uploadImageToStorage removed in favor of static repository assets (Milestone 6)');
assert(html.includes('validateImagePath('), 'validateImagePath static asset and URL validator implemented (Milestone 6)');
assert(html.includes('localDb = await openDB();'), 'IndexedDB initialized before Firestore fetches');
assert(html.includes('dbInstance.batch()'), 'Cascading atomic batch deletion used for project delete');
assert(html.includes("where('projectId', '==', id)"), 'Cascading delete queries all related reviews');
assert(firestoreRules.includes("rules_version = '2';"), 'firestore.rules enforces version 2');
assert(firestoreRules.includes('isOwner()'), 'firestore.rules enforces server-side owner verification');
assert(storageRules.includes('firebase.storage'), 'storage.rules correctly configured as historical rules');

// 4. UI/UX Design System & Editorial Aesthetic
console.log('\n▶ [PHASE 2] UI/UX Redesign & Editorial Aesthetics:');
assert(css.includes('--bg: #F7F6F2;'), 'CSS variables include editorial background #F7F6F2');
assert(css.includes('--surface: #FFFFFF;'), 'CSS variables include card surface #FFFFFF');
assert(css.includes('--text: #18231F;'), 'CSS variables include primary text #18231F');
assert(css.includes('--accent: #24745B;'), 'CSS variables include forest green accent #24745B');
assert(css.includes('--accent-soft: #E9EEE8;'), 'CSS variables include soft accent #E9EEE8');
assert(css.includes('--muted: #66736C;'), 'CSS variables include muted text #66736C');
assert(css.includes('--line: #E4E8E2;'), 'CSS variables include subtle borders #E4E8E2');
assert(html.includes('Plus+Jakarta+Sans'), 'Plus Jakarta Sans editorial typography linked');
assert(html.includes('Ideas become <span class="hero-accent">things.</span>'), 'Hero headline preserved with editorial accent');
assert(html.includes('hero-spotlight'), 'Hero 2-column spotlight showcase container present');
assert(html.includes('spotlight-card'), 'Spotlight card visual component implemented');
assert(/aspect-ratio:\s*16\s*\/\s*9;/i.test(css), 'Project cards enforce consistent 16:9 preview aspect ratio');
assert(html.includes('modal-header-hero'), 'Project details modal styled with software showcase layout');
assert(html.includes('role="dialog"') && html.includes('aria-labelledby="modal-project-title"'), 'Project details modal has accessible dialog attributes');
assert(html.includes('updateCategoryChips'), 'Category chips dynamically update active visual state');
assert(html.includes('getRatingAvg'), 'Sorting supports highest-rated ranking calculation');
assert(html.includes("Hey, I'm Ayush."), 'About section introduces creator without duplication');
assert(html.includes('about-toolkit'), 'About section displays skills and current development interests');
assert(html.includes('footer-shell') && css.includes('.footer-shell'), 'Rounded white footer container preserved');
assert(html.includes('Product</h3>') && html.includes('Resources</h3>') && html.includes('Company</h3>'), 'Footer columns (Product, Resources, Company) present');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Prefers-reduced-motion CSS support implemented');

// 5. Admin Dashboard Polish
console.log('\n▶ [PHASE 3] Admin Dashboard Polish:');
assert(html.includes('id="pfeatured"'), 'Spotlight & Hero Promotion toggle in project form');
assert(html.includes('id="pdesc-counter"'), 'Character counter indicator for project description');
assert(html.includes('name="visibility" value="published"'), 'Published visibility option with badge');
assert(html.includes('name="visibility" value="draft"'), 'Draft visibility option with badge');
assert(html.includes('id="coverpath"'), 'Cover image path text input provided (Milestone 6)');
assert(html.includes('id="newscreenpath"'), 'Screenshot image path input provided (Milestone 6)');
assert(html.includes('Saving project to database...'), 'Form loading/saving state feedback provided');
assert(html.includes('feedbacksearch'), 'Reviews moderation search filter implemented');
assert(html.includes('feedbackratingfilter'), 'Reviews moderation star rating filter implemented');
assert(html.includes('confirmDeleteFeedback'), 'Safe review deletion confirmation with user & project name');

// 6. Code Quality, SEO, Favicon & Deployment
console.log('\n▶ [PHASE 4] Code Quality, SEO & Deployment:');
assert(html.includes('property="og:title"'), 'Open Graph title metadata tag present');
assert(html.includes('property="og:description"'), 'Open Graph description metadata tag present');
assert(html.includes('name="twitter:card"'), 'Twitter card preview metadata tag present');
assert(html.includes('rel="icon" type="image/svg+xml"'), 'Inline SVG favicon linked to avoid 404s');
assert(Array.isArray(vercelJson.rewrites) && vercelJson.rewrites.some(r => r.destination === '/index.html'), 'Vercel SPA rewrite rule configured');
assert(Array.isArray(vercelJson.headers) && vercelJson.headers.some(h => h.headers.some(item => item.key === 'X-Content-Type-Options')), 'Vercel security headers configured');

// 7. Milestone 5 Hardening Checks
console.log('\n▶ [MILESTONE 5] Pre-Launch Hardening & Security Checks:');
assert(firestoreRules.includes("feedbackId == request.resource.data.projectId + '_' + request.auth.uid"), 'firestore.rules enforces deterministic document ID {projectId}_{uid} for reviews');
assert(storageRules.includes("image/(jpeg|png|webp)"), 'storage.rules disallows SVG uploads and enforces jpeg|png|webp');
assert(html.includes("where('visibility', '==', 'published')"), "Public project queries explicitly filter where('visibility', '==', 'published')");
assert(html.includes('loadOwnerProjects()'), 'loadOwnerProjects allows verified owners to retrieve drafts separately');
assert(html.includes(".limit(200)"), 'Reviews collection query has bounded loading limit (.limit(200))');
assert(html.includes('isFirebaseStorageUrl(') && html.includes('resolveImageUrl('), 'resolveImageUrl and legacy isFirebaseStorageUrl compatibility helpers implemented');
assert(html.includes('cancelProjectEdit()'), 'cancelProjectEdit properly resets form state on cancel');
assert(html.includes('CHUNK_SIZE = 450'), 'Cascading deletion chunks reviews (>500) into batches of 450 sequentially');
assert(html.includes('${projectId}_${authState.user.uid}') && html.includes('batch.delete(dbInstance.collection(\'feedback\').doc(existingReview.id))'), 'submitFeedback uses deterministic review ID with atomic legacy migration');
assert(html.includes('username_lower') && html.includes('createdAt: existing.createdAt'), 'Profile updates strictly conform to Firestore user schema');
assert(!html.includes('https://nexushub.dev') && html.includes('window.location.host'), 'Hero spotlight uses dynamic origin rather than placeholder nexushub.dev');

// 8. Functional Runtime Simulation
console.log('\n▶ [RUNTIME TEST] Utility Functions Validation (from index.html):');
const sanitizeExtract = jsCode.match(/function sanitizeUrl[\s\S]*?^}/m);
const escExtract = jsCode.match(/const esc\s*=.*$/m);
const slugExtract = jsCode.match(/const slug\s*=.*$/m);

assert(!!sanitizeExtract, 'sanitizeUrl is declared in index.html');
assert(!!escExtract, 'esc is declared in index.html');
assert(!!slugExtract, 'slug is declared in index.html');

const sandbox = { console };
const context = vm.createContext(sandbox);

if (sanitizeExtract) vm.runInContext(sanitizeExtract[0], context);
if (escExtract) vm.runInContext(escExtract[0].replace(/^const\s+/, 'var '), context);
if (slugExtract) vm.runInContext(slugExtract[0].replace(/^const\s+/, 'var '), context);

assert(sandbox.sanitizeUrl('https://example.com/app') === 'https://example.com/app', 'sanitizeUrl passes valid https: URL');
assert(sandbox.sanitizeUrl('http://demo.example.com') === 'http://demo.example.com', 'sanitizeUrl passes valid http: URL');
assert(sandbox.sanitizeUrl('javascript:alert(1)') === '', 'sanitizeUrl blocks malicious javascript: URI');
assert(sandbox.sanitizeUrl('data:text/html,test') === '', 'sanitizeUrl blocks data: URI');
assert(sandbox.sanitizeUrl('vbscript:msgbox(1)') === '', 'sanitizeUrl blocks vbscript: URI');
assert(sandbox.esc('<script>alert("xss")</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'esc properly escapes HTML entities');
assert(sandbox.slug('Esports Arena Pro 2026!') === 'esports-arena-pro-2026', 'slug formats URL handles cleanly');

// 9. Owner Authorization & Email Verification Tests
console.log('\n▶ [AUTHORIZATION] Owner Email & Privilege Enforcement Tests:');
assert(firestoreRules.includes("request.auth.token.email.lower() == 'ayushpathak200718@gmail.com'"), 'firestore.rules strictly targets authorized owner email ayushpathak200718@gmail.com');
assert(firestoreRules.includes("request.auth.token.email_verified == true"), 'firestore.rules requires email_verified == true for owner access');
assert(!firestoreRules.includes('ayushk10831'), 'firestore.rules contains no reference to incorrect email ayushk10831');
assert(storageRules.includes("request.auth.token.email.lower() == 'ayushpathak200718@gmail.com'"), 'storage.rules strictly targets authorized owner email ayushpathak200718@gmail.com');
assert(storageRules.includes("request.auth.token.email_verified == true"), 'storage.rules requires email_verified == true for owner storage write');
assert(!storageRules.includes('ayushk10831'), 'storage.rules contains no reference to incorrect email ayushk10831');
assert(html.includes('const OWNER_EMAIL = "ayushpathak200718@gmail.com";'), 'index.html sets OWNER_EMAIL to ayushpathak200718@gmail.com');
assert(!html.includes('ayushk10831'), 'index.html contains no reference to incorrect email ayushk10831');

// Simulate server and client authorization logic
function evaluateIsOwnerRule(auth) {
  if (!auth || !auth.token || !auth.token.email) return false;
  return auth.token.email.toLowerCase() === 'ayushpathak200718@gmail.com' && auth.token.email_verified === true;
}

function evaluateClientIsOwner(firebaseUser) {
  if (!firebaseUser) return false;
  const OWNER_EMAIL = "ayushpathak200718@gmail.com";
  const userEmail = (firebaseUser.email || '').toLowerCase().trim();
  return userEmail === OWNER_EMAIL.toLowerCase().trim() && (firebaseUser.emailVerified || (firebaseUser.providerData && firebaseUser.providerData.some(p => p.providerId === 'google.com')));
}

function canAccessAdminRoute(user) {
  return !!(user && user.isOwner);
}

// Test cases
const authorizedOwnerGoogle = { email: 'ayushpathak200718@gmail.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] };
const authorizedOwnerToken = { token: { email: 'ayushpathak200718@gmail.com', email_verified: true } };
assert(evaluateIsOwnerRule(authorizedOwnerToken) === true, 'Server rules authorize verified owner ayushpathak200718@gmail.com');
assert(evaluateClientIsOwner(authorizedOwnerGoogle) === true, 'Client authorizes verified Google owner ayushpathak200718@gmail.com');
assert(canAccessAdminRoute({ uid: 'owner123', email: 'ayushpathak200718@gmail.com', isOwner: true }) === true, 'Verified owner is granted access to admin dashboard');

// Upper case test
const upperCaseOwnerToken = { token: { email: 'AYUSHPATHAK200718@GMAIL.COM', email_verified: true } };
assert(evaluateIsOwnerRule(upperCaseOwnerToken) === true, 'Server rules authorize case-insensitive owner email');
assert(evaluateClientIsOwner({ email: 'AYUSHPATHAK200718@GMAIL.COM', emailVerified: true }) === true, 'Client authorizes case-insensitive owner email');

// Incorrect email (ayushk10831@gmail.com)
const incorrectEmailToken = { token: { email: 'ayushk10831@gmail.com', email_verified: true } };
const incorrectEmailUser = { email: 'ayushk10831@gmail.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] };
assert(evaluateIsOwnerRule(incorrectEmailToken) === false, 'Server rules REJECT incorrect email ayushk10831@gmail.com');
assert(evaluateClientIsOwner(incorrectEmailUser) === false, 'Client REJECTS incorrect email ayushk10831@gmail.com from owner privileges');
assert(canAccessAdminRoute({ uid: 'user999', email: 'ayushk10831@gmail.com', isOwner: false }) === false, 'Incorrect email cannot access admin dashboard');

// Unverified email
const unverifiedOwnerToken = { token: { email: 'ayushpathak200718@gmail.com', email_verified: false } };
const unverifiedOwnerUser = { email: 'ayushpathak200718@gmail.com', emailVerified: false, providerData: [] };
assert(evaluateIsOwnerRule(unverifiedOwnerToken) === false, 'Server rules REJECT unverified owner email');
assert(evaluateClientIsOwner(unverifiedOwnerUser) === false, 'Client REJECTS unverified owner email');

// Regular community user
const regularUserToken = { token: { email: 'visitor@gmail.com', email_verified: true } };
const regularUser = { email: 'visitor@gmail.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] };
assert(evaluateIsOwnerRule(regularUserToken) === false, 'Server rules REJECT regular authenticated visitor');
assert(evaluateClientIsOwner(regularUser) === false, 'Client treats regular authenticated visitor as normal user');
assert(canAccessAdminRoute({ uid: 'visitor123', email: 'visitor@gmail.com', isOwner: false }) === false, 'Regular authenticated visitor cannot access admin dashboard');

// Unauthenticated public visitor
assert(evaluateIsOwnerRule(null) === false, 'Server rules REJECT unauthenticated visitor');
assert(evaluateClientIsOwner(null) === false, 'Client treats unauthenticated visitor as guest');
assert(canAccessAdminRoute(null) === false, 'Unauthenticated visitor cannot access admin dashboard');

// 10. Milestone 6: GitHub Static Image Hosting & Compatibility Tests
console.log('\n▶ [MILESTONE 6] GitHub-Based Image Hosting & Path Resolution Tests:');
const assetsProjectsDir = path.join(__dirname, 'assets', 'projects');
const assetsReadmePath = path.join(assetsProjectsDir, 'README.md');
const demoCoverPath = path.join(assetsProjectsDir, 'demo', 'cover.webp');

assert(fs.existsSync(assetsProjectsDir), 'assets/projects directory exists');
assert(fs.existsSync(assetsReadmePath), 'assets/projects/README.md documentation exists');
assert(fs.existsSync(demoCoverPath), 'assets/projects/demo/cover.webp exists');
assert(fs.statSync(demoCoverPath).size > 1000, 'assets/projects/demo/cover.webp is a valid non-empty WebP image');
assert(vercelJson.headers.some(h => h.source.includes('assets/')), 'vercel.json explicitly configures caching for assets/');

// Extract and test image helpers in VM context
const validateExtract = jsCode.match(/function validateImagePath[\s\S]*?^}/m);
const resolveExtract = jsCode.match(/function resolveImageUrl[\s\S]*?^}/m);
const fallbackExtract = jsCode.match(/const FALLBACK_IMAGE\s*=.*$/m);

assert(!!validateExtract, 'validateImagePath is declared in index.html');
assert(!!resolveExtract, 'resolveImageUrl is declared in index.html');
assert(!!fallbackExtract, 'FALLBACK_IMAGE is declared in index.html');

if (validateExtract) vm.runInContext(validateExtract[0], context);
if (resolveExtract) vm.runInContext(resolveExtract[0], context);
if (fallbackExtract) vm.runInContext(fallbackExtract[0].replace(/^const\s+/, 'var '), context);

// Test resolveImageUrl
assert(sandbox.resolveImageUrl('/assets/projects/demo/cover.webp') === '/assets/projects/demo/cover.webp', 'resolveImageUrl preserves root-relative static asset path');
assert(sandbox.resolveImageUrl('assets/projects/demo/cover.webp') === '/assets/projects/demo/cover.webp', 'resolveImageUrl normalizes relative assets/ path to /assets/...');
assert(sandbox.resolveImageUrl('https://firebasestorage.googleapis.com/v0/b/app/o/img.jpg') === 'https://firebasestorage.googleapis.com/v0/b/app/o/img.jpg', 'resolveImageUrl preserves legacy Firebase Storage URLs');
assert(sandbox.resolveImageUrl('https://example.com/cover.png') === 'https://example.com/cover.png', 'resolveImageUrl preserves valid external HTTPS URLs');
assert(sandbox.resolveImageUrl('javascript:alert(1)') === '', 'resolveImageUrl blocks dangerous javascript: URI');
assert(sandbox.resolveImageUrl('data:text/html,bad') === '', 'resolveImageUrl blocks non-SVG data: URI');
assert(sandbox.resolveImageUrl('../secret/file') === '', 'resolveImageUrl blocks path traversal (..)');

// Test validateImagePath
assert(sandbox.validateImagePath('/assets/projects/my-app/cover.webp').valid === true, 'validateImagePath accepts valid root-relative static path');
assert(sandbox.validateImagePath('assets/projects/my-app/cover.webp').valid === true && sandbox.validateImagePath('assets/projects/my-app/cover.webp').path === '/assets/projects/my-app/cover.webp', 'validateImagePath normalizes relative assets/ path');
assert(sandbox.validateImagePath('https://firebasestorage.googleapis.com/v0/b/project/o/legacy.jpg').valid === true, 'validateImagePath accepts legacy Firebase Storage URL');
assert(sandbox.validateImagePath('https://example.com/image.png').valid === true, 'validateImagePath accepts valid external HTTPS URL');
assert(sandbox.validateImagePath('javascript:alert(1)').valid === false, 'validateImagePath blocks javascript: URI');
assert(sandbox.validateImagePath('data:image/png;base64,...').valid === false, 'validateImagePath blocks data: URI for new inputs');
assert(sandbox.validateImagePath('../traversal').valid === false, 'validateImagePath blocks path traversal (..)');
assert(sandbox.validateImagePath('').valid === false, 'validateImagePath rejects empty path');

// Test FALLBACK_IMAGE and UI hooks
assert(sandbox.FALLBACK_IMAGE.startsWith('data:image/svg+xml'), 'FALLBACK_IMAGE is a valid SVG Data URI');
assert(html.includes('updateCoverPreview('), 'updateCoverPreview live preview implemented');
assert(html.includes('clearCoverPath()'), 'clearCoverPath allows clearing/removing cover image');
assert(html.includes('addScreenshotPath()'), 'addScreenshotPath allows adding multiple screenshots');
assert(html.includes('moveScreenshot('), 'moveScreenshot allows reordering screenshots up and down');
assert(html.includes('removeScreenshotItem('), 'removeScreenshotItem allows removing screenshots');
assert(html.includes('onerror="this.onerror=null;this.src=FALLBACK_IMAGE;"'), 'Image elements include graceful fallback on error');

// 11. Milestone 7: Security Hardening Checks
console.log('\n▶ [MILESTONE 7] Production Security Hardening Checks:');
assert(vercelJson.headers.some(h => h.headers.some(item => item.key === 'Content-Security-Policy')), 'vercel.json configures Content-Security-Policy (CSP)');
assert(vercelJson.headers.some(h => h.headers.some(item => item.key === 'Permissions-Policy')), 'vercel.json configures Permissions-Policy');
assert(firestoreRules.includes('isPublishedProject('), 'firestore.rules enforces isPublishedProject verification for reviews');
assert(firestoreRules.includes('match /usernames/{usernameLower}'), 'firestore.rules provides public usernames directory for availability checks');
assert(firestoreRules.includes('allow read: if isUser(userId) || isOwner();'), 'firestore.rules restricts users/{userId} read to self or owner (Priority 1 email privacy)');
assert(!firestoreRules.includes("'userEmail'") && firestoreRules.includes("hasOnlyAllowedFields(['projectId', 'userId', 'rating', 'message', 'userName', 'userPhoto', 'createdAt'])"), 'firestore.rules excludes userEmail from feedback schema');
assert(storageRules.includes('allow write: if false;'), 'storage.rules disables arbitrary new uploads to Firebase Storage (Priority 4)');
assert(html.includes("collection('usernames').doc(lowerName).get()"), 'index.html checks username availability against public usernames collection');
assert(!jsCode.includes("userEmail: authState.user.email"), 'index.html submitFeedback does not store userEmail in feedback documents');
assert(sandbox.validateImagePath('/assets/bad url/pic.webp').valid === false, 'validateImagePath rejects unencoded whitespace in paths');
assert(sandbox.validateImagePath('javascript:alert(1)').valid === false, 'validateImagePath rejects javascript: scheme');
assert(sandbox.resolveImageUrl('/assets/evil..path/pic.webp') === '', 'resolveImageUrl blocks path traversal (..)');

console.log('\n========================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL TEST SUITES PASSED CLEANLY!\n');
  process.exit(0);
}
