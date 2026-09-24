import { useEffect, useState } from 'react';
import { subscribeToUserProfiles } from '../services/chatService';

export interface LiveUserProfile {
  username: string;
  photoURL: string;
}

/**
 * Returns a live map of uid -> { username, photoURL }, resolved from the
 * users collection (the single source of truth for profile data). Prefer
 * these values over the denormalized snapshots in participantMeta /
 * message senderUsername / senderPhotoURL.
 */
export function useUserProfiles(uids: string[]): Record<string, LiveUserProfile> {
  const [profiles, setProfiles] = useState<Record<string, LiveUserProfile>>({});
  const key = [...new Set(uids.filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!key) {
      setProfiles({});
      return;
    }
    const unsub = subscribeToUserProfiles(key.split(','), setProfiles);
    return unsub;
  }, [key]);

  return profiles;
}
