'use client';

import ServerBusy from '../components/ServerBusy';

// Batas error: kegagalan sumber tidak pernah menjadi crash 500.
export default function Error() {
  return <ServerBusy />;
}
