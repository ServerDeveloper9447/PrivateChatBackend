// WARNING: THIS IS JUST SAMPLE CODE. IT ISN'T EVEN MODIFIED LIKE THE OTHER FILES.

import { Server, WebSocket } from 'ws'
import { server } from '.'

const wss = new Server({server})

interface Connection extends WebSocket {
    isAlive: Boolean
}

wss.on('connection',function(ws: Connection) {
    ws.isAlive = true
    ws.on('error',console.error)
    ws.on('pong',function() {ws.isAlive = true})
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
    wss.clients.forEach(function (ws:WebSocket) {
        const cn = ws as Connection
        if(cn.isAlive === false) return cn.terminate();
        cn.isAlive = false
        ws.ping()
    })
},30000)

wss.on('close', () => clearInterval(interval))