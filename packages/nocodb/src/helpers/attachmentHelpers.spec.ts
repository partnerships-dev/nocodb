import slash from 'slash';

// validateAndNormaliseLocalPath compares paths with the platform `path` module.
// The Windows separator defect only appears with win32 semantics, so the module
// is pinned here to keep this regression test deterministic on POSIX runners.
jest.mock('path', () => jest.requireActual('path').win32);

// Keep the validator isolated from the application bootstrap (config files,
// database, plugin manager). Only path handling is under test.
jest.mock('~/utils/nc-config', () => ({
  getToolDir: () => 'C:\\NocoDB\\data',
}));
jest.mock('~/helpers/catchError', () => ({
  NcError: {
    notFound: () => {
      throw new Error('Not found');
    },
    badRequest: (message: string) => {
      throw new Error(message);
    },
  },
}));
jest.mock('~/helpers/NcPluginMgrv2', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('~/models', () => ({
  PresignedUrl: class PresignedUrl {},
}));
jest.mock('~/utils', () => ({
  isSecureAttachmentEnabled: false,
}));

import { validateAndNormaliseLocalPath } from './attachmentHelpers';

const relativeKey = 'nc/uploads/noco/base/model/column/Companies.csv';
const expectedAbsolutePath =
  'C:\\NocoDB\\data\\nc\\uploads\\noco\\base\\model\\column\\Companies.csv';

describe('validateAndNormaliseLocalPath', () => {
  it('resolves a storage key relative to the nc directory', () => {
    expect(validateAndNormaliseLocalPath(relativeKey)).toBe(expectedAbsolutePath);
  });

  it('accepts its own absolute result when it comes back with forward slashes', () => {
    // Local.fileCreateByStream writes the file, then reads it back with the
    // absolute path it received. That read path is already normalised by
    // `slash`, while getToolDir() returns native Windows separators, so the
    // base directory prefix has to be normalised the same way or the check
    // rejects a path that is inside nc.
    const absolutePath = validateAndNormaliseLocalPath(relativeKey);
    const readBackPath = slash(absolutePath);

    expect(absolutePath).toBe(expectedAbsolutePath);
    expect(readBackPath).not.toContain('\\');
    expect(validateAndNormaliseLocalPath(readBackPath, true)).toBe(absolutePath);
  });

  it('rejects traversal and sibling prefixes outside nc', () => {
    expect(() => validateAndNormaliseLocalPath('nc/../outside.csv')).toThrow(
      'Invalid path',
    );
    expect(() => validateAndNormaliseLocalPath('nc_other/file.csv')).toThrow(
      'Invalid path',
    );
  });

  it('keeps the not-found mode for rejected paths', () => {
    expect(() => validateAndNormaliseLocalPath('nc/../outside.csv', true)).toThrow(
      'Not found',
    );
  });
});
