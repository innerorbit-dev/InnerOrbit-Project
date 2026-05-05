import {
    isValidUserIdFormat,
    isValidPinFormat,
    generateUniqueUserId,
    generateUniquePin
} from '../user-id-generator';

// Mock Firebase
jest.mock('../firebase', () => ({
    db: {}
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
    query: jest.fn(),
    where: jest.fn()
}));

describe('User ID Generator', () => {
    describe('isValidUserIdFormat', () => {
        test('should accept valid 4-digit IDs', () => {
            expect(isValidUserIdFormat('2580')).toBe(true);
            expect(isValidUserIdFormat('3746')).toBe(true);
            expect(isValidUserIdFormat('0258')).toBe(true);
        });

        test('should reject IDs with wrong length', () => {
            expect(isValidUserIdFormat('123')).toBe(false);
            expect(isValidUserIdFormat('12345')).toBe(false);
            expect(isValidUserIdFormat('')).toBe(false);
        });

        test('should reject non-numeric IDs', () => {
            expect(isValidUserIdFormat('abcd')).toBe(false);
            expect(isValidUserIdFormat('12a4')).toBe(false);
            expect(isValidUserIdFormat('12 4')).toBe(false);
        });

        test('should reject sequential ascending patterns', () => {
            expect(isValidUserIdFormat('1234')).toBe(false);
            expect(isValidUserIdFormat('0123')).toBe(false);
            expect(isValidUserIdFormat('5678')).toBe(false);
        });

        test('should reject sequential descending patterns', () => {
            expect(isValidUserIdFormat('4321')).toBe(false);
            expect(isValidUserIdFormat('9876')).toBe(false);
            expect(isValidUserIdFormat('3210')).toBe(false);
        });

        test('should reject all same digits', () => {
            expect(isValidUserIdFormat('0000')).toBe(false);
            expect(isValidUserIdFormat('1111')).toBe(false);
            expect(isValidUserIdFormat('9999')).toBe(false);
        });

        test('should reject repeating patterns', () => {
            expect(isValidUserIdFormat('0101')).toBe(false);
            expect(isValidUserIdFormat('1212')).toBe(false);
            expect(isValidUserIdFormat('1010')).toBe(false);
        });

        test('should reject IDs with adjacent sequential digits', () => {
            // IDs containing pairs like 12, 23, 89, 90, etc.
            expect(isValidUserIdFormat('1290')).toBe(false);
            expect(isValidUserIdFormat('8945')).toBe(false);
            expect(isValidUserIdFormat('0912')).toBe(false);
        });
    });

    describe('isValidPinFormat', () => {
        test('should accept valid 6-digit PINs', () => {
            expect(isValidPinFormat('123456')).toBe(true);
            expect(isValidPinFormat('000000')).toBe(true);
            expect(isValidPinFormat('999999')).toBe(true);
            expect(isValidPinFormat('012345')).toBe(true);
        });

        test('should reject PINs with wrong length', () => {
            expect(isValidPinFormat('12345')).toBe(false);
            expect(isValidPinFormat('1234567')).toBe(false);
            expect(isValidPinFormat('')).toBe(false);
        });

        test('should reject non-numeric PINs', () => {
            expect(isValidPinFormat('abcdef')).toBe(false);
            expect(isValidPinFormat('12345a')).toBe(false);
            expect(isValidPinFormat('123 456')).toBe(false);
        });
    });

    describe('generateUniqueUserId', () => {
        test('should generate a valid 4-digit user ID', async () => {
            const userId = await generateUniqueUserId();

            expect(userId).toBeDefined();
            expect(userId.length).toBe(4);
            expect(/^\d{4}$/.test(userId)).toBe(true);
        });

        test('should generate non-sequential IDs', async () => {
            const userId = await generateUniqueUserId();

            // Should not be blocked sequences
            expect(isValidUserIdFormat(userId)).toBe(true);
        });

        test('should generate different IDs on multiple calls', async () => {
            const id1 = await generateUniqueUserId();
            const id2 = await generateUniqueUserId();
            const id3 = await generateUniqueUserId();

            // At least one should be different (very high probability)
            const allSame = (id1 === id2 && id2 === id3);
            expect(allSame).toBe(false);
        });
    });

    describe('generateUniquePin', () => {
        test('should generate a valid 6-digit PIN', async () => {
            const pin = await generateUniquePin();

            expect(pin).toBeDefined();
            expect(pin.length).toBe(6);
            expect(/^\d{6}$/.test(pin)).toBe(true);
        });

        test('should generate different PINs on multiple calls', async () => {
            const pin1 = await generateUniquePin();
            const pin2 = await generateUniquePin();
            const pin3 = await generateUniquePin();

            // At least one should be different (very high probability)
            const allSame = (pin1 === pin2 && pin2 === pin3);
            expect(allSame).toBe(false);
        });

        test('should pad PINs with leading zeros', async () => {
            // Generate multiple PINs and check if any start with 0
            const pins = await Promise.all([
                generateUniquePin(),
                generateUniquePin(),
                generateUniquePin(),
                generateUniquePin(),
                generateUniquePin()
            ]);

            // All should be exactly 6 digits
            pins.forEach(pin => {
                expect(pin.length).toBe(6);
                expect(/^\d{6}$/.test(pin)).toBe(true);
            });
        });
    });
});
