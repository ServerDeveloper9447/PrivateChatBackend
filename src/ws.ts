// WARNING: THIS IS JUST SAMPLE CODE. IT ISN'T EVEN MODIFIED LIKE THE OTHER FILES.

import { Server, WebSocket } from 'ws'
import { server, User } from '.'

export const wss = new Server({server})

interface Connection {
    isAlive: Boolean,
    user:User,
    ws: WebSocket
}

export const connections: Connection[] = []

wss.on('connection',function(ws: WebSocket) {
    ws.on('error',console.error)
    ws.on('pong',function() {
        connections.find(x => x.ws === ws)!.isAlive = true
    })
    ws.on('message',(raw) => {
        try {
            const data = JSON.parse(raw.toString())
        } catch(err) {
            console.trace(err)
            ws.send(JSON.stringify({status:400}))
        }
    })
})

const interval = setInterval(function() {
    wss.clients.forEach(function (ws) {
        const cn = connections.find(x => x.ws === ws as WebSocket)!
        if(cn.isAlive === false) return cn.ws.terminate();
        cn.isAlive = false;
        ws.ping();
    })
},30000)

wss.on('close', () => clearInterval(interval))