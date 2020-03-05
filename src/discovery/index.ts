import net from 'net';
import { Presence } from '../presence/Presence';

const NODES_SET = 'colyseus:nodes';
const DISCOVERY_CHANNEL = 'colyseus:nodes:discovery';


export interface Node {
  processId: string;
  addressInfo: net.AddressInfo;
}

function getNodeAddress(node: Node) {
  const address = (node.addressInfo.address === '::') ? `[${node.addressInfo.address}]` : node.addressInfo.address;
  return `${node.processId}/${address}:${node.addressInfo.port}`;
}

export async function registerNode(presence: Presence, node: Node) {
  const nodeAddress = await getNodeAddress(node);
  await presence.sadd(NODES_SET, nodeAddress);
  await presence.publish(DISCOVERY_CHANNEL, `add,${nodeAddress}`);
}

export async function unregisterNode(presence: Presence, node: Node) {
  const nodeAddress = await getNodeAddress(node);
  await presence.srem(NODES_SET, nodeAddress);
  await presence.publish(DISCOVERY_CHANNEL, `remove,${nodeAddress}`);
}

