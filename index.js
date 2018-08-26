let net = require('net');
let debug = require('debug')('undetectproxy');
// let request = require('request');
// let cache = require('memory-cache').Cache();
//lấy IP server;
let URL = require('url-parse');
let dns = require('dns');
/*
options = {};
options.timeout = 30*60*1000; //30 phut timeout
options.type = 'socks'; //proxy
options.host '22.22.22.22';
options.port '8080';
options.auth = {}; //updating
options.auth.username = 'kkk'; //updating
options.auth.password = 'kkk'; //updating

function callback(error,proxy_port){
//tra ve port;
}
 */
function start(options, cb) {

    if(typeof options === "undefined"){
        return cb('undetectProxy: need options');
    }
    //type proxy;


    debug('%s %s:%s to proxy 127.0.0.1:8090',options.type,options.host,options.port);
    let port;port = 0;
    if(debug.enabled) port = 8090;
    let server = net.createServer().listen(port);
    server.on('listening', function (k) {
        let port = server.address().port;
        debug('%s running port: %s', options.type,port);
        return cb(null, port);
    });
    server.on('error', function () {
        return cb('create socket error', null);
    });
    if(options.timeout) setTimeout(function(){
        server.close();
    },options.timeout);

    if (options.type === 'proxy') {
        server.on('connection', async function (socket) {
            debug('Connection from %s:%s', socket.remoteAddress, socket.remotePort);

            socket.pause(); //pause stop nhan data
            //get target by socket.remoteAddress --> target = x;
            //cache socket;
            let dstSock = new net.Socket();
            dstSock.setNoDelay(true);
            socket.setNoDelay(true);
            dstSock.on('connect', function () {
                debug('Connected to %s %s:%s',options.type,options.host,options.port);
                socket.resume(); //unpause de nhan data;
                socket.once('data', async function (data) {
                    let request_data = data.toString().split("\n");

                    //1 detect method;
                    let method,iData,iHost;
                    for (let i = 0; i <= request_data.length; i++) {
                        if (typeof request_data[i] === 'string') {
                            try {
                                if (request_data[i].match('CONNECT')) {
                                    method = 'CONNECT';
                                    iData = i;
                                }
                                if (request_data[i].match('http://')) {
                                    method = 'HTTP';
                                    iData = i;
                                }
                                if (request_data[i].match('Host: ')) {
                                    iHost = i;
                                }
                            }catch(e){
                                console.log(e,data);
                            }
                        }
                    }


                    if(iData !== null){
                        let connectData,reqMethod;
                        try {
                            reqMethod = request_data[iData].match(/(.*) (.*) (.*)/);
                            console.log(reqMethod)
                        }catch(e){
                            debug('Error',e);
                            debug(request_data);
                        }
                        if(method === 'CONNECT'){
                            let [host,port] = reqMethod[2].split(':');
                            let ipaddress = await new Promise(function(accept,fail){
                                dns.lookup(host,function(err,address,family){
                                    if(err) return accept(null);
                                    return accept(address);
                                });
                            });
                            if(ipaddress=== null) return onClose();
                            connectData = [];
                            connectData.push(reqMethod[1]);
                            connectData.push(ipaddress+':'+port);
                            connectData.push(reqMethod[3]);

                            let request =connectData.join(' ') + "\nProxy-Connection: Keep-Alive\n\n";
                            debug(request);
                            dstSock.write(request);
                            dstSock.pipe(socket).pipe(dstSock);
                        }
                        else if(method === 'HTTP'){
                            let url = new URL(reqMethod[2]);
                            let ipaddress = await new Promise(function(accept,fail){
                                dns.lookup(url.host,function(err,address,family){
                                    if(err) return accept(null);
                                    return accept(address);
                                });
                            });
                            if(ipaddress=== null) return onClose();
                            if(url.port === '') url.port = 80;
                            connectData = [];
                            connectData.push('CONNECT');
                            connectData.push(ipaddress+':'+url.port);
                            connectData.push(reqMethod[3]);

                            let request =connectData.join(' ') + "\nProxy-Connection: Keep-Alive\n\n";
                            debug(request);
                            dstSock.write(request);
                            dstSock.once('data', function (datae) {
                                if (datae.toString().match('200 Connection established')) {
                                    debug('Connected method CONNECT %s', connectData[1]);
                                    //kết nối thành công, send tiếp request nếu method = GET, nếu k thì pipe

                                    dstSock.write(request_data.join("\n"));
                                    dstSock.pipe(socket).pipe(dstSock);


                                } else {
                                    debug('Kết nối failed!',datae.toString());
                                    socket.write(datae);
                                    return onClose();
                                }
                            });
                        }




                    }
                    else {

                        let request = reindexArray(request_data).join("\n");
                        debug(request);
                        dstSock.write(request);
                        dstSock.pipe(socket).pipe(dstSock);
                    }
                });
            }).connect(options.port, options.host);

            function onClose(){
                if(socket instanceof net.Socket) {
                    socket.removeAllListeners('data');
                    socket.removeAllListeners('close');
                    socket.removeAllListeners('end');
                    socket.removeAllListeners('error');
                    socket.destroy();
                }
                if(dstSock instanceof net.Socket) {
                    dstSock.removeAllListeners('data');
                    dstSock.removeAllListeners('close');
                    dstSock.removeAllListeners('end');
                    dstSock.removeAllListeners('error');
                    dstSock.destroy();
                }
            }
            socket.on('error',onClose);
            socket.on('close',onClose);
            socket.on('end',onClose);

            socket.setTimeout(10*1000);
            dstSock.setTimeout(10*1000);

            socket.on('timeout',onClose);
            dstSock.on('timeout',onClose);

            dstSock.on('error',onClose);
            dstSock.on('close',onClose);
            dstSock.on('end',onClose);

        });
    }
}
function reindexArray(array) {
    let result = [];
    for (let key in array)
        result.push(array[key]);
    return result;
};
exports.start = start;