# MitCash - Personal Finance Tracker

A clean, modern personal expense tracking web application built with vanilla JavaScript and Firebase Firestore.

## Features

- **Income Tracking**: Track paychecks and other income sources
- **Expense Tracking**: Categorize expenses (Rent, Utilities, Groceries, Transportation, Investment, Eating Out, Donations)
- **Credit Card Bills**: Track monthly credit card payments
- **Monthly Views**: Filter all data by month
- **Analytics & Charts**: Visual breakdown of expenses, monthly comparisons, and savings calculations
- **Password Protection**: Simple authentication to protect your data
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Sync**: Data syncs across devices via Firebase

## Project Structure

```
mitcash/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # All CSS styles
├── js/
│   ├── firebase-config.js  # Firebase configuration (EDIT THIS)
│   └── app.js              # Main application logic
└── README.md               # This file
```

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or "Add project")
3. Enter a project name (e.g., "mitcash")
4. Follow the setup wizard (you can disable Google Analytics if you don't need it)
5. Click "Create project"

### 2. Enable Firestore Database

1. In your Firebase project, click "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location closest to you
5. Click "Enable"

### 3. Set Firestore Security Rules

1. In Firestore, go to the "Rules" tab
2. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all collections
    // Note: This is simple security. For better security, implement Firebase Auth
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

> **Note**: These rules allow anyone with your app to read/write data. The password protection in the app provides basic security, but for production use with sensitive data, consider implementing Firebase Authentication.

### 4. Get Your Firebase Configuration

1. In Firebase Console, click the gear icon → "Project settings"
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "mitcash-web")
5. Copy the `firebaseConfig` object that appears

### 5. Configure the Application

1. Open `js/firebase-config.js`
2. Replace the placeholder configuration with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyB...",           // Your actual API key
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123..."
};
```

3. Set your password on line 28:

```javascript
const APP_PASSWORD = "test";
```

> **Important**: Choose a strong password. This password will be required every time you access the app.

### 6. Create Required Firestore Indexes

The app will automatically work, but for optimal performance, create these indexes:

1. Go to Firestore → "Indexes" tab
2. Click "Add Index" and create indexes for each collection:

**For `income` collection:**
- Collection ID: `income`
- Fields: `date` (Descending)

**For `expenses` collection:**
- Collection ID: `expenses`
- Fields: `date` (Descending)

**For `bills` collection:**
- Collection ID: `bills`
- Fields: `date` (Descending)

> Note: The app will still work without manual indexes - Firebase will prompt you to create them if needed.

## Deploying to GitHub Pages

### Option 1: Using GitHub Web Interface

1. Create a new repository on GitHub
2. Upload all files to the repository
3. Go to repository "Settings" → "Pages"
4. Under "Source", select "Deploy from a branch"
5. Choose "main" branch and "/ (root)" folder
6. Click "Save"
7. Wait a few minutes, then access your app at `https://yourusername.github.io/repository-name/`

### Option 2: Using Git Command Line

```bash
# Navigate to your project folder
cd mitcash

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - MitCash expense tracker"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/mitcash.git

# Push to GitHub
git push -u origin main

# Enable GitHub Pages in repository settings
```

Then go to your repository Settings → Pages → select main branch.

### Option 3: Using GitHub CLI

```bash
# Create and push repository
gh repo create mitcash --public --source=. --push

# Enable GitHub Pages
gh api repos/{owner}/{repo}/pages -X POST -f source='{"branch":"main","path":"/"}'
```

Your app will be available at: `https://yourusername.github.io/mitcash/`

## Usage Guide

### Logging In
- Enter your password (the one you set in `firebase-config.js`)
- Click "Login" or press Enter

### Adding Income
1. Click "Income" in the navigation
2. Click "+ Add Income"
3. Enter date, source description, and amount
4. Click "Save"

### Adding Expenses
1. Click "Expenses" in the navigation
2. Click "+ Add Expense"
3. Enter date, description, category, and amount
4. Click "Save"

### Adding Credit Card Bills
1. Click "Bills" in the navigation
2. Click "+ Add Bill"
3. Enter date, description, and amount
4. Click "Save"

### Viewing by Month
- Use the month dropdown in the navigation bar to switch between months
- All views will update to show data for the selected month

### Analytics
- Click "Analytics" to see:
  - Net Savings (Income - Expenses)
  - Available Savings (Income - Credit Card Bills)
  - Expense breakdown by category (pie chart)
  - Monthly expense comparison by category (stacked bar chart)
  - Income vs Expenses trend (line chart)

### Editing/Deleting Entries
- Click "Edit" on any entry to modify it
- Click "Delete" to remove an entry (with confirmation)

## Security Considerations

This app uses simple password protection. For enhanced security:

1. **Use a strong password**: Choose a complex password for `APP_PASSWORD`
2. **Don't share your config**: Never commit your `firebase-config.js` with real credentials to a public repository
3. **Consider Firebase Auth**: For production use, implement Firebase Authentication
4. **Use environment variables**: For additional security, consider using environment variables or a backend service to store sensitive configuration

## Customization

### Adding New Categories
Edit the category list in three places:
1. `index.html` - Lines 115-121 (category filter dropdown)
2. `index.html` - Lines 196-202 (form category select)
3. `js/app.js` - Lines 22-30 (categoryColors object)

### Changing Colors
Edit CSS variables in `css/styles.css` (lines 2-16):
```css
:root {
    --primary-color: #4f46e5;
    --success-color: #10b981;
    --danger-color: #ef4444;
    /* ... etc */
}
```

### Changing Currency
Edit the `formatCurrency` function in `js/app.js` (line 558):
```javascript
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'  // Change to 'EUR', 'GBP', etc.
    }).format(amount);
}
```

## Troubleshooting

### "Failed to connect to database" error
- Check that your Firebase config is correct
- Ensure Firestore is enabled in your Firebase project
- Check browser console for specific error messages

### Data not loading
- Check Firestore rules allow read access
- Verify you're logged in with the correct password
- Check browser console for errors

### Charts not displaying
- Ensure Chart.js is loading (check network tab)
- Clear browser cache and reload

## License

MIT License - Feel free to use and modify for personal use.
