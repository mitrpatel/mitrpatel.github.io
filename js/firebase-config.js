// ============================================
// FIREBASE CONFIGURATION
// ============================================
// INSTRUCTIONS: Replace the placeholder values below with your actual Firebase configuration
// You can find these values in your Firebase Console:
// 1. Go to https://console.firebase.google.com/
// 2. Select your project
// 3. Click the gear icon (Settings) > Project settings
// 4. Scroll down to "Your apps" section
// 5. Copy the configuration object

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
// PASSWORD CONFIGURATION
// ============================================
// INSTRUCTIONS: Set your password here
// This password will be required to access the app
// IMPORTANT: For production use, consider using Firebase Authentication instead
// or storing this in a more secure way (environment variables, etc.)

const APP_PASSWORD = "test";

// ============================================
// DO NOT MODIFY BELOW THIS LINE
// ============================================

// Import Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
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
let initialized = false;

async function initializeFirebase() {
    // Only initialize once
    if (initialized) return true;

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        initialized = true;
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

// Authentication
function checkPassword(inputPassword) {
    return inputPassword === APP_PASSWORD;
}

// Firestore Operations

// Add a document to a collection
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

// Update a document
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

// Delete a document
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

// Get all documents from a collection
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

// Get documents by month
async function getDocumentsByMonth(collectionName, year, month) {
    try {
        // Create date range for the month
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
        // Fallback: get all and filter client-side
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

// Export functions for use in app.js
window.FirebaseService = {
    initializeFirebase,
    checkPassword,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocuments,
    getDocumentsByMonth
};
