# ABA Task Management System

A simple, serverless task management system for kids with parent and admin views, powered by Firebase Firestore.

## Features

- **Kid Page**: Kids can mark tasks as complete and earn money rewards
- **Parent Page**: Parents can view tasks but cannot mark them as complete
- **Admin Page**: Add new kids and manage their tasks
- **Dynamic Tasks**: Each kid has their own customized task list
- **Daily Reset**: Tasks reset automatically at midnight
- **Savings Tracker**: Kids earn $0.50 for completing all daily tasks
- **No Server Required**: Everything runs client-side with Firebase Firestore

## Project Information

- **Firebase Project ID**: `aba-ai-d74f5`
- **Hosting**: Firebase Hosting
- **Database**: Firestore

## Project Structure

```
aba/
├── public/
│   ├── index.html       # Main application (kid/parent/admin pages)
│   ├── init-db.html     # Database initialization page
│   └── lenny-small.png  # Kid's avatar image
├── .firebaserc          # Firebase project configuration
├── firebase.json        # Firebase hosting configuration
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Setup Instructions

### 1. Set Up Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `aba-ai-d74f5`
3. Enable Firestore Database:
   - Go to **Build** → **Firestore Database**
   - Click **Create Database**
   - Choose **Start in test mode** (for development)
   - Select your preferred region

### 2. Update Firebase Configuration

Open `public/index.html` and update the Firebase configuration (around line 495) with your actual Firebase credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "aba-ai-d74f5.firebaseapp.com",
    projectId: "aba-ai-d74f5",
    storageBucket: "aba-ai-d74f5.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

You can find these values in:
Firebase Console → Project Settings → General → Your apps → Firebase SDK snippet → Config

Also update the same configuration in `public/init-db.html`.

### 3. Deploy to Firebase

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy
firebase deploy
```

After deployment, your app will be available at:
`https://aba-ai-d74f5.web.app` or `https://aba-ai-d74f5.firebaseapp.com`

### 4. Initialize the Database

1. Visit your deployed app and navigate to `/init-db.html`
2. Click the button to initialize the database with לני and all her tasks

## Usage

### URLs

- **Kid Page (לני)**: `/?kid=leni`
- **Parent Page (לני)**: `/?kid=leni&mode=parent`
- **Admin Page**: `/?page=admin`
- **Initialize DB**: `/init-db.html`

### Kid Page

- Kids can click on tasks to mark them as complete
- Completing a task shows encouragement messages and animations
- Completing all tasks earns $0.50 (once per day)
- Tasks reset automatically at midnight

### Parent Page

- Same view as kid page but tasks cannot be marked as complete
- Parents can only view progress
- Access by adding `&mode=parent` to any kid URL

### Admin Page

1. **View All Kids**: See all registered kids with their task counts and savings
2. **Add New Kid**:
   - Enter the kid's name
   - Add tasks with emojis and descriptions
   - Click "שמור ילד" to save
3. **Quick Links**: Direct links to kid and parent pages for each child

## Data Structure

### Firestore Collection: `kids`

Each document represents a kid and contains:

```javascript
{
  name: string,              // Kid's name (e.g., "לני")
  tasks: [                   // Array of task objects
    {
      id: number,            // Unique task ID
      title: string,         // Task description
      icon: string           // Emoji icon
    }
  ],
  completedTasks: [number],  // Array of completed task IDs
  totalMoney: number,        // Total savings accumulated
  todayRewardGiven: boolean, // Whether today's reward was given
  lastResetDate: string,     // Last date tasks were reset
  createdAt: timestamp       // Creation timestamp
}
```

## Local Development

To run locally:

```bash
# Using Firebase emulator
firebase serve

# Using Python
cd public && python -m http.server 8000

# Using Node.js
npx serve public
```

Then visit `http://localhost:8000` or the URL shown by the command.

## Security Note

The current Firebase configuration uses test mode rules. For production use, you should set up proper Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kids/{kidId} {
      // Allow anyone to read kid data
      allow read: if true;

      // Allow anyone to update tasks (you might want to restrict this)
      allow write: if true;
    }
  }
}
```

## Customization

- **Daily Reward Amount**: Change `DAILY_REWARD` constant in `public/index.html` (line 508)
- **Encouragement Messages**: Edit the `encouragementMessages` array (lines 509-518)
- **Styling**: Modify CSS in the `<style>` section

## Troubleshooting

### "ילד לא נמצא" error
- Make sure you initialized the database using `init-db.html`
- Check that Firestore is enabled in your Firebase project

### Tasks not saving
- Verify your Firebase configuration is correct
- Check browser console for errors
- Ensure Firestore security rules allow writes

### Page not loading
- Check that all Firebase CDN scripts are loading
- Verify your internet connection
- Check browser console for errors
