import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const BASE_URL = 'https://translation.googleapis.com/language/translate/v2';

async function translateText(text, targetLang) {
  if (!TRANSLATE_API_KEY) {
    throw new Error('Google Translate API key is missing. Please set the GOOGLE_TRANSLATE_API_KEY environment variable.');
  }

  const response = await fetch(`${BASE_URL}?key=${TRANSLATE_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      target: targetLang,
      source: 'en',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Translate API error: ${error.error.message}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

async function updateTranslations() {
  try {
    const localesDir = path.resolve(process.cwd(), 'client/src/locales');
    const enFilePath = path.join(localesDir, 'en.json');
    const esFilePath = path.join(localesDir, 'es.json');
    const caFilePath = path.join(localesDir, 'ca.json');

    const enData = JSON.parse(await fs.readFile(enFilePath, 'utf-8'));
    const esData = JSON.parse(await fs.readFile(esFilePath, 'utf-8'));
    const caData = JSON.parse(await fs.readFile(caFilePath, 'utf-8'));

    const missingEsKeys = Object.keys(enData).filter(key => !esData.hasOwnProperty(key));
    const missingCaKeys = Object.keys(enData).filter(key => !caData.hasOwnProperty(key));

    if (missingEsKeys.length > 0) {
      console.log('Translating missing keys for Spanish...');
      for (const key of missingEsKeys) {
        esData[key] = await translateText(enData[key], 'es');
        console.log(`  - Translated "${key}" to Spanish`);
      }
      await fs.writeFile(esFilePath, JSON.stringify(esData, null, 2));
      console.log('Spanish translations updated successfully.');
    } else {
      console.log('No missing keys found for Spanish.');
    }

    if (missingCaKeys.length > 0) {
      console.log('Translating missing keys for Catalan...');
      for (const key of missingCaKeys) {
        caData[key] = await translateText(enData[key], 'ca');
        console.log(`  - Translated "${key}" to Catalan`);
      }
      await fs.writeFile(caFilePath, JSON.stringify(caData, null, 2));
      console.log('Catalan translations updated successfully.');
    } else {
      console.log('No missing keys found for Catalan.');
    }

  } catch (error) {
    console.error('Error updating translations:', error.message);
  }
}

updateTranslations();
