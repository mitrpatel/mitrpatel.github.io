// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyClUx8H2gTfeQFvGtWHyYtaLHciXqT1xuU",
    authDomain: "cash-track-8c710.firebaseapp.com",
    projectId: "cash-track-8c710",
    storageBucket: "cash-track-8c710.firebasestorage.app",
    messagingSenderId: "1045178214176",
    appId: "1:1045178214176:web:be6da4b7c6e9fb9cc49945",
    measurementId: "G-HPWKXQXBMF"
};

// ============================================
// ALLOWED GOOGLE ACCOUNT
// ============================================
// Only this Google account can access the app
const ALLOWED_EMAIL = "pmitr02@gmail.com";

// ============================================
// DO NOT MODIFY BELOW THIS LINE
// ============================================

// Import Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    where,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

// Initialize Firebase
let app;
let db;
let auth;
let googleProvider;
let initialized = false;
let currentUser = null;

async function initializeFirebase() {
    if (initialized) return true;

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        initialized = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

// Google Sign-In
async function loginWithGoogle() {
    try {
        await initializeFirebase();

        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Check if the email is allowed
        if (user.email !== ALLOWED_EMAIL) {
            // Sign out unauthorized user immediately
            await signOut(auth);
            currentUser = null;
            return {
                success: false,
                error: 'Access denied. Unauthorized account.'
            };
        }

        currentUser = user;
        return { success: true, user: currentUser };
    } catch (error) {
        console.error('Login error:', error.code);
        let message = 'Access denied';
        if (error.code === 'auth/popup-closed-by-user') {
            message = 'Sign-in cancelled';
        } else if (error.code === 'auth/popup-blocked') {
            message = 'Popup blocked. Allow popups and try again.';
        } else if (error.code === 'auth/unauthorized-domain') {
            message = 'Domain not authorized. Check Firebase Console.';
        } else if (error.code === 'auth/operation-not-allowed') {
            message = 'Google Sign-In not enabled in Firebase.';
        }
        return { success: false, error: message };
    }
}

async function logout() {
    try {
        await signOut(auth);
        currentUser = null;
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

function getCurrentUser() {
    return currentUser;
}

function isAuthenticated() {
    return currentUser !== null && currentUser.email === ALLOWED_EMAIL;
}

// Check existing auth state on page load
async function checkAuthState() {
    await initializeFirebase();
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            if (user && user.email === ALLOWED_EMAIL) {
                currentUser = user;
                resolve({ authenticated: true, user });
            } else {
                currentUser = null;
                resolve({ authenticated: false });
            }
        });
    });
}

// Firestore Operations

async function addDocument(collectionName, data) {
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: Timestamp.now()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding document:', error);
        return { success: false, error: error.message };
    }
}

async function updateDocument(collectionName, docId, data) {
    try {
        const docRef = doc(db, collectionName, docId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating document:', error);
        return { success: false, error: error.message };
    }
}

async function deleteDocument(collectionName, docId) {
    try {
        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting document:', error);
        return { success: false, error: error.message };
    }
}

async function getDocuments(collectionName) {
    try {
        const q = query(collection(db, collectionName), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const documents = [];
        querySnapshot.forEach((doc) => {
            documents.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: documents };
    } catch (error) {
        console.error('Error getting documents:', error);
        return { success: false, error: error.message, data: [] };
    }
}

async function getDocumentsByMonth(collectionName, year, month) {
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

        const q = query(
            collection(db, collectionName),
            where('date', '>=', startDate),
            where('date', '<', endDate),
            orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const documents = [];
        querySnapshot.forEach((doc) => {
            documents.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: documents };
    } catch (error) {
        console.error('Error getting documents by month:', error);
        const allDocs = await getDocuments(collectionName);
        if (allDocs.success) {
            const filtered = allDocs.data.filter(doc => {
                const docDate = new Date(doc.date);
                return docDate.getFullYear() === year && docDate.getMonth() + 1 === month;
            });
            return { success: true, data: filtered };
        }
        return { success: false, error: error.message, data: [] };
    }
}

// Export functions
window.FirebaseService = {
    initializeFirebase,
    loginWithGoogle,
    logout,
    getCurrentUser,
    isAuthenticated,
    checkAuthState,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocuments,
    getDocumentsByMonth
};
