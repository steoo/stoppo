// App Store Connect helper for Stoppo's screenshots. No dependencies.
//
//   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_….p8 \
//     node tools/appstore/asc.mjs status        # list screenshot sets and each screenshot's state
//     node tools/appstore/asc.mjs screenshots   # replace all screenshots with assets/screenshots/
//
// The API key needs the App Manager role. Keep the .p8 file outside the repo.

import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

const BUNDLE_ID = 'com.steoo.stoppo';
const API = 'https://api.appstoreconnect.apple.com/v1';
const SHOTS = new URL('../../assets/screenshots/', import.meta.url);

// Display types and the files that go into each, in order.
const SETS = {
  APP_IPHONE_67: 'iphone-', // 6.9" / 6.7" (1320×2868)
  APP_IPHONE_65: 'iphone65-', // 6.5" (1284×2778)
  APP_IPAD_PRO_3GEN_129: 'ipad-', // 13" iPad (2064×2752)
};
const SCENES = ['1-home', '2-one-stop', '3-puzzles', '4-progress', '5-dark'];

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
  console.error('Set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH.');
  process.exit(1);
}
const key = createPrivateKey(readFileSync(ASC_KEY_PATH.replace(/^~/, homedir())));

function token() {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({
    iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1',
  })}`;
  const sig = sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${body}.${sig}`;
}

async function api(method, path, body) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function localizations() {
  const app = (await api('GET', `/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0];
  if (!app) throw new Error(`No app with bundle ID ${BUNDLE_ID}`);
  const versions = (await api('GET', `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data;
  const version = versions.find((v) => v.attributes.appStoreState !== 'READY_FOR_SALE') ?? versions[0];
  console.log(`Stoppo ${version.attributes.versionString} (${version.attributes.appStoreState})`);
  return (await api('GET', `/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data;
}

async function screenshotSets(loc) {
  return (await api('GET', `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
}

async function screenshotsIn(set) {
  return (await api('GET', `/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data;
}

async function status() {
  for (const loc of await localizations()) {
    console.log(`\n${loc.attributes.locale}`);
    for (const set of await screenshotSets(loc)) {
      const shots = await screenshotsIn(set);
      console.log(`  ${set.attributes.screenshotDisplayType}: ${shots.length}`);
      for (const s of shots) {
        const state = s.attributes.assetDeliveryState;
        console.log(`    ${s.attributes.fileName}  ${state?.state}${state?.errors?.length ? ` ${JSON.stringify(state.errors)}` : ''}`);
      }
    }
  }
}

async function upload(setId, fileUrl) {
  const fileName = fileUrl.pathname.split('/').pop();
  const data = readFileSync(fileUrl);
  const created = await api('POST', '/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize: statSync(fileUrl).size },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  for (const op of created.data.attributes.uploadOperations) {
    const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: data.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`Upload of ${fileName} failed: ${res.status}`);
  }
  await api('PATCH', `/appScreenshots/${created.data.id}`, {
    data: {
      type: 'appScreenshots',
      id: created.data.id,
      attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(data).digest('hex') },
    },
  });
  console.log(`    uploaded ${fileName}`);
}

// Deletes every screenshot in the target sets (including stuck ones) and uploads ours.
async function replaceScreenshots() {
  for (const loc of await localizations()) {
    console.log(`\n${loc.attributes.locale}`);
    const sets = await screenshotSets(loc);
    for (const [displayType, prefix] of Object.entries(SETS)) {
      let set = sets.find((s) => s.attributes.screenshotDisplayType === displayType);
      if (!set) {
        set = (await api('POST', '/appScreenshotSets', {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: displayType },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
          },
        })).data;
      }
      console.log(`  ${displayType}`);
      for (const old of await screenshotsIn(set)) {
        await api('DELETE', `/appScreenshots/${old.id}`);
        console.log(`    deleted ${old.attributes.fileName}`);
      }
      for (const scene of SCENES) await upload(set.id, new URL(`${prefix}${scene}.jpg`, SHOTS));
    }
  }
  console.log('\nDone. Apple processes the images for a minute or two; run "status" to check.');
}

const command = process.argv[2];
if (command === 'status') await status();
else if (command === 'screenshots') await replaceScreenshots();
else console.log('Usage: node tools/appstore/asc.mjs status|screenshots');
