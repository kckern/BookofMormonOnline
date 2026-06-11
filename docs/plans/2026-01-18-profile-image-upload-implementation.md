# Profile Image Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore profile image upload using S3 storage via assets.bookofmormon.online, replacing removed Sendbird integration.

**Architecture:** GraphQL mutation receives base64 image → backend resizes to 256x256 JPEG using sharp → uploads to S3 at deterministic path `/profiles/{md5_hash}.jpg` → invalidates CloudFront cache. Frontend falls back to DiceBear on 404.

**Tech Stack:** sharp (image processing), @aws-sdk/client-s3, @aws-sdk/client-cloudfront, React cropper (existing)

---

## Task 1: Install Backend Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
cd /path/to/BookofMormonOnline/.worktrees/profile-image-upload
npm install sharp @aws-sdk/client-s3 @aws-sdk/client-cloudfront
```

**Step 2: Verify installation**

Run: `npm ls sharp @aws-sdk/client-s3 @aws-sdk/client-cloudfront`
Expected: All three packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp and AWS SDK for profile image uploads"
```

---

## Task 2: Create S3 Upload Library

**Files:**
- Create: `src/library/s3.ts`

**Step 1: Create the S3 helper module**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import sharp from 'sharp';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const cloudFrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const S3_BUCKET = process.env.S3_BUCKET || 'bomonline-media-assets';
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID || '';

/**
 * Process and upload a profile image to S3
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param userHash - MD5 hash of username for the file path
 * @returns The public URL of the uploaded image
 */
