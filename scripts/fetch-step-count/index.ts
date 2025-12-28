
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as http from 'http';
import { URL } from 'url';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const OUTPUT_FILE_PATH_ENV = process.env.OUTPUT_FILE_PATH; // New line

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error('Google client ID and secret are not set in the .env file');
}

const SCOPES = ['https://www.googleapis.com/auth/fitness.activity.read'];

const REDIRECT_URI = 'http://localhost:3000';

async function getRefreshToken() {
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  console.log('NOTE: Make sure to add http://localhost:3000 to your authorized redirect URIs in the Google Cloud Platform Console.');

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url) {
        const url = new URL(req.url, 'http://localhost:3000');
        const code = url.searchParams.get('code');
        if (code) {
          res.end('Authentication successful! Please check your console.');
          const { tokens } = await oAuth2Client.getToken(code);
          console.log('Your refresh token is:', tokens.refresh_token);
          console.log('Please save it in your .env file as GOOGLE_REFRESH_TOKEN');
          server.close();
          process.exit();
        }
      }
    } catch (e) {
      console.error(e);
      res.end('Authentication failed.');
      server.close();
      process.exit(1);
    }
  }).listen(3000, () => {
    console.log('Server is listening on http://localhost:3000');
  });
}

async function getStepCount(): Promise<number> {
  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google refresh token is not set in the .env file');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  const fitness = google.fitness({
    version: 'v1',
    auth: oauth2Client,
  });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimeMillis = startOfDay.getTime();
  const endTimeMillis = now.getTime();

  const res = await fitness.users.dataset.aggregate({
    userId: 'me',
    requestBody: {
      aggregateBy: [
        {
          dataTypeName: 'com.google.step_count.delta',
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
        },
      ],
      bucketByTime: { durationMillis: '86400000' }, // 24 hours
      startTimeMillis: startTimeMillis.toString(),
      endTimeMillis: endTimeMillis.toString(),
    }
  });

  return res.data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
}

async function getSevenDayAverage(): Promise<number> {
  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google refresh token is not set in the .env file');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  const fitness = google.fitness({
    version: 'v1',
    auth: oauth2Client,
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

  const res = await fitness.users.dataset.aggregate({
    userId: 'me',
    requestBody: {
      aggregateBy: [
        {
          dataTypeName: 'com.google.step_count.delta',
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
        },
      ],
      bucketByTime: { durationMillis: '86400000' }, // 1 day
      startTimeMillis: sevenDaysAgo.getTime().toString(),
      endTimeMillis: startOfToday.getTime().toString(),
    },
  });

  const buckets = res.data.bucket;
  if (buckets && buckets.length > 0) {
    const totalSteps = buckets.reduce((total, bucket) => {
      const stepCount = bucket.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      return total + stepCount;
    }, 0);
    return Math.round(totalSteps / buckets.length);
  }
  return 0;
}

async function main() {
  try {
    const [todaySteps, sevenDayAverage] = await Promise.all([
      getStepCount(),
      getSevenDayAverage(),
    ]);

    const output = ` Steps: ${todaySteps} / ${sevenDayAverage}`;
    const filePath = OUTPUT_FILE_PATH_ENV && OUTPUT_FILE_PATH_ENV.trim() !== ''
      ? OUTPUT_FILE_PATH_ENV
      : path.join(__dirname, 'step-count.txt'); // Use default if ENV is empty or non-existent
    fs.writeFileSync(filePath, output);
    console.log(`Step count data saved to ${filePath}`);

  } catch (error) {
    console.error('Error fetching step count data:', error);
  }
}

const command = process.argv[2];

if (command === 'get-refresh-token') {
  getRefreshToken();
} else {
  main();
}
