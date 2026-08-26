import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getZohoProjectCode,
  normalizeZohoProjectName,
  projectFieldsFromZoho,
} from '../src/lib/zoho/project-sync-utils';

const TEST_PROJECT_NAME =
  'Z1/026/2627/Pitch/Calmirize Rakshabandhan';

test('parses the requested Zoho project into CRM master fields', () => {
  assert.deepEqual(
    projectFieldsFromZoho({
      id: '445279000000068104',
      name: TEST_PROJECT_NAME,
      status: { name: 'Active' },
    }),
    {
      masterJobNo: TEST_PROJECT_NAME,
      jobCode: 'Z1/026/2627',
      name: 'Pitch / Calmirize Rakshabandhan',
      clientName: 'Pitch',
      status: 'ACTIVE',
    },
  );
});

test('normalizes whitespace and slash variants for duplicate matching', () => {
  assert.equal(
    normalizeZohoProjectName(' z1 / 026 / 2627 / Pitch '),
    'Z1/026/2627/PITCH',
  );
  assert.equal(getZohoProjectCode(TEST_PROJECT_NAME), 'Z1/026/2627');
});

test('maps completed Zoho projects without deactivating them', () => {
  assert.equal(
    projectFieldsFromZoho({ id: '1', name: 'Unstructured', status: 'Completed' })
      .status,
    'DELIVERED',
  );
});
