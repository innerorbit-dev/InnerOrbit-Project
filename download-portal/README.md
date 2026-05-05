# InnerOrbit Download Portal - Admin Guide

## 🎯 What This Is

A password-protected download portal where:
- Users need email + password to access downloads
- Admin (you) controls who can download
- Tracks all download attempts
- Distributes APK and Windows EXE files

---

## 📁 Files Created

```
download-portal/
├── index.html          # Login page (password protected)
├── downloads.html      # Download page (APK + EXE)
├── admin.html          # Admin dashboard (manage users)
├── docs/               # Structured documentation (guides, tech, legal)
└── README.md           # This file
```

---

## 📚 Documentation

For more detailed guides and technical information, see the [docs/](docs/) folder:

- **Guides**: [Setup](docs/guides/DOCUMENTATION_SETUP_GUIDE.md), [Deployment](docs/guides/DEPLOY_GUIDE.md), [Portal](docs/guides/PORTAL-GUIDE.md)
- **Technical**: [Implementation](docs/technical/DOCS_IMPLEMENTATION_COMPLETE.md), [Quick Ref](docs/technical/DOCS_QUICK_REFERENCE.md), [Report](docs/technical/REPORT.md)
- **Legal**: [Legal Guide](docs/legal/LEGAL-DOCUMENTS-GUIDE.md)
- **Branding**: [Branding Steps](docs/branding/BRANDING_STEPS.md)

---

## 🔧 Setup Instructions

### Step 1: Firebase Setup (Required)

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/
   - Use your existing InnerOrbit project

2. **Enable Email/Password Authentication:**
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"

3. **Create Firestore Collection:**
   ```
   Collection: downloadAccess
   Document ID: {userId}
   Fields:
     - email: string
     - allowed: boolean (true/false)
     - downloads: object
       - android: number
       - windows: number
     - createdAt: timestamp
     - lastDownload: timestamp
   ```

4. **Add Firebase Config:**
   - Open `index.html`, `downloads.html`, `admin.html`
   - Replace `YOUR_API_KEY` etc. with your Firebase config
   - Find config in Firebase Console → Project Settings

### Step 2: Upload Files to Hosting

**Option A: Firebase Hosting (Recommended)**
```bash
cd download-portal
firebase init hosting
firebase deploy
```

**Option B: Netlify**
- Drag and drop the `download-portal` folder to Netlify

**Option C: Vercel**
```bash
cd download-portal
vercel deploy
```

### Step 3: Upload APK and EXE Files

**Option A: Firebase Storage**
1. Go to Firebase Console → Storage
2. Upload `InnerOrbit.apk` and `InnerOrbit.exe`
3. Get download URLs
4. Update URLs in `downloads.html` (line 140)

**Option B: Google Drive**
1. Upload files to Google Drive
2. Make them publicly accessible
3. Get direct download links
4. Update URLs in `downloads.html`

**Option C: Your Own Server**
- Upload to your web server
- Update URLs in `downloads.html`

---

## 👤 Managing Users

### Add New User (Give Access)

1. **Create Firebase User:**
   - Go to Firebase Console → Authentication
   - Click "Add User"
   - Enter email and password
   - Copy the User ID (UID)

2. **Grant Download Access:**
   - Go to Firestore Database
   - Collection: `downloadAccess`
   - Add document with UID as ID:
   ```json
   {
     "email": "user@example.com",
     "allowed": true,
     "downloads": {
       "android": 0,
       "windows": 0
     },
     "createdAt": "2026-01-06T23:00:00Z"
   }
   ```

3. **Share Credentials:**
   - Send user the portal URL
   - Send them their email and password
   - They can now login and download!

### Remove User Access

1. Go to Firestore → `downloadAccess` → {userId}
2. Change `allowed` from `true` to `false`
3. User can no longer download (even if they login)

### Delete User Completely

