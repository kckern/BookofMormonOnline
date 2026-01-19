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
