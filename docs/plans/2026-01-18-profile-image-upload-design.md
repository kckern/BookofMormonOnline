# Profile Image Upload Design

## Overview

Restore profile image upload functionality using S3 storage via `media.bookofmormon.online`, replacing the removed Sendbird integration.

## URL Structure

Profile images are stored at a deterministic URL derived from the user's hash:

```
https://media.bookofmormon.online/profiles/{md5_hash}.jpg
```

- No database storage needed for profile URLs
- Hash is derived from username (same hash used elsewhere in system)
- All images stored as 256x256 JPEG

## Architecture

### Request Flow (Viewing)

```
Frontend                         CloudFront                 S3
   │                                 │                       │
   ├─ GET /profiles/{hash}.jpg ─────►│                       │
   │                                 ├─ Check cache ────────►│
   │                                 │◄─ 200 or 404 ─────────┤
   │◄─ Image or 404 ─────────────────┤                       │
   │                                 │                       │
   └─ If 404: show DiceBear avatar   │                       │
```

- Frontend requests image from media.bookofmormon.online
- S3 + CloudFront serves the image (already configured)
- On 404, frontend falls back to DiceBear placeholder (existing behavior)

### Upload Flow

```
ImageChanger.js                    Backend                    S3
      │                              │                         │
      ├─ Crop image (react-cropper)  │                         │
      ├─ Convert to base64           │                         │
      ├─ uploadProfileImage() ──────►│                         │
      │                              ├─ Decode + resize        │
      │                              ├─ PUT /{hash}.jpg ──────►│
      │                              ├─ Invalidate CloudFront  │
      │◄─ true ──────────────────────┤                         │
      ├─ Refresh avatar display      │                         │
```

## GraphQL API

### Mutation

```graphql
mutation uploadProfileImage($imageData: String!) {
  uploadProfileImage(imageData: $imageData): Boolean
}
```

### Backend Processing

1. Receive base64 image data from authenticated user
2. Decode base64 to buffer
3. Resize to 256x256, convert to JPEG (using `sharp`)
4. Generate S3 key: `profiles/{md5(username)}.jpg`
5. Upload to S3 bucket with public-read ACL
6. Invalidate CloudFront cache for that path
7. Return success/failure

## Files to Modify

### Backend (new/modified)

| File | Change |
|------|--------|
| `src/resolvers/BomUser.ts` | Add `uploadProfileImage` mutation |
| `src/typeDefs/BomUser.ts` | Add mutation to schema |
| `src/library/s3.ts` | New file: S3 upload + CloudFront invalidation helpers |
| `package.json` | Add `sharp`, `@aws-sdk/client-s3`, `@aws-sdk/client-cloudfront` |

### Frontend (modified)

| File | Change |
|------|--------|
| `src/views/User/ImageChanger.js` | Replace Sendbird SDK call with GraphQL mutation |
| `src/components/UserAvatar.js` | Use `media.bookofmormon.online/profiles/{hash}.jpg` as primary URL |

### Cleanup (remove dead code)

| File | Change |
|------|--------|
| `src/views/User/ImageChanger.js` | Remove `appController.sendbird.sb.updateCurrentUserInfo` |
| `src/resolvers/BomUser.ts` | Remove broken `sendbird.updateUserNickname()` in `editProfile()` |
| `src/models/MessengerController.js` | Remove `updateCurrentUserInfo()` if unused |

## Configuration

### Environment Variables

```
S3_BUCKET=bookofmormon-media
S3_REGION=us-east-1
CLOUDFRONT_DISTRIBUTION_ID=XXXXX
```

### IAM Permissions Required

- `s3:PutObject` on `arn:aws:s3:::bookofmormon-media/profiles/*`
- `cloudfront:CreateInvalidation` on distribution

## Fallback Behavior

When no profile image exists:
1. Frontend requests `media.bookofmormon.online/profiles/{hash}.jpg`
2. CloudFront returns 404
3. `UserAvatar.js` `onError` handler renders DiceBear URL instead
4. DiceBear generates deterministic avatar from same hash

This matches existing behavior — no changes needed to fallback logic.

## Shared Utility

```typescript
// Frontend + Backend
const getProfileImageUrl = (userHash: string) =>
  `https://media.bookofmormon.online/profiles/${userHash}.jpg`;
```
