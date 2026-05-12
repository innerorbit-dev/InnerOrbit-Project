import { VersionHelper } from '../version-helper';

describe('VersionHelper', () => {
    test('should correctly identify newer versions', () => {
        expect(VersionHelper.isNewer('1.0.4', '1.0.3')).toBe(true);
        expect(VersionHelper.isNewer('1.1.0', '1.0.9')).toBe(true);
        expect(VersionHelper.isNewer('2.0.0', '1.9.9')).toBe(true);
    });

    test('should return false for older or equal versions', () => {
        expect(VersionHelper.isNewer('1.0.2', '1.0.3')).toBe(false);
        expect(VersionHelper.isNewer('1.0.3', '1.0.3')).toBe(false);
        expect(VersionHelper.isNewer('0.9.9', '1.0.0')).toBe(false);
    });

    test('should handle incomplete version strings', () => {
        expect(VersionHelper.isNewer('1.1', '1.0.5')).toBe(true);
        expect(VersionHelper.isNewer('1', '0.9.9')).toBe(true);
    });
});
