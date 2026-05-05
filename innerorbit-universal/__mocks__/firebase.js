// Mock Firebase Auth
export const auth = {
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } })),
    createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'test-uid', email: 'test@example.com' } })),
    signOut: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: jest.fn((callback) => {
        callback(null);
        return jest.fn(); // unsubscribe function
    })
};

// Mock Firestore
export const db = {
    collection: jest.fn((collectionName) => ({
        doc: jest.fn((docId) => ({
            get: jest.fn(() => Promise.resolve({
                exists: true,
                data: () => ({ id: docId, name: 'Test Document' })
            })),
            set: jest.fn(() => Promise.resolve()),
            update: jest.fn(() => Promise.resolve()),
            delete: jest.fn(() => Promise.resolve()),
            onSnapshot: jest.fn((callback) => {
                callback({ exists: true, data: () => ({}) });
                return jest.fn(); // unsubscribe
            })
        })),
        add: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
        where: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
                docs: [],
                forEach: jest.fn()
            }))
        }))
    }))
};

// Mock Firebase Storage
export const storage = {
    ref: jest.fn(() => ({
        put: jest.fn(() => Promise.resolve()),
        getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/file.jpg'))
    }))
};
