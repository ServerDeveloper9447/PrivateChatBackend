import { Server, WebSocket } from 'ws'
import { db, server, User } from '.'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import errors from './assets/errors.json'
import { Connections } from './assets/connection'

export const wss = new Server({server})
const user = db.collection('Users')

export const connections = new Connections()

wss.on('connection',function(ws: WebSocket) {
    ws.on('error',console.error)
    ws.on('pong',function() {
        connections.find(x => x.ws === ws)!.isAlive = true
    })
    let first = true
    let timeout = setTimeout(() => {
        ws.terminate()
    },30000)
    ws.on('message',async (raw) => {
        if(first) {
            let data:{access_token:string};
            try {
                data = JSON.parse(raw.toString())
                clearTimeout(timeout)
                const dt = jwt.verify(data.access_token,process.env.AT_SECRET!) as {_id:string, username:string}
                const u = await user.findOne({_id:new ObjectId(dt._id)}) as User
                if(!u) {
                    ws.send(JSON.stringify({status:404,error:"Cannot find user."}));
                    return ws.terminate();
                }
                if(u.access_token !== data.access_token) {
                    ws.send(JSON.stringify(errors.find(x => x.status === 1007)))
                    return ws.terminate()
                }
                connections.push({ws,user:u,isAlive:true})
                first = false;
            } catch(err) {
                ws.send(JSON.stringify({status:401,error:"Cannot process identification."}));
            }
        }
    })
})

const interval = setInterval(function() {
    wss.clients.forEach(function (ws) {
        const cn = connections.find(x => x.ws === ws)
        if(!cn) return;
        if(cn.isAlive === false) {
            cn.ws.terminate()
        }
        cn.isAlive = false;
        ws.ping();
    })
},30000)

wss.on('close', () => clearInterval(interval))