export async function uploadProfileImage(base64Data: string, userHash: string): Promise<string> {
  // Strip data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Clean, 'base64');

  // Resize to 256x256 and convert to JPEG
  const processedImage = await sharp(imageBuffer)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const key = `profiles/${userHash}.jpg`;

  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: processedImage,
    ContentType: 'image/jpeg',
    CacheControl: 'max-age=31536000', // 1 year cache
  }));

  // Invalidate CloudFront cache
  if (CLOUDFRONT_DISTRIBUTION_ID) {
    await cloudFrontClient.send(new CreateInvalidationCommand({
      DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `profile-${userHash}-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: [`/${key}`],
        },
      },
    }));
  }

  return `https://assets.bookofmormon.online/${key}`;
}

/**
 * Generate the profile image URL for a user hash
 * @param userHash - MD5 hash of username
 * @returns The expected profile image URL
 */
export function getProfileImageUrl(userHash: string): string {
  return `https://assets.bookofmormon.online/profiles/${userHash}.jpg`;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /path/to/BookofMormonOnline/.worktrees/profile-image-upload && npx tsc src/library/s3.ts --noEmit --esModuleInterop --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/library/s3.ts
git commit -m "feat: add S3 upload library for profile images"
```

---

## Task 3: Add GraphQL Schema

**Files:**
- Modify: `src/typeDefs/BomUser.ts:28-34`

**Step 1: Add the mutation to the schema**

Find this block in `src/typeDefs/BomUser.ts`:
```typescript
extend type Mutation {
    log( token: String!,key: String!, val: String): LogResult
    changePassword(token: String, password: String): Boolean
    signup(token: String,  username: String, password: String, name: String, email: String, zip: String): SignIn
    signout(token: String): Boolean
    editProfile(token: String, name: String, email: String, zip: String): User
  }
```

Replace with:
```typescript
extend type Mutation {
    log( token: String!,key: String!, val: String): LogResult
    changePassword(token: String, password: String): Boolean
    signup(token: String,  username: String, password: String, name: String, email: String, zip: String): SignIn
    signout(token: String): Boolean
    editProfile(token: String, name: String, email: String, zip: String): User
    uploadProfileImage(token: String!, imageData: String!): Boolean
  }
```

**Step 2: Commit**

```bash
git add src/typeDefs/BomUser.ts
git commit -m "feat: add uploadProfileImage mutation to GraphQL schema"
```

---

## Task 4: Add GraphQL Resolver

**Files:**
- Modify: `src/resolvers/BomUser.ts`

**Step 1: Add import at top of file (after line 9)**

Find:
```typescript
import crypto from 'crypto';
```

Add after:
```typescript
import { uploadProfileImage } from '../library/s3';
```

**Step 2: Add the resolver in the Mutation object**

Find the `Mutation:` object in the resolver (around line 470+). Add the following resolver after the `editProfile` resolver:

```typescript
    uploadProfileImage: async (
      _root: unknown,
      args: { token: string; imageData: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const { token, imageData } = args;

      // Find user by token
      const user = await findUserByToken(token);
      if (!user) {
        throw new Error('Invalid token');
      }

      // Get user hash (same hash used elsewhere)
      const userHash = md5(user.user);

      try {
        await uploadProfileImage(imageData, userHash);
        return true;
      } catch (error) {
        console.error('Profile image upload failed:', error);
        return false;
      }
    },
```

**Step 3: Verify TypeScript compiles**

Run: `cd /path/to/BookofMormonOnline/.worktrees/profile-image-upload && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

**Step 4: Commit**

```bash
git add src/resolvers/BomUser.ts
git commit -m "feat: add uploadProfileImage resolver"
```

---

## Task 5: Add Frontend GraphQL Query

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`

**Step 1: Add the uploadProfileImage query**

Find the `editProfile` query (around line 1107). Add this new query after it:

```javascript
  uploadProfileImage: (input) => {
    input = input.shift();
    return {
      type: "uploadProfileImage",
      key: 0,
      val: input,
      query: `mutation {` +
      `        uploadProfileImage(` +
      `          token: "${input.token}"` +
      `          imageData: "${input.imageData}"` +
      `        )` +
      `      }
      `,
    }
  },
```

**Step 2: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat: add uploadProfileImage query to frontend"
```

---

## Task 6: Update ImageChanger Component

**Files:**
- Modify: `frontend/webapp/src/views/User/ImageChanger.js`

**Step 1: Add import for BoMOnlineAPI**

Find the imports at top of file. Add:
```javascript
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
```

**Step 2: Replace the uploadImage function**

Find the `uploadImage` function (around line 35). Replace the entire function with:

```javascript
  const uploadImage = async () => {
    setUploading(true);
    if (typeof cropper !== "undefined") {
      if (isGroup) {
        const imgUrl = cropper.getCroppedCanvas().toDataURL();
        cropper.getCroppedCanvas().toBlob(function (blob) {
          let file = null;
          if (blob["type"] === "image/jpeg") {
            file = new File([blob], "profile_picture.jpg", {
              type: "image/jpeg",
            });
          } else if (blob["type"] === "image/png") {
            file = new File([blob], "profile_picture.png");
          }
          setProfileImage({ img: imgUrl, file });
        });
        return setOpenModal(false);
      }

      // Get cropped image as base64
      const imageData = cropper.getCroppedCanvas().toDataURL("image/jpeg", 0.9);
      const token = appController.states.user.token;

      try {
        const result = await BoMOnlineAPI(
          { uploadProfileImage: [{ token, imageData }] },
          { useCache: false }
        );

        if (result?.uploadProfileImage) {
          // Generate new profile URL and update state
          const userId = appController.states.user.social?.user_id;
          const newProfileUrl = `https://assets.bookofmormon.online/profiles/${userId}.jpg?v=${Date.now()}`;
          appController.functions.setUserSocialProfileImage(newProfileUrl);
          toast.success(label("profile_updated") || "Profile image updated");
          setTimeout(() => setOpenModal(false), 1000);
        } else {
          toast.warn(label("error") || "Upload failed");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.warn(label("error") || "Upload failed");
      } finally {
        setUploading(false);
      }
    }
  };
```

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/User/ImageChanger.js
git commit -m "feat: update ImageChanger to use GraphQL upload"
```

---

## Task 7: Update UserAvatar Component

**Files:**
- Modify: `frontend/webapp/src/components/UserAvatar.js`

**Step 1: Update the component to use new URL pattern**

Replace the entire file content with:

```javascript
import React, { useState } from 'react';

/**
 * Deterministic avatar URL generator - produces consistent results for the same userId
 * Uses thumbs style with deterministic color selection based on user ID hash
 */
export function generateAvatarUrl(userId) {
  const pallettes = [
    ["FF86F1", "FF00CC"], ["00FFFF", "000080"], ["99FFCC", "009933"],
    ["FF6699", "990033"], ["33CCFF", "003366"], ["00FF80", "004D40"],
    ["FF9933", "6B4423"], ["FF99FF", "993399"], ["99CCFF", "003399"],
    ["00CC99", "006633"], ["FF9999", "800000"], ["FFFF99", "808000"],
    ["99FF99", "006400"], ["FFCC99", "8B4513"], ["CCCCFF", "000099"],
    ["CC99FF", "660099"], ["FF66CC", "660033"], ["CCFFFF", "006666"],
    ["FF9966", "663300"], ["66CCFF", "002266"], ["99CC66", "435D36"],
    ["66FF66", "003300"], ["FFFF66", "878700"], ["FF9999", "942121"],
    ["FFCCCC", "853333"], ["99CC99", "385438"], ["CCCC99", "545400"],
    ["CCFFCC", "004700"], ["FFCC99", "6B3600"], ["CCFF99", "3B5900"],
    ["FFFFCC", "878600"], ["FF9966", "803000"], ["CCFF66", "315000"],
  ];

  const mouths = ["variant1", "variant2", "variant3", "variant4"];
  const rotations = [0, 20, 340, 40, 320];
  const eyes = "variant6W10,variant8W14,variant2W10";

  // Deterministic selection based on userId hash
  const id = userId || 'user';
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const seed = id.slice(0, 5);
  const [back, fore] = pallettes[hash % pallettes.length];
  const mouth = mouths[hash % mouths.length];
  const rotation = rotations[hash % rotations.length];

  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=${back}&shapeColor=${fore}&eyes=${eyes}&rotate=${rotation}&scale=70&mouth=${mouth}`;
}

/**
 * Generate the profile image URL from user ID
 */
export function getProfileImageUrl(userId) {
  if (!userId) return null;
  return `https://assets.bookofmormon.online/profiles/${userId}.jpg`;
}

/**
 * User avatar with DiceBear fallback for broken/missing images
 * Tries: 1) provided profileUrl, 2) S3 profile image, 3) DiceBear fallback
 */
export default function UserAvatar({ userId, profileUrl, size = 40, className = '', style = {} }) {
  const [failed, setFailed] = useState(false);
  const [triedS3, setTriedS3] = useState(false);

  // Determine which URL to use
  let finalSrc;

  // If we have a profileUrl that's not from dead Sendbird, use it
  const isSendbirdUrl = profileUrl && (profileUrl.includes('sendbird.com') || profileUrl.includes('sendbird.io'));

  if (profileUrl && !isSendbirdUrl && !failed) {
    finalSrc = profileUrl;
  } else if (userId && !triedS3) {
    // Try our S3 bucket
    finalSrc = getProfileImageUrl(userId);
  } else {
    // Fall back to DiceBear
    finalSrc = generateAvatarUrl(userId);
  }

  const handleError = () => {
    if (!triedS3 && userId) {
      // First failure - we were trying profileUrl or S3, try fallback
      setTriedS3(true);
      setFailed(true);
    }
  };

  return (
    <img
      src={finalSrc}
      onError={handleError}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        ...style
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add frontend/webapp/src/components/UserAvatar.js
git commit -m "feat: update UserAvatar to use S3 profile images with DiceBear fallback"
```

---

## Task 8: Clean Up Dead Sendbird Code

**Files:**
- Modify: `src/resolvers/BomUser.ts`

**Step 1: Remove broken sendbird call in editProfile**

Find the `editProfile` resolver. Look for any line calling `sendbird.updateUserNickname()` and remove it (if it exists). The resolver should just update the database, not call sendbird.

**Step 2: Commit**

```bash
git add src/resolvers/BomUser.ts
git commit -m "chore: remove dead sendbird code from editProfile"
```

---

## Task 9: Manual Testing

**Step 1: Start backend**

Run:
```bash
cd /path/to/BookofMormonOnline/.worktrees/profile-image-upload
npm run dev:backend
```

**Step 2: Start frontend in another terminal**

Run:
```bash
cd /path/to/BookofMormonOnline/.worktrees/profile-image-upload/frontend/webapp
npm start
```

**Step 3: Test the upload flow**

1. Log in to the application
2. Navigate to profile settings
3. Click to change profile image
4. Select/crop an image
5. Click Upload
6. Verify image appears in S3: `aws s3 ls s3://bomonline-media-assets/profiles/`
7. Verify image displays in UI

**Step 4: Test fallback**

1. Create a new test user (or use one without uploaded image)
2. Verify DiceBear avatar displays correctly

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependencies | package.json |
| 2 | Create S3 library | src/library/s3.ts |
| 3 | Add GraphQL schema | src/typeDefs/BomUser.ts |
| 4 | Add GraphQL resolver | src/resolvers/BomUser.ts |
| 5 | Add frontend query | frontend/webapp/src/models/GraphQLQueries.js |
| 6 | Update ImageChanger | frontend/webapp/src/views/User/ImageChanger.js |
| 7 | Update UserAvatar | frontend/webapp/src/components/UserAvatar.js |
| 8 | Clean up dead code | src/resolvers/BomUser.ts |
| 9 | Manual testing | - |

**Environment Variables Required (for deployment):**
```
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-west-2
S3_BUCKET=bomonline-media-assets
CLOUDFRONT_DISTRIBUTION_ID=<your-distribution-id>
```
