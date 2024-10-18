## Users Schema
```json
{
    "_id": ObjectId,
    "username": String,
    "password": String,
    "avatar": "base64string",
    "email": {id:"validated_verified_email",verified:Boolean},
    "about": "max_120_char_string",
    "public_key": String,
    "chatIds": ObjectId[],
    "createdAt": Date,
    "banned": Boolean
}
```
## User Summary Schema
```json
{
    "_id": ObjectId,
    "username": String,
    "avatar"?: String,
    "public_key": String
}
```
## Messages Schema
```json
{
    "_id": ObjectId,
    "content": String,
    "createdAt": String,
    "createdBy": ObjectId,
    "edited": Boolean,
    "readBy": ObjectId[],
    "chatId": ObjectId
}
```
## Chats Schema
```json
{
    "_id": ObjectId,
    "name": String | undefined, // undefined if it's a direct message
    "createdAt": String,
    "createdBy": ObjectId,
    "messageIds": ObjectId[] | [],
    "avatar": "base64string",
    "memberIds": ObjectId[],
    "direct": Boolean,
    "lastMessageId":  ObjectId

}