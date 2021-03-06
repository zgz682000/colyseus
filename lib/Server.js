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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const net_1 = __importDefault(require("net"));
const ws_1 = __importDefault(require("ws"));
const Debug_1 = require("./Debug");
const matchMaker = __importStar(require("./MatchMaker"));
const Transport_1 = require("./transport/Transport");
const Utils_1 = require("./Utils");
const _1 = require(".");
const discovery_1 = require("./discovery");
const LocalPresence_1 = require("./presence/LocalPresence");
const MatchMakeError_1 = require("./errors/MatchMakeError");
const Protocol_1 = require("./Protocol");
class Server {
    constructor(options = {}) {
        this.processId = _1.generateId();
        this.route = '/matchmake';
        this.exposedMethods = ['joinOrCreate', 'create', 'join', 'joinById'];
        this.allowedRoomNameChars = /([a-zA-Z_\-0-9]+)/gi;
        this.onShutdownCallback = () => Promise.resolve();
        const { gracefullyShutdown = true } = options;
        this.presence = options.presence || new LocalPresence_1.LocalPresence();
        // setup matchmaker
        matchMaker.setup(this.presence, options.driver, this.processId);
        // "presence" option is not used from now on
        delete options.presence;
        this.attach(options);
        if (gracefullyShutdown) {
            Utils_1.registerGracefulShutdown((err) => this.gracefullyShutdown(true, err));
        }
    }
    attach(options) {
        if (!options.server) {
            options.server = http_1.default.createServer();
        }
        options.server.once('listening', () => this.registerProcessForDiscovery());
        this.attachMatchMakingRoutes(options.server);
        const engine = options.engine || ws_1.default.Server;
        delete options.engine;
        this.transport = (engine === net_1.default.Server)
            ? new Transport_1.TCPTransport(options)
            : new Transport_1.WebSocketTransport(options, engine);
    }
    listen(port, hostname, backlog, listeningListener) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.transport.listen(port, hostname, backlog, (err) => {
                    if (listeningListener) {
                        listeningListener(err);
                    }
                    if (err) {
                        reject();
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    registerProcessForDiscovery() {
        // register node for proxy/service discovery
        discovery_1.registerNode(this.presence, {
            addressInfo: this.transport.address(),
            processId: this.processId,
        });
    }
    define(name, handler, defaultOptions = {}) {
        return matchMaker.defineRoomType(name, handler, defaultOptions);
    }
    gracefullyShutdown(exit = true, err) {
        return __awaiter(this, void 0, void 0, function* () {
            yield discovery_1.unregisterNode(this.presence, {
                addressInfo: this.transport.address(),
                processId: this.processId,
            });
            try {
                yield matchMaker.gracefullyShutdown();
                this.transport.shutdown();
                yield this.onShutdownCallback();
            }
            catch (e) {
                Debug_1.debugAndPrintError(`error during shutdown: ${e}`);
            }
            finally {
                if (exit) {
                    process.exit(err ? 1 : 0);
                }
            }
        });
    }
    onShutdown(callback) {
        this.onShutdownCallback = callback;
    }
    attachMatchMakingRoutes(server) {
        const listeners = server.listeners('request').slice(0);
        server.removeAllListeners('request');
        server.on('request', (req, res) => {
            if (req.url.indexOf('/matchmake') !== -1) {
                Debug_1.debugMatchMaking('received matchmake request: %s', req.url);
                this.handleMatchMakeRequest(req, res);
            }
            else {
                for (let i = 0, l = listeners.length; i < l; i++) {
                    listeners[i].call(server, req, res);
                }
            }
        });
    }
    handleMatchMakeRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = {
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': 2592000,
            };
            if (req.method === 'OPTIONS') {
                res.writeHead(204, headers);
                res.end();
            }
            else if (req.method === 'POST') {
                const matchedParams = req.url.match(this.allowedRoomNameChars);
                const method = matchedParams[matchedParams.length - 2];
                const name = matchedParams[matchedParams.length - 1];
                const data = [];
                req.on('data', (chunk) => data.push(chunk));
                req.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    headers['Content-Type'] = 'application/json';
                    res.writeHead(200, headers);
                    const body = JSON.parse(Buffer.concat(data).toString());
                    try {
                        if (this.exposedMethods.indexOf(method) === -1) {
                            throw new MatchMakeError_1.MatchMakeError(`invalid method "${method}"`);
                        }
                        const response = yield matchMaker[method](name, body);
                        res.write(JSON.stringify(response));
                    }
                    catch (e) {
                        res.write(JSON.stringify({
                            code: e.code || Protocol_1.Protocol.ERR_MATCHMAKE_UNHANDLED,
                            error: e.message,
                        }));
                    }
                    res.end();
                }));
            }
            else if (req.method === 'GET') {
                const matchedParams = req.url.match(this.allowedRoomNameChars);
                const roomName = matchedParams[matchedParams.length - 1];
                /**
                 * list public & unlocked rooms
                 */
                const conditions = {
                    locked: false,
                    private: false,
                };
                // TODO: improve me, "matchmake" room names aren't allowed this way.
                if (roomName !== 'matchmake') {
                    conditions.name = roomName;
                }
                headers['Content-Type'] = 'application/json';
                res.writeHead(200, headers);
                res.write(JSON.stringify(yield matchMaker.query(conditions)));
                res.end();
            }
        });
    }
}
exports.Server = Server;