1. Firebase Console → Authentication
2. Find user and click delete
3. Also delete from Firestore → `downloadAccess`

---

## 📊 Track Downloads

### View Download Stats

1. Go to Firestore → `downloadAccess`
2. Each user document shows:
   - Total Android downloads
   - Total Windows downloads
   - Last download timestamp

### Export Download Report

Use Firebase Console or create a simple script:
```javascript
// Get all users with download stats
const snapshot = await getDocs(collection(db, 'downloadAccess'));
snapshot.forEach(doc => {
  const data = doc.data();
  console.log(`${data.email}: Android=${data.downloads.android}, Windows=${data.downloads.windows}`);
});
```

---

## 🔐 Security Best Practices

### 1. Strong Passwords
- Give each user a unique, strong password
- Example: `Cp2026!User#123`

### 2. Limit Access
- Only give access to trusted users
- Regularly review who has access

### 3. Monitor Downloads
- Check download stats weekly
- Look for suspicious activity (too many downloads)

### 4. Firestore Security Rules
Add these rules to protect your data:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /downloadAccess/{userId} {
      // Users can only read their own access status
      allow read: if request.auth.uid == userId;
      // Only admin can write (use Firebase Admin SDK)
      allow write: if false;
    }
  }
}
```

---

## 💰 Cost Estimate

### Free Tier (Up to 100 users):
- Firebase Hosting: Free
- Firebase Authentication: Free
- Firebase Firestore: Free (50K reads/day)
- Firebase Storage: Free (5GB)
**Total: $0/month**

### Paid (100-1000 users):
- Firebase Blaze Plan: ~$10-25/month
- Bandwidth for downloads: ~$20-50/month
**Total: ~$30-75/month**

---

## 🚀 How Users Download

### User Experience:

1. **Visit Portal:**
   - User goes to your portal URL
   - Sees password-protected login page

2. **Login:**
   - Enters email and password you gave them
   - System checks if they're allowed

3. **Download:**
   - Sees download page with APK and EXE buttons
   - Clicks download button
   - File downloads automatically

4. **Install:**
   - Follows installation instructions
   - Installs InnerOrbit app
   - Creates account and starts using!

---

## 🛠️ Customization

### Change Colors
Edit the CSS in each HTML file:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Change Logo
Replace the emoji in the header:
```html
<h1>🔐 InnerOrbit</h1>
```

### Add More Platforms
Add new cards in `downloads.html`:
```html
<div class="card">
    <div class="card-icon">🍎</div>
    <h2>iOS App</h2>
    <p>Download for iPhone/iPad</p>
    <a href="#" class="download-btn">Download IPA</a>
</div>
```

---

## 📝 Example User Credentials

### Admin (You):
- Email: admin@InnerOrbit.com
- Password: YourStrongPassword123!
- Access: Full admin rights

### Test User:
- Email: testuser@example.com
- Password: TestPass2026!
- Access: Download only

---

## ❓ Troubleshooting

### "Access denied" error
- Check if user exists in Firebase Authentication
- Check if `allowed: true` in Firestore
- Verify Firebase config is correct

### Download not starting
- Check if file URLs are correct
- Verify files are publicly accessible
- Check browser console for errors

### Can't login to admin panel
- Make sure you created an admin user
- Check Firebase Authentication is enabled
- Verify admin credentials

---

## 🎯 Next Steps

1. ✅ Set up Firebase (if not done)
2. ✅ Add your Firebase config to HTML files
3. ✅ Upload portal to hosting (Firebase/Netlify/Vercel)
4. ✅ Upload APK and EXE files
5. ✅ Create first user and test
6. ✅ Share portal URL with users!

---

## 📞 Support

If you need help:
1. Check Firebase Console for errors
2. Check browser console (F12) for errors
3. Verify all Firebase services are enabled
4. Test with a new user account

---

**Your download portal is ready! Just add Firebase config and deploy!** 🚀
