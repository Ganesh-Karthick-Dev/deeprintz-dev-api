/**
 * Update ngrok URL in config and fix carrier service
 * Run this script whenever your ngrok URL changes
 * 
 * Usage: node update-ngrok-url.js <new-ngrok-url>
 * Example: node update-ngrok-url.js https://abc123.ngrok-free.app
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   UPDATE NGROK URL                                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');
  console.log('Usage: node update-ngrok-url.js <new-ngrok-url>');
  console.log('');
  console.log('Example:');
  console.log('  node update-ngrok-url.js https://abc123.ngrok-free.app');
  console.log('');
  console.log('This script will:');
  console.log('  1. Update config/shopify.js with the new ngrok URL');
  console.log('  2. Run fix-carrier-service-now.js to update Shopify carrier service');
  console.log('');
  process.exit(1);
}

const newNgrokUrl = args[0].trim().replace(/\/$/, ''); // Remove trailing slash

// Validate URL format
if (!newNgrokUrl.startsWith('https://') || !newNgrokUrl.includes('ngrok')) {
  console.error('❌ Invalid ngrok URL format!');
  console.error('   URL must start with https:// and contain "ngrok"');
  console.error('   Example: https://abc123.ngrok-free.app');
  process.exit(1);
}

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║   UPDATE NGROK URL & FIX CARRIER SERVICE                                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

console.log('📡 New ngrok URL:', newNgrokUrl);
console.log('');

// Step 1: Update config/shopify.js
console.log('1️⃣ Updating config/shopify.js...');

const configPath = path.join(__dirname, 'config', 'shopify.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace the NGROK_URL line
const ngrokUrlRegex = /NGROK_URL:\s*['"]https:\/\/[^'"]+['"]/;
const newLine = `NGROK_URL: '${newNgrokUrl}'`;

if (ngrokUrlRegex.test(configContent)) {
  const oldUrl = configContent.match(ngrokUrlRegex)[0].match(/https:\/\/[^'"]+/)[0];
  console.log('   Old URL:', oldUrl);
  console.log('   New URL:', newNgrokUrl);
  
  configContent = configContent.replace(ngrokUrlRegex, newLine);
  fs.writeFileSync(configPath, configContent, 'utf8');
  
  console.log('   ✅ Config updated successfully');
} else {
  console.error('   ❌ Could not find NGROK_URL in config file');
  process.exit(1);
}

console.log('');

// Step 2: Run fix-carrier-service-now.js
console.log('2️⃣ Updating Shopify carrier service...');
console.log('');

try {
  execSync('node fix-carrier-service-now.js', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   ✅ NGROK URL UPDATED SUCCESSFULLY!                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🎉 All done! Your Shopify integration is now using the new ngrok URL.');
  console.log('');
  
} catch (error) {
  console.error('');
  console.error('❌ Failed to update carrier service');
  console.error('   Error:', error.message);
  console.error('');
  console.error('⚠️ Config was updated, but carrier service update failed.');
  console.error('   You can try running: node fix-carrier-service-now.js');
  process.exit(1);
}

