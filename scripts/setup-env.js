// Script to help set up environment variables
const fs = require('fs');
const path = require('path');

// Check if .env file exists, create it if it doesn't
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, 'GEMINI_API_KEY=your_api_key_here\n');
    console.log('\x1b[32m✓\x1b[0m Created .env file');
    console.log('\x1b[33m!\x1b[0m Please edit .env and add your Gemini API key');
    console.log('\x1b[34mi\x1b[0m Get your API key from: https://makersuite.google.com/app/apikey');
} else {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('GEMINI_API_KEY=')) {
        fs.appendFileSync(envPath, '\nGEMINI_API_KEY=your_api_key_here\n');
        console.log('\x1b[32m✓\x1b[0m Added GEMINI_API_KEY to .env file');
        console.log('\x1b[33m!\x1b[0m Please edit .env and add your Gemini API key');
        console.log('\x1b[34mi\x1b[0m Get your API key from: https://makersuite.google.com/app/apikey');
    } else {
        console.log('\x1b[34mi\x1b[0m GEMINI_API_KEY already exists in .env file');
        console.log('\x1b[33m!\x1b[0m If AI features are not working, verify the API key is correct');
    }
}
