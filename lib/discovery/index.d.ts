/// <reference types="node" />
import net from 'net';
import { Presence } from '../presence/Presence';
export interface Node {
    processId: string;
    addressInfo: net.AddressInfo;
}
export declare function registerNode(presence: Presence, node: Node): Promise<void>;
export declare function unregisterNode(presence: Presence, node: Node): Promise<void>;
