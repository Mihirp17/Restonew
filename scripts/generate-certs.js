const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const certPath = path.join(__dirname, '..', 'server', 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certPath)) {
  fs.mkdirSync(certPath, { recursive: true });
}

const keyPath = path.join(certPath, 'key.pem');
const certFilePath = path.join(certPath, 'cert.pem');

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
  console.log('SSL certificates already exist. Delete them first if you want to regenerate.');
  process.exit(0);
}

console.log('Generating self-signed SSL certificates for development...');

// Generate self-signed certificate using OpenSSL
const command = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certFilePath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Error generating certificates:', error);
    console.error(stderr);
    process.exit(1);
  }
  
  console.log('✅ SSL certificates generated successfully!');
  console.log(`Key: ${keyPath}`);
  console.log(`Certificate: ${certFilePath}`);
  console.log('\nYou can now start the server with HTTPS support.');
});