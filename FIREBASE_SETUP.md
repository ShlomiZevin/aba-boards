# Firebase Setup Guide

This guide will walk you through setting up Firebase for the ABA Task Management System.

## Step 1: Get Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **aba-ai-d74f5**
3. Click the gear icon (⚙️) next to "Project Overview"
4. Select **Project settings**
5. Scroll down to "Your apps" section
6. If you haven't added a web app yet:
   - Click the **</>** (Web) icon
   - Register the app with a nickname (e.g., "ABA Task Board")
   - Click **Register app**
7. Copy the Firebase configuration object

It should look something like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "aba-ai-d74f5.firebaseapp.com",
  projectId: "aba-ai-d74f5",
  storageBucket: "aba-ai-d74f5.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Step 2: Enable Firestore Database

1. In the Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create database**
3. Select **Start in test mode** (for development)
   - **Important**: Test mode allows anyone to read/write for 30 days. You'll need to update security rules before that expires.
4. Choose your preferred Cloud Firestore location (pick the closest region to your users)
5. Click **Enable**

## Step 3: Update Configuration in Your Files

You need to update the Firebase configuration in **TWO** files:

### File 1: `public/index.html`

Around line 495, replace the placeholder config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",  // Replace with your real values
    authDomain: "aba-ai-d74f5.firebaseapp.com",
    projectId: "aba-ai-d74f5",
    storageBucket: "aba-ai-d74f5.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### File 2: `public/init-db.html`

Around line 47, replace the same placeholder config with your actual Firebase configuration.

## Step 4: Deploy to Firebase Hosting

```bash
# Make sure you're in the project directory
cd c:\workspace\aba

# Deploy
firebase deploy
```

If you get an error about Firebase CLI not being installed:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Try deploying again
firebase deploy
```

## Step 5: Initialize the Database

1. Once deployed, visit your app URL: `https://aba-ai-d74f5.web.app`
2. Navigate to `/init-db.html`
3. Click the **"אתחל מסד נתונים עם לני"** button
4. You should see a success message
5. Click on **"לחץ כאן לעבור ללוח של לני"** to verify everything works

## Step 6: Set Up Proper Security Rules (Production)

Before the 30-day test mode expires, update your Firestore security rules:

1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kids/{kidId} {
      // Anyone can read kid data
      allow read: if true;

      // Anyone can update tasks and progress
      // Note: In a real production app, you'd want to add authentication
      allow write: if true;
    }
  }
}
```

3. Click **Publish**

## Testing Your Setup

After completing all steps, test these URLs:

1. **לני's Kid Page**: `https://aba-ai-d74f5.web.app/?kid=leni`
   - Should show לני's task board
   - Clicking tasks should mark them as complete

2. **לני's Parent Page**: `https://aba-ai-d74f5.web.app/?kid=leni&mode=parent`
   - Should show the same tasks but clicking doesn't work

3. **Admin Page**: `https://aba-ai-d74f5.web.app/?page=admin`
   - Should show לני in the kids list
   - Should allow adding new kids

## Troubleshooting

### Error: "Firebase not defined"
- Check that your internet connection is working
- Verify the Firebase CDN scripts are loading in the browser console

### Error: "Permission denied"
- Make sure Firestore is enabled (Step 2)
- Verify security rules are set to test mode or allow reads/writes

### Error: "ילד לא נמצא" (Kid not found)
- Run the initialization script at `/init-db.html`
- Check Firebase Console → Firestore Database to see if the `kids` collection exists

### Tasks not saving
- Open browser console (F12) and check for errors
- Verify your Firebase config is correct in both files
- Make sure Firestore rules allow writes

### Can't deploy to Firebase
- Make sure you're logged in: `firebase login`
- Verify you're in the correct project directory
- Check that `.firebaserc` has the correct project ID

## Need Help?

Check the [main README](README.md) for more information about the project structure and usage.
