"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const NODES_SET = 'colyseus:nodes';
const DISCOVERY_CHANNEL = 'colyseus:nodes:discovery';
function getNodeAddress(node) {
    const address = (node.addressInfo.address === '::') ? `[${node.addressInfo.address}]` : node.addressInfo.address;
    return `${node.processId}/${address}:${node.addressInfo.port}`;
}
function registerNode(presence, node) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodeAddress = yield getNodeAddress(node);
        yield presence.sadd(NODES_SET, nodeAddress);
        yield presence.publish(DISCOVERY_CHANNEL, `add,${nodeAddress}`);
    });
}
exports.registerNode = registerNode;
function unregisterNode(presence, node) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodeAddress = yield getNodeAddress(node);
        yield presence.srem(NODES_SET, nodeAddress);
        yield presence.publish(DISCOVERY_CHANNEL, `remove,${nodeAddress}`);
    });
}
exports.unregisterNode = unregisterNode;
