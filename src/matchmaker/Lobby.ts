import * as matchMaker from '../MatchMaker';
import { RoomListingData } from './drivers/Driver';

const LOBBY_CHANNEL = '$lobby';

export function notifyLobby(room: RoomListingData, removed: boolean = false) {
  if (!room.unlisted) {
    matchMaker.presence.publish(LOBBY_CHANNEL, `${room.roomId},${removed ? 1 : 0}`);
  }
}

export async function subscribeLobby(callback: (roomId: string, roomListing: RoomListingData) => void) {
  const cb = async (message) => {
    const [roomId, isRemove] = message.split(',');

    if (isRemove === '1') {
      callback(roomId, null);

    } else {
      const room = (await matchMaker.query({ roomId }))[0];
      callback(roomId, room);
    }
  };

  await matchMaker.presence.subscribe(LOBBY_CHANNEL, cb);

  return () => matchMaker.presence.unsubscribe(LOBBY_CHANNEL, cb);
}
